import {
  AAD_API_AUDIENCE,
  AAD_AUTHORITY,
  AAD_CLIENT_ID,
  AAD_TENANT_ID,
} from "astro:env/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
const authority = (
  AAD_AUTHORITY ||
  (AAD_TENANT_ID
    ? `https://login.microsoftonline.com/${AAD_TENANT_ID}`
    : "")
).replace(/\/+$/, "");
const audience = AAD_API_AUDIENCE || AAD_CLIENT_ID;
const jwks = authority
  ? createRemoteJWKSet(new URL(`${authority}/discovery/v2.0/keys`))
  : null;


export async function authenticateUser(request: Request): Promise<string> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Response("Missing bearer token", { status: 401 });
  }

  if (!jwks || !audience) {
    throw new Response("Authentication is not configured", { status: 503 });
  }

  try {
    const { payload } = await jwtVerify(
      authorization.slice("Bearer ".length),
      jwks,
      {
        audience,
        issuer: `${authority}/v2.0`,
      },
    );
    const userId = payload.oid ?? payload.sub;
    if (typeof userId !== "string" || !userId) {
      throw new Error("Token has no stable user identifier");
    }
    return userId;
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    throw new Response("Invalid bearer token", { status: 401 });
  }
}
