import { useContext } from 'react';
import { PrintJobsContext } from './PrintJobsContextBase';

export function usePrintJobs() {
  const context = useContext(PrintJobsContext);
  if (!context) {
    throw new Error('usePrintJobs must be used within a PrintJobsProvider');
  }
  return context;
}
