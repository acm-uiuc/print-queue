import { acquireAccessToken } from '@/auth/msalConfig';
import type { JobStatus } from '@/pages/queueShared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
const STATUS_POLL_INTERVAL_MS = 3000;
const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set(['Done', 'Failed']);

export type StatsResponse = Record<string, unknown>;

export interface QueueStatusResponse {
  status: JobStatus;
  position?: number;
  jobId?: string;
}

export interface StatusSubscription {
  close: () => void;
}

async function getAuthHeaders(contentType: string = 'application/json'): Promise<HeadersInit> {
  const token = await acquireAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': contentType,
  };
}

export async function uploadDocument(formData: FormData): Promise<{ jobId: string }> {
  const token = await acquireAccessToken();

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: 'Upload failed' }))) as {
      message?: string;
    };
    throw new Error(error.message || 'Failed to upload document');
  }

  return response.json();
}

export async function getStats(): Promise<StatsResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/stats`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: 'Failed to fetch stats' }))) as {
      message?: string;
    };
    throw new Error(error.message || 'Failed to fetch stats');
  }

  return response.json();
}

export async function getJobStatus(jobId: string): Promise<QueueStatusResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${API_BASE_URL}/status/${jobId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: 'Failed to fetch status' }))) as {
      message?: string;
    };
    throw new Error(error.message || 'Failed to fetch status');
  }

  return response.json();
}

export function subscribeToJobStatus(
  jobId: string,
  onMessage: (data: QueueStatusResponse) => void,
  onError?: (error: unknown) => void
): StatusSubscription {
  let closed = false;
  let pollTimer: number | undefined;
  let lastPayload = '';

  const poll = async () => {
    if (closed) return;

    try {
      const data = await getJobStatus(jobId);
      const serialized = JSON.stringify(data);
      if (serialized !== lastPayload) {
        lastPayload = serialized;
        onMessage(data);
      }

      if (TERMINAL_STATUSES.has(data.status)) {
        closed = true;
        return;
      }
    } catch (error: unknown) {
      onError?.(error);
    }

    if (!closed && typeof window !== 'undefined') {
      pollTimer = window.setTimeout(poll, STATUS_POLL_INTERVAL_MS);
    }
  };

  void poll();

  return {
    close: () => {
      closed = true;
      if (pollTimer !== undefined) {
        window.clearTimeout(pollTimer);
      }
    },
  };
}
