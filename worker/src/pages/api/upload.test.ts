import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const fakes = vi.hoisted(() => {
  const events: string[] = [];
  return {
    events,
    put: vi.fn(async () => {
      events.push("r2");
    }),
    remove: vi.fn(async () => undefined),
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        run: vi.fn(async () => {
          events.push(sql.includes("INSERT INTO") ? "d1" : "update");
          return { success: true };
        }),
      })),
    })),
    send: vi.fn(async () => {
      events.push("queue");
    }),
  };
});

vi.mock("astro:env/server", () => ({ DEFAULT_PRINTER_ID: "office-main" }));
vi.mock("cloudflare:workers", () => ({
  env: {
    DOCUMENTS: { put: fakes.put, delete: fakes.remove },
    PRINT_DB: { prepare: fakes.prepare },
    PRINT_QUEUE: { send: fakes.send },
  },
}));
vi.mock("@/server/auth", () => ({
  authenticateUser: vi.fn(async () => "user-1"),
}));

import { POST } from "./upload";

beforeEach(() => {
  fakes.events.length = 0;
  vi.clearAllMocks();
});

describe("POST /api/upload", () => {
  it("stores the exact PDF before the ledger row and Queue wakeup", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const source = await pdf.save();
    const bytes = new Uint8Array(source.byteLength);
    bytes.set(source);
    const form = new FormData();
    form.set(
      "file",
      new File([bytes.buffer], "document.pdf", { type: "application/pdf" }),
    );
    form.set("copies", "1");
    form.set("color", "false");
    form.set("doubleSided", "true");
    form.set("flipOnLongSide", "true");
    form.set("orientation", "portrait");
    form.set("media", "Letter");

    const response = await POST({
      request: new Request("https://print.example/api/upload", {
        method: "POST",
        body: form,
      }),
    } as Parameters<typeof POST>[0]);

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      jobId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(fakes.events).toEqual(["r2", "d1", "queue"]);
    expect(fakes.put).toHaveBeenCalledWith(
      expect.stringMatching(/^print-jobs\/.+\/document\.pdf$/),
      expect.any(Uint8Array),
      { httpMetadata: { contentType: "application/pdf" } },
    );
    expect(fakes.send).toHaveBeenCalledWith(expect.any(ArrayBuffer));
  });
});
