export type JobState =
  | "queued"
  | "dispatched"
  | "printing"
  | "completed"
  | "failed";

export interface PrintOptions {
  copies: number;
  duplex: "none" | "long-edge" | "short-edge";
  color: boolean;
  media: string;
  pageRanges: string;
  orientation: "portrait" | "landscape";
}

export interface PrintJobRow {
  id: string;
  printer_id: string;
  r2_object_key: string;
  page_count: number;
  document_bytes: number;
  options_json: string;
  status: JobState;
  created_at: number;
}

export interface DeviceStatus {
  jobId: string;
  state: "printing" | "completed" | "failed";
  failureCode: string;
  failureMessage: string;
}

export async function activeJob(
  db: D1Database,
  printerId: string,
): Promise<PrintJobRow | null> {
  return db
    .prepare(
      `SELECT id, printer_id, r2_object_key, page_count, document_bytes,
              options_json, status, created_at
       FROM print_jobs
       WHERE printer_id = ? AND status IN ('dispatched', 'printing')
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .bind(printerId)
    .first<PrintJobRow>();
}

export async function oldestQueuedJob(
  db: D1Database,
  printerId: string,
): Promise<PrintJobRow | null> {
  return db
    .prepare(
      `SELECT id, printer_id, r2_object_key, page_count, document_bytes,
              options_json, status, created_at
       FROM print_jobs
       WHERE printer_id = ? AND status = 'queued'
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .bind(printerId)
    .first<PrintJobRow>();
}

export async function markDispatched(
  db: D1Database,
  jobId: string,
  printerId: string,
  now: number,
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE print_jobs SET status = 'dispatched', updated_at = ?
       WHERE id = ? AND printer_id = ? AND status = 'queued'
         AND NOT EXISTS (
           SELECT 1 FROM print_jobs
           WHERE printer_id = ? AND status IN ('dispatched', 'printing')
         )`,
    )
    .bind(now, jobId, printerId, printerId)
    .run();
  return result.meta.changes === 1;
}

export async function rollbackDispatch(
  db: D1Database,
  jobId: string,
  printerId: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE print_jobs SET status = 'queued', updated_at = ?
       WHERE id = ? AND printer_id = ? AND status = 'dispatched'`,
    )
    .bind(now, jobId, printerId)
    .run();
}

export async function applyDeviceStatus(
  db: D1Database,
  printerId: string,
  status: DeviceStatus,
  now: number,
): Promise<"active" | "terminal" | "ignored"> {
  const current = await db
    .prepare("SELECT status FROM print_jobs WHERE id = ? AND printer_id = ?")
    .bind(status.jobId, printerId)
    .first<{ status: JobState }>();
  if (!current) return "ignored";
  if (current.status === "completed" || current.status === "failed") {
    return "ignored";
  }

  if (status.state === "printing") {
    const result = await db
      .prepare(
        `UPDATE print_jobs SET status = 'printing', updated_at = ?
         WHERE id = ? AND printer_id = ? AND status IN ('queued', 'dispatched')`,
      )
      .bind(now, status.jobId, printerId)
      .run();
    return result.meta.changes === 1 || current.status === "printing"
      ? "active"
      : "ignored";
  }

  if (status.state === "completed") {
    const result = await db
      .prepare(
        `UPDATE print_jobs
         SET status = 'completed', completed_at = ?, updated_at = ?,
             failure_code = NULL, failure_message = NULL
         WHERE id = ? AND printer_id = ? AND status IN ('dispatched', 'printing')`,
      )
      .bind(now, now, status.jobId, printerId)
      .run();
    return result.meta.changes === 1 ? "terminal" : "ignored";
  }

  const result = await db
    .prepare(
      `UPDATE print_jobs
       SET status = 'failed', failed_at = ?, updated_at = ?,
           failure_code = ?, failure_message = ?
       WHERE id = ? AND printer_id = ? AND status IN ('dispatched', 'printing')`,
    )
    .bind(
      now,
      now,
      status.failureCode,
      status.failureMessage.slice(0, 1024),
      status.jobId,
      printerId,
    )
    .run();
  return result.meta.changes === 1 ? "terminal" : "ignored";
}
