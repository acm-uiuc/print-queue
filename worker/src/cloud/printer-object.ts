import { DurableObject } from "cloudflare:workers";
import { AwsClient } from "aws4fetch";
import {
  activeJob,
  applyDeviceStatus,
  markDispatched,
  oldestQueuedJob,
  rollbackDispatch,
  type PrintJobRow,
  type PrintOptions,
} from "./d1";
import { decodeDeviceStatus, encodePrintJob } from "./protocol";

export interface DispatchEnv extends Env {
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}

interface SocketAttachment {
  printerId: string;
}

const PRESIGN_TTL_SECONDS = 15 * 60;

export class PrinterObject extends DurableObject<DispatchEnv> {
  async fetch(request: Request): Promise<Response> {
    const printerId = request.headers.get("X-Printer-Id")?.trim();
    if (!printerId) return new Response("Forbidden", { status: 403 });
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    for (const socket of this.ctx.getWebSockets("device")) {
      socket.close(1012, "Replaced by a new device connection");
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.serializeAttachment({ printerId } satisfies SocketAttachment);
    this.ctx.acceptWebSocket(server, ["device"]);
    await this.dispatchNext(printerId, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async notifyJob(printerId: string, _jobId: string): Promise<void> {
    await this.dispatchNext(printerId);
  }

  async webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (typeof message === "string") {
      socket.close(1003, "Binary frames required");
      return;
    }
    const attachment = socket.deserializeAttachment() as SocketAttachment;
    try {
      const status = decodeDeviceStatus(message);
      const transition = await applyDeviceStatus(
        this.env.PRINT_DB,
        attachment.printerId,
        status,
        Date.now(),
      );
      if (transition === "terminal") {
        await this.dispatchNext(attachment.printerId, socket);
      }
    } catch {
      socket.close(1007, "Invalid status frame");
    }
  }


  webSocketError(socket: WebSocket): void {
    socket.close(1011, "WebSocket error");
  }

  private async dispatchNext(
    printerId: string,
    preferredSocket?: WebSocket,
  ): Promise<void> {
    const socket =
      preferredSocket?.readyState === WebSocket.OPEN
        ? preferredSocket
        : this.ctx
            .getWebSockets("device")
            .find((candidate) => candidate.readyState === WebSocket.OPEN);
    if (!socket) return;

    let job = await activeJob(this.env.PRINT_DB, printerId);
    let newlyClaimed = false;
    if (!job) {
      job = await oldestQueuedJob(this.env.PRINT_DB, printerId);
      if (!job) return;
    }

    const { url, expiresAtMs } = await this.presign(job.r2_object_key);
    if (job.status === "queued") {
      newlyClaimed = await markDispatched(
        this.env.PRINT_DB,
        job.id,
        printerId,
        Date.now(),
      );
      if (!newlyClaimed) return;
    }

    try {
      socket.send(
        encodePrintJob({
          id: job.id,
          downloadUrl: url,
          expiresAtMs,
          pageCount: job.page_count,
          documentBytes: job.document_bytes,
          options: this.parseOptions(job),
        }),
      );
    } catch (error: unknown) {
      if (newlyClaimed) {
        await rollbackDispatch(
          this.env.PRINT_DB,
          job.id,
          printerId,
          Date.now(),
        );
      }
      throw error;
    }
  }

  private parseOptions(job: PrintJobRow): PrintOptions {
    const value: unknown = JSON.parse(job.options_json);
    if (!value || typeof value !== "object") {
      throw new Error("Invalid print options");
    }
    const options = value as Record<string, unknown>;
    const copies = options.copies;
    const color = options.color;
    const media = options.media;
    const pageRanges = options.pageRanges;
    const duplex = options.duplex;
    const orientation = options.orientation;
    if (
      typeof copies !== "number" ||
      !Number.isInteger(copies) ||
      typeof color !== "boolean" ||
      typeof media !== "string" ||
      typeof pageRanges !== "string" ||
      (duplex !== "none" &&
        duplex !== "long-edge" &&
        duplex !== "short-edge") ||
      (orientation !== "portrait" && orientation !== "landscape")
    ) {
      throw new Error("Invalid print options");
    }
    return { copies, color, media, pageRanges, duplex, orientation };
  }

  private async presign(
    objectKey: string,
  ): Promise<{ url: string; expiresAtMs: number }> {
    const url = new URL(
      `https://${this.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    );
    url.pathname = `/${this.env.R2_BUCKET_NAME}/${objectKey
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    url.searchParams.set("X-Amz-Expires", String(PRESIGN_TTL_SECONDS));
    const signer = new AwsClient({
      accessKeyId: this.env.R2_ACCESS_KEY_ID,
      secretAccessKey: this.env.R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    });
    const request = await signer.sign(url, {
      method: "GET",
      aws: { signQuery: true },
    });
    return {
      url: request.url,
      expiresAtMs: Date.now() + PRESIGN_TTL_SECONDS * 1000,
    };
  }
}
