import { createContext } from "react";

export type PrintJobStatus = "In queue" | "Printing" | "Failed" | "Done";

export interface PrintJob {
  id: string;
  submittedAt: string;
  fileName: string;
  pages: number;
  sizeMb: number;
  durationSec: number;
  status: PrintJobStatus;
}

export interface PrintJobsContextValue {
  jobs: PrintJob[];
  addJob: (job: PrintJob) => void;
  clearJobs: () => void;
  updateJobStatus: (jobId: string, status: PrintJobStatus) => void;
}

export const PrintJobsContext = createContext<
  PrintJobsContextValue | undefined
>(undefined);
