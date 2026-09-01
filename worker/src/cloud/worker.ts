import { decodeQueueJob } from "./protocol";
import { PrinterObject, type DispatchEnv } from "./printer-object";

interface ExpiredJob {
  id: string;
  r2_object_key: string;
}

export { PrinterObject };

export default {
  async queue(
    batch: MessageBatch<ArrayBuffer>,
    env: DispatchEnv,
  ): Promise<void> {
    for (const message of batch.messages) {
      let job: { jobId: string; printerId: string };
      try {
        job = decodeQueueJob(message.body);
      } catch (error: unknown) {
        console.error("Discarding invalid print Queue message", {
          messageId: message.id,
          error: error instanceof Error ? error.message : "unknown error",
        });
        message.ack();
        continue;
      }

      try {
        const printer = env.PRINTERS.getByName(`printer:${job.printerId}`) as
          DurableObjectStub<PrinterObject>;
        await printer.notifyJob(job.printerId, job.jobId);
        message.ack();
      } catch (error: unknown) {
        console.error("Printer notification failed", {
          messageId: message.id,
          printerId: job.printerId,
          error: error instanceof Error ? error.message : "unknown error",
        });
        message.retry();
      }
    }
  },

  async scheduled(_controller: ScheduledController, env: DispatchEnv): Promise<void> {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (let batch = 0; batch < 10; batch += 1) {
      const expired = await env.PRINT_DB.prepare(
        `SELECT id, r2_object_key
         FROM print_jobs
         WHERE created_at < ?
         ORDER BY created_at ASC
         LIMIT 100`,
      )
        .bind(cutoff)
        .all<ExpiredJob>();
      if (expired.results.length === 0) return;

      for (const job of expired.results) {
        try {
          await env.DOCUMENTS.delete(job.r2_object_key);
          await env.PRINT_DB.prepare("DELETE FROM print_jobs WHERE id = ?")
            .bind(job.id)
            .run();
        } catch (error: unknown) {
          console.error("Print job retention cleanup failed", {
            jobId: job.id,
            error: error instanceof Error ? error.message : "unknown error",
          });
        }
      }
      if (expired.results.length < 100) return;
    }
  },
} satisfies ExportedHandler<DispatchEnv, ArrayBuffer>;
