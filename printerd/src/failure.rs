#[derive(Debug)]
pub struct Failure {
    pub code: &'static str,
    pub message: String,
}

impl Failure {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        let mut message = message.into();
        if message.len() > 1024 {
            message.truncate(1024);
        }
        Self { code, message }
    }
    pub fn internal(error: impl std::fmt::Display) -> Self {
        Self::new("internal_error", error.to_string())
    }

    pub fn download(error: impl std::fmt::Display) -> Self {
        Self::new("download_failed", error.to_string())
    }
}
