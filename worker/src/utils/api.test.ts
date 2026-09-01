import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadDocument } from "./api";

vi.mock("@/auth/msalConfig", () => ({
  acquireAccessToken: vi.fn(async () => "access-token"),
}));

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("uploadDocument", () => {
  it("normalizes the returned job ID", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ jobId: " job-1 " }));
    await expect(uploadDocument(new FormData())).resolves.toEqual({
      jobId: "job-1",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/upload", expect.any(Object));
  });
});

