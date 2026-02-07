export type JobStatus = 'In queue' | 'Printing' | 'Failed' | 'Done';

export const STATUS_BADGE_SHADOWS: Record<JobStatus, string> = {
  'In queue': '0 18px 32px rgba(0, 83, 179, 0.25)',
  Printing: '0 18px 32px rgba(63, 81, 181, 0.2)',
  Failed: '0 18px 32px rgba(231, 76, 60, 0.2)',
  Done: 'none',
};
