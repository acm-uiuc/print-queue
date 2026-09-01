import { describe, expect, it } from "vitest";
import { decodeQueueJob, encodeQueueJob } from "./protocol";

describe("QueueJob Cap'n Proto codec", () => {
  it("round trips the immutable job and printer identities", () => {
    const job = { jobId: "019-job", printerId: "office-main" };
    expect(decodeQueueJob(encodeQueueJob(job))).toEqual(job);
  });
});
