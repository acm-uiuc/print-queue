import { DEVICE_CERTIFICATES } from "astro:env/server";

export function authenticatedPrinterId(request: Request): string | null {
  const clientAuth: unknown = request.cf?.tlsClientAuth;
  if (
    !clientAuth ||
    typeof clientAuth !== "object" ||
    !(("certVerified" in clientAuth) && ("certFingerprintSHA256" in clientAuth)) ||
    clientAuth.certVerified !== "SUCCESS" ||
    typeof clientAuth.certFingerprintSHA256 !== "string" ||
    !clientAuth.certFingerprintSHA256
  ) {
    return null;
  }

  let configured: unknown;
  try {
    configured = JSON.parse(DEVICE_CERTIFICATES);
  } catch {
    return null;
  }
  if (!configured || typeof configured !== "object" || Array.isArray(configured)) {
    return null;
  }

  const fingerprint = clientAuth.certFingerprintSHA256
    .replaceAll(":", "")
    .toUpperCase();
  for (const [configuredFingerprint, printerId] of Object.entries(configured)) {
    if (
      configuredFingerprint.replaceAll(":", "").toUpperCase() === fingerprint &&
      typeof printerId === "string" &&
      printerId.length > 0
    ) {
      return printerId;
    }
  }
  return null;
}
