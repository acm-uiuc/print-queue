use std::{
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, bail};
use serde::Deserialize;

#[derive(Clone, Deserialize)]
pub struct Config {
    pub endpoint: String,
    pub certificate: PathBuf,
    pub private_key: PathBuf,
    pub cups_uri: String,
    pub state_dir: PathBuf,
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let text = fs::read_to_string(path)
            .with_context(|| format!("failed to read {}", path.display()))?;
        let config: Self = toml::from_str(&text).context("invalid agent configuration")?;
        if !config.endpoint.starts_with("wss://") {
            bail!("endpoint must use wss://");
        }
        if !config.cups_uri.starts_with("http://") && !config.cups_uri.starts_with("https://") {
            bail!("cups_uri must use http:// or https://");
        }
        Ok(config)
    }
}
