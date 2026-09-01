import { describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
  DEVICE_CERTIFICATES: JSON.stringify({ "AA:BB:CC": "office-main" }),
}));

import { authenticatedPrinterId } from "./device-auth";

function requestWithCertificate(
  certVerified: string,
  certFingerprintSHA256: string,
): Request {
  const request = new Request("https://print-device.example.com/socket");
  Object.defineProperty(request, "cf", {
    value: {
      tlsClientAuth: { certVerified, certFingerprintSHA256 },
    },
  });
  return request;
}

describe("authenticatedPrinterId", () => {
  it("maps only a verified certificate fingerprint", () => {
    expect(
      authenticatedPrinterId(requestWithCertificate("SUCCESS", "aabbcc")),
    ).toBe("office-main");
    expect(
      authenticatedPrinterId(requestWithCertificate("FAILED", "aabbcc")),
    ).toBeNull();
    expect(
      authenticatedPrinterId(requestWithCertificate("SUCCESS", "deadbeef")),
    ).toBeNull();
  });
});
