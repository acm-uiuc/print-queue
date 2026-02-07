import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { PrintJobsContext, type PrintJob } from './PrintJobsContextBase';

const STORAGE_KEY = 'print_history_jobs';
const MAX_STORED_JOBS = 25;

function readStoredJobs(): PrintJob[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PrintJob[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function PrintJobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<PrintJob[]>(() => readStoredJobs());

  const addJob = useCallback((job: PrintJob) => {
    setJobs((prev) => {
      const next = [job, ...prev].slice(0, MAX_STORED_JOBS);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures (e.g. private mode)
      }
      return next;
    });
  }, []);

  const clearJobs = useCallback(() => {
    setJobs([]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures
    }
  }, []);

  const value = useMemo(
    () => ({
      jobs,
      addJob,
      clearJobs,
    }),
    [jobs, addJob, clearJobs]
  );

  return <PrintJobsContext.Provider value={value}>{children}</PrintJobsContext.Provider>;
}
