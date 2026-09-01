import { acquireAccessToken } from "@/auth/msalConfig";

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

export async function uploadDocument(
  formData: FormData,
): Promise<{ jobId: string }> {
  const token = await acquireAccessToken();

  const response = await fetch("/api/upload", {
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
  return { jobId: payload.jobId.trim() };
}
