import type { JobStatus } from '@/pages/queueShared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export type StatsResponse = Record<string, unknown>;

export interface QueueStatusResponse {
  status: JobStatus;
  position?: number;
  jobId?: string;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  // In a real implementation, get the auth token from your auth provider
  // This is a placeholder - you'll need to integrate with your actual auth system
  const token = localStorage.getItem('auth_token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

export async function uploadDocument(formData: FormData): Promise<{ jobId: string }> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      // Don't set Content-Type for FormData, browser will set it with boundary
    },
    body: formData,
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => ({ message: 'Upload failed' }))) as { message?: string };
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
  onMessage: (data: QueueStatusResponse) => void
): EventSource {
  const token = localStorage.getItem('auth_token');
  const url = `${API_BASE_URL}/status/${jobId}/stream?token=${token || ''}`;
  
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as QueueStatusResponse;
      onMessage(data);
    } catch (error) {
      console.error('Failed to parse SSE message:', error);
    }
  };

  eventSource.onerror = (error) => {
    console.error('SSE error:', error);
    // Don't close on error, let it reconnect
  };

  return eventSource;
}
