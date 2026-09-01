import type { APIRoute } from "astro";
import { DEFAULT_PRINTER_ID } from "astro:env/server";
import { env } from "cloudflare:workers";
import { PDFDocument } from "pdf-lib";
import { v7 as uuidv7 } from "uuid";
import { encodeQueueJob } from "@/cloud/protocol";
import { validatePageRange } from "@/print/pageRange";
import { authenticateUser } from "@/server/auth";

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let userId: string;
  try {
    userId = await authenticateUser(request);
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    throw error;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ message: "Invalid multipart form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ message: "A PDF file is required" }, { status: 400 });
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return Response.json({ message: "The PDF must be 20 MB or smaller" }, { status: 413 });
  }

  const copies = Number(form.get("copies"));
  if (!Number.isInteger(copies) || copies < 1 || copies > 10) {
    return Response.json({ message: "Copies must be an integer from 1 to 10" }, { status: 400 });
  }
  const colorValue = form.get("color");
  const doubleSidedValue = form.get("doubleSided");
  const flipOnLongSideValue = form.get("flipOnLongSide");
  if (
    (colorValue !== "true" && colorValue !== "false") ||
    (doubleSidedValue !== "true" && doubleSidedValue !== "false") ||
    (flipOnLongSideValue !== "true" && flipOnLongSideValue !== "false")
  ) {
    return Response.json({ message: "Invalid print options" }, { status: 400 });
  }
  const orientation = form.get("orientation");
  const media = form.get("media");
  if (orientation !== "portrait" && orientation !== "landscape") {
    return Response.json({ message: "Invalid orientation" }, { status: 400 });
  }
  if (media !== "Letter" && media !== "A4") {
    return Response.json({ message: "Invalid paper size" }, { status: 400 });
  }

  const document = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(document.subarray(0, 5)) !== "%PDF-") {
    return Response.json({ message: "The uploaded file is not a PDF" }, { status: 400 });
  }

  let pageCount: number;
  try {
    pageCount = (await PDFDocument.load(document)).getPageCount();
  } catch {
    return Response.json({ message: "The uploaded PDF is invalid" }, { status: 400 });
  }
  if (pageCount < 1) {
    return Response.json({ message: "The PDF has no printable pages" }, { status: 400 });
  }

  const pageRange = validatePageRange(String(form.get("pageRange") ?? ""), pageCount);
  if (pageRange.error) {
    return Response.json({ message: pageRange.error }, { status: 400 });
  }
  const printerId = DEFAULT_PRINTER_ID.trim();
  if (!printerId) {
    return Response.json({ message: "No printer is configured" }, { status: 503 });
  }

  const id = uuidv7();
  const objectKey = `print-jobs/${id}/document.pdf`;
  const now = Date.now();
  const options = {
    copies,
    duplex:
      doubleSidedValue === "false"
        ? ("none" as const)
        : flipOnLongSideValue === "true"
          ? ("long-edge" as const)
          : ("short-edge" as const),
    color: colorValue === "true",
    media,
    pageRanges: pageRange.normalized,
    orientation,
  };

  try {
    await env.DOCUMENTS.put(objectKey, document, {
      httpMetadata: { contentType: "application/pdf" },
    });
  } catch {
    return Response.json({ message: "Failed to store the PDF" }, { status: 503 });
  }

  try {
    await env.PRINT_DB.prepare(
      `INSERT INTO print_jobs (
        id, user_id, printer_id, r2_object_key, page_count, document_bytes,
        options_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
    )
      .bind(
        id,
        userId,
        printerId,
        objectKey,
        pageCount,
        document.byteLength,
        JSON.stringify(options),
        now,
        now,
      )
      .run();
  } catch {
    try {
      await env.DOCUMENTS.delete(objectKey);
    } catch (cleanupError: unknown) {
      console.error("Failed to delete orphaned print document", {
        objectKey,
        error:
          cleanupError instanceof Error
            ? cleanupError.message
            : "unknown error",
      });
    }
    return Response.json(
      { message: "Failed to record the print job" },
      { status: 503 },
    );
  }

  try {
    await env.PRINT_QUEUE.send(encodeQueueJob({ jobId: id, printerId }));
  } catch {
    const failedAt = Date.now();
    await env.PRINT_DB.prepare(
      `UPDATE print_jobs
       SET status = 'failed', failed_at = ?, updated_at = ?,
           failure_code = 'internal_error', failure_message = 'Queue dispatch failed'
       WHERE id = ? AND status = 'queued'`,
    )
      .bind(failedAt, failedAt, id)
      .run();
    return Response.json({ message: "Failed to dispatch the print job" }, { status: 503 });
  }

  return Response.json({ jobId: id }, { status: 202 });
};
