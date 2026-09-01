use std::{fs::File, io::BufReader, path::Path, sync::Arc};

use anyhow::{Context, Result};
use rustls::{ClientConfig, RootCertStore};
use tokio_tungstenite::Connector;

pub fn connector(certificate: &Path, private_key: &Path) -> Result<Connector> {
    let mut certificate_reader = BufReader::new(
        File::open(certificate)
            .with_context(|| format!("failed to open {}", certificate.display()))?,
    );
    let certificates = rustls_pemfile::certs(&mut certificate_reader)
        .collect::<Result<Vec<_>, _>>()
        .context("invalid device certificate")?;
    let mut key_reader = BufReader::new(
        File::open(private_key)
            .with_context(|| format!("failed to open {}", private_key.display()))?,
    );
    let key = rustls_pemfile::private_key(&mut key_reader)
        .context("invalid device private key")?
        .context("device private key is empty")?;

    let roots = RootCertStore::from_iter(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());
    let config = ClientConfig::builder()
        .with_root_certificates(roots)
        .with_client_auth_cert(certificates, key)
        .context("device certificate and key do not match")?;
    Ok(Connector::Rustls(Arc::new(config)))
}
