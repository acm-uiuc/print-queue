import { acquireAccessToken } from "@/auth/msalConfig";
import type { JobStatus } from "@/screens/queueShared";

const STATUS_POLL_INTERVAL_MS = 3000;
const JOB_STATUSES: Record<JobStatus, true> = {
  Done: true,
  Failed: true,
  Printing: true,
  "In queue": true,
};
const TERMINAL_STATUSES: Partial<Record<JobStatus, true>> = {
  Done: true,
  Failed: true,
};

export interface QueueStatusResponse {
  status: JobStatus;
  position?: number;
  jobId?: string;
}

export interface StatusSubscription {
  close: () => void;
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message;
  }
  return fallback;
}

function parseQueueStatus(payload: unknown): QueueStatusResponse {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("status" in payload) ||
    typeof payload.status !== "string" ||
    !(payload.status in JOB_STATUSES)
  ) {
    throw new Error("The print service returned an invalid job status.");
  }

  const response: QueueStatusResponse = {
    status: payload.status as JobStatus,
  };
  if (
    "position" in payload &&
    typeof payload.position === "number" &&
    Number.isInteger(payload.position) &&
    payload.position >= 0
  ) {
    response.position = payload.position;
  }
  if ("jobId" in payload && typeof payload.jobId === "string") {
    response.jobId = payload.jobId;
  }
  return response;
}

export async function uploadDocument(
  apiBaseUrl: string,
  formData: FormData,
): Promise<{ jobId: string }> {
  const token = await acquireAccessToken();
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("The print service API URL is not configured.");
  }

  const response = await fetch(`${baseUrl}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  if (!response.ok) {
    throw new Error(
      await readErrorMessage(response, "Failed to upload document"),
    );
  }

  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("jobId" in payload) ||
    typeof payload.jobId !== "string" ||
    !payload.jobId.trim()
  ) {
    throw new Error("The print service did not return a job ID.");
  }
  return { jobId: payload.jobId };
}

export async function getJobStatus(
  apiBaseUrl: string,
  jobId: string,
): Promise<QueueStatusResponse> {
  const token = await acquireAccessToken();
  const baseUrl = apiBaseUrl.replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("The print service API URL is not configured.");
  }

  const response = await fetch(
    `${baseUrl}/status/${encodeURIComponent(jobId)}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Failed to fetch status"));
  }
  return parseQueueStatus(await response.json());
}

export function subscribeToJobStatus(
  apiBaseUrl: string,
  jobId: string,
  onMessage: (data: QueueStatusResponse) => void,
  onError?: (error: unknown) => void,
): StatusSubscription {
  let closed = false;
  let pollTimer: number | undefined;
  let lastPayload = "";

  const poll = async () => {
    if (closed) return;

    try {
      const data = await getJobStatus(apiBaseUrl, jobId);
      if (closed) return;

      const serialized = JSON.stringify(data);
      if (serialized !== lastPayload) {
        lastPayload = serialized;
        onMessage(data);
      }
      if (TERMINAL_STATUSES[data.status]) {
        closed = true;
        return;
      }
    } catch (error: unknown) {
      if (!closed) onError?.(error);
    }

    if (!closed) {
      pollTimer = window.setTimeout(poll, STATUS_POLL_INTERVAL_MS);
    }
  };

  void poll();

  return {
    close: () => {
      closed = true;
      window.clearTimeout(pollTimer);
    },
  };
}
