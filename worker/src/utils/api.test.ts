import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getJobStatus, subscribeToJobStatus, uploadDocument } from "./api";

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
    await expect(
      uploadDocument("https://print.example/api", new FormData()),
    ).resolves.toEqual({ jobId: "job-1" });
  });
});

describe("getJobStatus", () => {
  it("encodes the job ID and validates the response", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ status: "In queue", position: 2 }),
    );

    await expect(
      getJobStatus("https://print.example/api/", "job/with spaces"),
    ).resolves.toEqual({ status: "In queue", position: 2 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://print.example/api/status/job%2Fwith%20spaces",
      {
        headers: {
          Accept: "application/json",
          Authorization: "Bearer access-token",
        },
      },
    );
  });

  it("rejects malformed status payloads", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ status: "unknown" }));
    await expect(
      getJobStatus("https://print.example/api", "job-1"),
    ).rejects.toThrow("invalid job status");
  });

  it("rejects inherited object keys as statuses", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ status: "constructor" }));
    await expect(
      getJobStatus("https://print.example/api", "job-1"),
    ).rejects.toThrow("invalid job status");
  });
});

describe("subscribeToJobStatus", () => {
  it("polls once immediately, suppresses duplicates, and stops at terminal status", async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(Response.json({ status: "In queue", position: 2 }))
      .mockResolvedValueOnce(Response.json({ status: "In queue", position: 2 }))
      .mockResolvedValueOnce(Response.json({ status: "Printing" }))
      .mockResolvedValueOnce(Response.json({ status: "Done" }));
    const onMessage = vi.fn();

    const subscription = subscribeToJobStatus(
      "https://print.example/api",
      "job-1",
      onMessage,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(onMessage).toHaveBeenLastCalledWith({ status: "Printing" });

    await vi.advanceTimersByTimeAsync(3000);
    expect(onMessage).toHaveBeenLastCalledWith({ status: "Done" });
    expect(fetchMock).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(9000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    subscription.close();
  });
});
