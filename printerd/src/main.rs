mod config;
mod cups;
mod download;
mod failure;
mod journal;
mod protocol;
mod tls;

pub mod device_capnp {
    include!(concat!(env!("OUT_DIR"), "/device_capnp.rs"));
}

use std::{
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpStream;
use tokio_tungstenite::{
    MaybeTlsStream, WebSocketStream, connect_async_tls_with_config, tungstenite::Message,
};

use crate::{
    config::Config,
    cups::Cups,
    failure::Failure,
    journal::{JobState, Journal},
    protocol::{PrintJob, Status, decode_print_job, encode_status},
};

type Socket = WebSocketStream<MaybeTlsStream<TcpStream>>;

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<()> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .map_err(|_| anyhow::anyhow!("failed to install TLS crypto provider"))?;
    let config_path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "/etc/print-agent/config.toml".to_owned());
    let config = Config::load(Path::new(&config_path))?;
    let connector = tls::connector(&config.certificate, &config.private_key)?;
    let journal = Journal::open(&config.state_dir)?;
    let cups = Cups::new(&config.cups_uri).map_err(|failure| anyhow::anyhow!(failure.message))?;
    let downloads = reqwest::Client::new();

    let mut delay = Duration::from_secs(1);
    loop {
        match connect_async_tls_with_config(&config.endpoint, None, false, Some(connector.clone()))
            .await
        {
            Ok((mut socket, _)) => {
                delay = Duration::from_secs(1);
                if let Err(error) = run_connection(&mut socket, &journal, &cups, &downloads).await {
                    eprintln!("print connection closed: {error:#}");
                }
            }
            Err(error) => eprintln!("print connection failed: {error}"),
        }

        let jitter = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_millis() as u64
            % 500;
        tokio::time::sleep(delay + Duration::from_millis(jitter)).await;
        delay = (delay * 2).min(Duration::from_secs(30));
    }
}

async fn run_connection(
    socket: &mut Socket,
    journal: &Journal,
    cups: &Cups,
    downloads: &reqwest::Client,
) -> Result<()> {
    while let Some(frame) = socket.next().await {
        match frame? {
            Message::Binary(bytes) => match decode_print_job(&bytes) {
                Ok(job) => process_job(socket, journal, cups, downloads, job).await?,
                Err(error) => eprintln!("discarding invalid print frame: {error:#}"),
            },
            Message::Ping(bytes) => socket.send(Message::Pong(bytes)).await?,
            Message::Close(_) => return Ok(()),
            Message::Text(_) => eprintln!("discarding text WebSocket frame"),
            _ => {}
        }
    }
    Ok(())
}

async fn process_job(
    socket: &mut Socket,
    journal: &Journal,
    cups: &Cups,
    downloads: &reqwest::Client,
    job: PrintJob,
) -> Result<()> {
    let mut downloaded = false;
    match journal.load(&job.job_id)? {
        Some(JobState::Completed) | Some(JobState::Submitted { .. }) => {
            // This implementation defines completion as durable CUPS acceptance.
            journal.save(&job.job_id, JobState::Completed)?;
            return send_status(socket, &job.job_id, Status::Completed).await;
        }
        Some(JobState::Failed { code, message }) => {
            return send_status(
                socket,
                &job.job_id,
                Status::Failed {
                    code: &code,
                    message: &message,
                },
            )
            .await;
        }
        Some(JobState::Accepted) | None => journal.save(&job.job_id, JobState::Accepted)?,
        Some(JobState::Downloaded) => downloaded = true,
    }

    send_status(socket, &job.job_id, Status::Printing).await?;
    let spool = journal.spool_path(&job.job_id);
    if downloaded
        && download::validate_pdf(&spool, job.document_bytes)
            .await
            .is_err()
    {
        let _ = tokio::fs::remove_file(&spool).await;
        journal.save(&job.job_id, JobState::Accepted)?;
        downloaded = false;
    }
    if !downloaded {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        if now_ms >= job.expires_at_ms {
            anyhow::bail!("download URL expired; reconnecting for a fresh URL");
        }
        if let Err(failure) =
            download::download_pdf(downloads, &job.download_url, job.document_bytes, &spool).await
        {
            let _ = tokio::fs::remove_file(&spool).await;
            if failure.code == "download_expired" {
                anyhow::bail!("download URL rejected; reconnecting for a fresh URL");
            }
            return fail_job(socket, journal, &job.job_id, failure).await;
        }
        journal.save(&job.job_id, JobState::Downloaded)?;
    }
    let cups_job_id = match cups.submit(&spool, &job.job_id, &job.options).await {
        Ok(id) => id,
        Err(failure) => {
            let _ = tokio::fs::remove_file(&spool).await;
            return fail_job(socket, journal, &job.job_id, failure).await;
        }
    };
    journal.save(&job.job_id, JobState::Submitted { cups_job_id })?;
    journal.save(&job.job_id, JobState::Completed)?;
    let _ = tokio::fs::remove_file(spool).await;
    send_status(socket, &job.job_id, Status::Completed).await
}

async fn fail_job(
    socket: &mut Socket,
    journal: &Journal,
    job_id: &str,
    failure: Failure,
) -> Result<()> {
    journal.save(
        job_id,
        JobState::Failed {
            code: failure.code.to_owned(),
            message: failure.message.clone(),
        },
    )?;
    send_status(
        socket,
        job_id,
        Status::Failed {
            code: failure.code,
            message: &failure.message,
        },
    )
    .await
}

async fn send_status(socket: &mut Socket, job_id: &str, status: Status<'_>) -> Result<()> {
    socket
        .send(Message::Binary(encode_status(job_id, status)?.into()))
        .await?;
    Ok(())
}
