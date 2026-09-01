use std::{
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

const RETENTION: Duration = Duration::from_secs(8 * 24 * 60 * 60);

#[derive(Clone, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum JobState {
    Accepted,
    Downloaded,
    Submitted { cups_job_id: i32 },
    Completed,
    Failed { code: String, message: String },
}

pub struct Journal {
    jobs: PathBuf,
    spool: PathBuf,
}

impl Journal {
    pub fn open(state_dir: &Path) -> Result<Self> {
        let jobs = state_dir.join("jobs");
        let spool = state_dir.join("spool");
        fs::create_dir_all(&jobs).context("failed to create job journal")?;
        fs::create_dir_all(&spool).context("failed to create spool directory")?;
        let journal = Self { jobs, spool };
        journal.cleanup()?;
        Ok(journal)
    }

    pub fn load(&self, job_id: &str) -> Result<Option<JobState>> {
        let path = self.marker_path(job_id);
        let bytes = match fs::read(&path) {
            Ok(bytes) => bytes,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(error) => {
                return Err(error).with_context(|| format!("failed to read {}", path.display()));
            }
        };
        let state: JobState = serde_json::from_slice(&bytes).context("invalid job marker")?;
        Ok(Some(state))
    }

    pub fn save(&self, job_id: &str, state: JobState) -> Result<()> {
        let bytes = serde_json::to_vec(&state)?;
        let path = self.marker_path(job_id);
        let temporary = self.jobs.join(format!(".{job_id}.tmp"));
        let mut file = File::create(&temporary)
            .with_context(|| format!("failed to create {}", temporary.display()))?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        fs::rename(&temporary, &path)?;
        File::open(&self.jobs)?.sync_all()?;
        Ok(())
    }

    pub fn spool_path(&self, job_id: &str) -> PathBuf {
        self.spool.join(format!("{job_id}.pdf"))
    }

    fn marker_path(&self, job_id: &str) -> PathBuf {
        self.jobs.join(format!("{job_id}.json"))
    }

    fn cleanup(&self) -> Result<()> {
        let cutoff = SystemTime::now()
            .checked_sub(RETENTION)
            .unwrap_or(SystemTime::UNIX_EPOCH);
        for entry in fs::read_dir(&self.jobs)?.take(256) {
            let entry = entry?;
            if entry.metadata()?.modified()? >= cutoff {
                continue;
            }
            let bytes = match fs::read(entry.path()) {
                Ok(bytes) => bytes,
                Err(_) => continue,
            };
            let terminal = serde_json::from_slice::<JobState>(&bytes)
                .map(|state| matches!(state, JobState::Completed | JobState::Failed { .. }))
                .unwrap_or(false);
            if terminal {
                let _ = fs::remove_file(entry.path());
            }
        }
        for entry in fs::read_dir(&self.spool)?.take(256) {
            let entry = entry?;
            if entry.metadata()?.modified()? < cutoff {
                let _ = fs::remove_file(entry.path());
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips_submitted_marker() {
        let root = std::env::temp_dir().join(format!("printerd-journal-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let journal = Journal::open(&root).unwrap();
        journal
            .save("019-job", JobState::Submitted { cups_job_id: 42 })
            .unwrap();
        assert!(matches!(
            journal.load("019-job").unwrap(),
            Some(JobState::Submitted { cups_job_id: 42 })
        ));
        fs::remove_dir_all(root).unwrap();
    }
}
