use std::io::Cursor;

use anyhow::{Context, Result, bail};
use capnp::{message::ReaderOptions, serialize_packed};

use crate::device_capnp::{envelope, job_status, print_options};

#[derive(Clone)]
pub struct PrintOptions {
    pub copies: u16,
    pub duplex: Duplex,
    pub color: bool,
    pub media: String,
    pub page_ranges: String,
    pub orientation: Orientation,
}

#[derive(Clone, Copy)]
pub enum Duplex {
    None,
    LongEdge,
    ShortEdge,
}

#[derive(Clone, Copy)]
pub enum Orientation {
    Portrait,
    Landscape,
}

pub struct PrintJob {
    pub job_id: String,
    pub download_url: String,
    pub expires_at_ms: u64,
    pub document_bytes: u64,
    pub options: PrintOptions,
}

pub enum Status<'a> {
    Printing,
    Completed,
    Failed { code: &'a str, message: &'a str },
}

pub fn decode_print_job(frame: &[u8]) -> Result<PrintJob> {
    let mut cursor = Cursor::new(frame);
    let message = serialize_packed::read_message(&mut cursor, ReaderOptions::new())?;
    let envelope = message.get_root::<envelope::Reader<'_>>()?;
    let job = match envelope.which()? {
        envelope::Which::PrintJob(job) => job?,
        envelope::Which::JobStatus(_) => bail!("expected PrintJob envelope"),
    };
    let job_id = job.get_job_id()?.to_str()?.to_owned();
    if job_id.is_empty()
        || job_id.len() > 64
        || !job_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        bail!("invalid job ID");
    }
    let download_url = job.get_download_url()?.to_str()?.to_owned();
    if !download_url.starts_with("https://") {
        bail!("download URL must use HTTPS");
    }
    if job.get_page_count() == 0 {
        bail!("document has no pages");
    }
    let options = job.get_options()?;
    let duplex = match options.get_duplex()? {
        print_options::Duplex::None => Duplex::None,
        print_options::Duplex::LongEdge => Duplex::LongEdge,
        print_options::Duplex::ShortEdge => Duplex::ShortEdge,
    };
    let orientation = match options.get_orientation()? {
        print_options::Orientation::Portrait => Orientation::Portrait,
        print_options::Orientation::Landscape => Orientation::Landscape,
    };
    let copies = options.get_copies();
    if copies == 0 {
        bail!("copies must be positive");
    }

    Ok(PrintJob {
        job_id,
        download_url,
        expires_at_ms: job.get_expires_at_ms(),
        document_bytes: job.get_document_bytes(),
        options: PrintOptions {
            copies,
            duplex,
            color: options.get_color(),
            media: options.get_media()?.to_str()?.to_owned(),
            page_ranges: options.get_page_ranges()?.to_str()?.to_owned(),
            orientation,
        },
    })
}

pub fn encode_status(job_id: &str, value: Status<'_>) -> Result<Vec<u8>> {
    let mut message = capnp::message::Builder::new_default();
    let envelope = message.init_root::<envelope::Builder<'_>>();
    let mut status = envelope.init_job_status();
    status.set_job_id(job_id);
    match value {
        Status::Printing => status.set_state(job_status::State::Printing),
        Status::Completed => status.set_state(job_status::State::Completed),
        Status::Failed { code, message } => {
            status.set_state(job_status::State::Failed);
            status.set_failure_code(code);
            status.set_failure_message(message);
        }
    }
    let mut bytes = Vec::new();
    serialize_packed::write_message(&mut bytes, &message).context("failed to encode JobStatus")?;
    Ok(bytes)
}
