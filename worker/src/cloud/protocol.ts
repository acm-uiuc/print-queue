import { Message } from "capnp-ts";
import {
  Envelope,
  Envelope_Which,
  JobStatus_State,
  PrintOptions_Duplex,
  PrintOptions_Orientation,
} from "@/generated/device.capnp.js";
import { QueueJob } from "@/generated/queue.capnp.js";
import type { DeviceStatus, PrintOptions } from "./d1";

const FAILURE_CODES = new Set([
  "download_failed",
  "download_expired",
  "invalid_document",
  "cups_rejected",
  "printer_unavailable",
  "print_failed",
  "internal_error",
]);

function exactBuffer(value: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

export function encodeQueueJob(job: {
  jobId: string;
  printerId: string;
}): ArrayBuffer {
  const message = new Message();
  message.initRoot(QueueJob).set(job);
  return message.toPackedArrayBuffer();
}

export function decodeQueueJob(
  body: ArrayBuffer | ArrayBufferView,
): { jobId: string; printerId: string } {
  const job = new Message(exactBuffer(body)).getRoot(QueueJob);
  const jobId = job.getJobId();
  const printerId = job.getPrinterId();
  if (!jobId || !printerId || jobId.length > 64 || printerId.length > 128) {
    throw new Error("Invalid QueueJob identity");
  }
  return { jobId, printerId };
}

export function encodePrintJob(job: {
  id: string;
  downloadUrl: string;
  expiresAtMs: number;
  pageCount: number;
  documentBytes: number;
  options: PrintOptions;
}): ArrayBuffer {
  const message = new Message();
  const printJob = message.initRoot(Envelope).initPrintJob();
  printJob.setJobId(job.id);
  printJob.setDownloadUrl(job.downloadUrl);
  printJob.setExpiresAtMs(BigInt(job.expiresAtMs));
  printJob.setPageCount(job.pageCount);
  printJob.setDocumentBytes(BigInt(job.documentBytes));
  const options = printJob.initOptions();
  options.setCopies(job.options.copies);
  options.setDuplex(
    job.options.duplex === "long-edge"
      ? PrintOptions_Duplex.LONG_EDGE
      : job.options.duplex === "short-edge"
        ? PrintOptions_Duplex.SHORT_EDGE
        : PrintOptions_Duplex.NONE,
  );
  options.setColor(job.options.color);
  options.setMedia(job.options.media);
  options.setPageRanges(job.options.pageRanges);
  options.setOrientation(
    job.options.orientation === "landscape"
      ? PrintOptions_Orientation.LANDSCAPE
      : PrintOptions_Orientation.PORTRAIT,
  );
  return message.toPackedArrayBuffer();
}

export function decodeDeviceStatus(
  body: ArrayBuffer | ArrayBufferView,
): DeviceStatus {
  const envelope = new Message(exactBuffer(body)).getRoot(Envelope);
  if (envelope.which() !== Envelope_Which.JOB_STATUS) {
    throw new Error("Expected JobStatus envelope");
  }
  const status = envelope.getJobStatus();
  const jobId = status.getJobId();
  if (!jobId || jobId.length > 64) throw new Error("Invalid job ID");

  const stateValue = status.getState();
  const state =
    stateValue === JobStatus_State.PRINTING
      ? "printing"
      : stateValue === JobStatus_State.COMPLETED
        ? "completed"
        : stateValue === JobStatus_State.FAILED
          ? "failed"
          : null;
  if (!state) throw new Error("Invalid job state");

  const failureCode = status.getFailureCode();
  const failureMessage = status.getFailureMessage().slice(0, 1024);
  if (state === "failed" && !FAILURE_CODES.has(failureCode)) {
    throw new Error("Invalid failure code");
  }
  return { jobId, state, failureCode, failureMessage };
}
