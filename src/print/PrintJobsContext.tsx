import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  PrintJobsContext,
  type PrintJob,
  type PrintJobStatus,
} from "./PrintJobsContextBase";

const STORAGE_KEY = "print_history_jobs";
const MAX_STORED_JOBS = 25;
const PRINT_JOB_STATUSES: Record<PrintJobStatus, true> = {
  "In queue": true,
  Printing: true,
  Failed: true,
  Done: true,
};

function isPrintJob(value: unknown): value is PrintJob {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<PrintJob>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.submittedAt === "string" &&
    Number.isFinite(Date.parse(candidate.submittedAt)) &&
    typeof candidate.fileName === "string" &&
    candidate.fileName.length > 0 &&
    typeof candidate.pages === "number" &&
    Number.isInteger(candidate.pages) &&
    candidate.pages >= 0 &&
    typeof candidate.sizeMb === "number" &&
    Number.isFinite(candidate.sizeMb) &&
    candidate.sizeMb >= 0 &&
    typeof candidate.durationSec === "number" &&
    Number.isFinite(candidate.durationSec) &&
    candidate.durationSec >= 0 &&
    typeof candidate.status === "string" &&
    candidate.status in PRINT_JOB_STATUSES
  );
}

function readStoredJobs(): PrintJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(isPrintJob).slice(0, MAX_STORED_JOBS)
      : [];
  } catch {
    return [];
  }
}

function persistJobs(jobs: PrintJob[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // The in-memory history remains usable when storage is unavailable.
  }
}

export function PrintJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<PrintJob[]>(readStoredJobs);

  const addJob = useCallback((job: PrintJob) => {
    setJobs((previous) => {
      const next = [
        job,
        ...previous.filter((candidate) => candidate.id !== job.id),
      ].slice(0, MAX_STORED_JOBS);
      persistJobs(next);
      return next;
    });
  }, []);

  const updateJobStatus = useCallback(
    (jobId: string, status: PrintJobStatus) => {
      setJobs((previous) => {
        let changed = false;
        const next = previous.map((job) => {
          if (job.id !== jobId || job.status === status) return job;
          changed = true;
          return { ...job, status };
        });
        if (!changed) return previous;
        persistJobs(next);
        return next;
      });
    },
    [],
  );

  const clearJobs = useCallback(() => {
    setJobs([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The in-memory history is already cleared.
    }
  }, []);

  const value = useMemo(
    () => ({
      jobs,
      addJob,
      clearJobs,
      updateJobStatus,
    }),
    [jobs, addJob, clearJobs, updateJobStatus],
  );

  return (
    <PrintJobsContext.Provider value={value}>
      {children}
    </PrintJobsContext.Provider>
  );
}
