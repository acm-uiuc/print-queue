use std::path::Path;

use futures_util::StreamExt;
use reqwest::StatusCode;
use tokio::{
    fs::File,
    io::{AsyncReadExt, AsyncWriteExt},
};

use crate::failure::Failure;

pub async fn download_pdf(
    client: &reqwest::Client,
    url: &str,
    expected_bytes: u64,
    destination: &Path,
) -> Result<(), Failure> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(Failure::download)?;
    if response.status() == StatusCode::UNAUTHORIZED || response.status() == StatusCode::FORBIDDEN {
        return Err(Failure::new(
            "download_expired",
            "download URL was rejected",
        ));
    }
    let response = response
        .error_for_status()
        .map_err(Failure::download)?;
    if let Some(length) = response.content_length()
        && length != expected_bytes
    {
        return Err(Failure::new(
            "invalid_document",
            "document length does not match job metadata",
        ));
    }

    let mut file = File::create(destination)
        .await
        .map_err(Failure::internal)?;
    let mut received = 0_u64;
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(Failure::download)?;
        received = received
            .checked_add(chunk.len() as u64)
            .ok_or_else(|| Failure::new("invalid_document", "document is too large"))?;
        if received > expected_bytes {
            return Err(Failure::new(
                "invalid_document",
                "document exceeds expected length",
            ));
        }
        file.write_all(&chunk)
            .await
            .map_err(Failure::internal)?;
    }
    file.sync_all()
        .await
        .map_err(Failure::internal)?;

    validate_pdf(destination, expected_bytes).await
}

pub async fn validate_pdf(path: &Path, expected_bytes: u64) -> Result<(), Failure> {
    let metadata = tokio::fs::metadata(path)
        .await
        .map_err(|error| Failure::new("invalid_document", error.to_string()))?;
    if metadata.len() != expected_bytes {
        return Err(Failure::new(
            "invalid_document",
            "spooled document length does not match job metadata",
        ));
    }
    let mut header = [0_u8; 5];
    let mut file = File::open(path)
        .await
        .map_err(|error| Failure::new("invalid_document", error.to_string()))?;
    file.read_exact(&mut header)
        .await
        .map_err(|_| Failure::new("invalid_document", "document has no PDF header"))?;
    if &header != b"%PDF-" {
        return Err(Failure::new(
            "invalid_document",
            "document has no PDF header",
        ));
    }
    Ok(())
}
