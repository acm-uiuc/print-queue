import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { authenticatedPrinterId } from "@/server/device-auth";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {

  const printerId = authenticatedPrinterId(request);
  if (!printerId) {
    return new Response("Valid device certificate required", { status: 401 });
  }
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket upgrade required", { status: 426 });
  }

  const headers = new Headers(request.headers);
  headers.set("X-Printer-Id", printerId);
  const internalRequest = new Request(request, { headers });
  return env.PRINTERS.getByName(`printer:${printerId}`).fetch(internalRequest);
};
