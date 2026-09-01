import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type Configuration,
} from "@azure/msal-browser";
import type { RuntimeConfig } from "@/runtimeConfig";

export interface MsalSetup {
  authConfigError: string | null;
  instance: PublicClientApplication;
  requestedScopes: string[];
  initialize: () => Promise<void>;
}

interface CachedSetup extends MsalSetup {
  key: string;
  acquireAccessToken: () => Promise<string>;
}

let activeSetup: CachedSetup | null = null;

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function resolveBrowserUrl(value: string, fallbackPath: string): string {
  const candidate = value || fallbackPath;
  if (/^https?:\/\//i.test(candidate) || typeof window === "undefined") {
    return candidate;
  }
  return new URL(candidate, window.location.origin).toString();
}

function parseScopes(value: string): string[] {
  const scopes = value
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  return scopes.length > 0 ? scopes : ["User.Read"];
}

export function configureMsal(config: RuntimeConfig): MsalSetup {
  const key = JSON.stringify({
    clientId: config.aadClientId,
    tenantId: config.aadTenantId,
    authority: config.aadAuthority,
    redirectUri: config.aadRedirectUri,
    postLogoutRedirectUri: config.aadPostLogoutRedirectUri,
    scopes: config.aadScopes,
  });
  if (activeSetup?.key === key) {
    return activeSetup;
  }

  const clientId = trim(config.aadClientId);
  const tenantId = trim(config.aadTenantId);
  const explicitAuthority = trim(config.aadAuthority);
  const authority =
    explicitAuthority ||
    (tenantId ? `https://login.microsoftonline.com/${tenantId}` : "");
  const configErrors: string[] = [];
  if (!clientId) configErrors.push("AAD_CLIENT_ID");
  if (!authority) configErrors.push("AAD_TENANT_ID or AAD_AUTHORITY");

  const authConfigError =
    configErrors.length > 0
      ? `Missing required auth config: ${configErrors.join(", ")}.`
      : null;
  const requestedScopes = parseScopes(config.aadScopes);
  const configuration: Configuration = {
    auth: {
      clientId: clientId || "00000000-0000-0000-0000-000000000000",
      authority: authority || "https://login.microsoftonline.com/organizations",
      redirectUri: resolveBrowserUrl(trim(config.aadRedirectUri), "/"),
      postLogoutRedirectUri: resolveBrowserUrl(
        trim(config.aadPostLogoutRedirectUri),
        "/login",
      ),
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
  };
  const instance = new PublicClientApplication(configuration);
  let initializePromise: Promise<void> | null = null;

  const initialize = () => {
    initializePromise ??= instance.initialize().catch((error: unknown) => {
      initializePromise = null;
      throw error;
    });
    return initializePromise;
  };

  const acquireAccessToken = async (): Promise<string> => {
    if (authConfigError) {
      throw new Error(authConfigError);
    }
    await initialize();

    const accounts = instance.getAllAccounts();
    const account = instance.getActiveAccount() ?? accounts[0] ?? null;
    if (!account) {
      throw new Error("Not authenticated. Sign in before making API requests.");
    }
    if (!instance.getActiveAccount()) {
      instance.setActiveAccount(account);
    }

    try {
      const response = await instance.acquireTokenSilent({
        account,
        scopes: requestedScopes,
      });
      return response.accessToken;
    } catch (error: unknown) {
      if (error instanceof InteractionRequiredAuthError) {
        throw new Error("Session expired. Please sign in again.");
      }
      throw error;
    }
  };

  activeSetup = {
    key,
    authConfigError,
    instance,
    requestedScopes,
    initialize,
    acquireAccessToken,
  };
  return activeSetup;
}

export async function acquireAccessToken(): Promise<string> {
  if (!activeSetup) {
    throw new Error("Authentication has not been configured.");
  }
  return activeSetup.acquireAccessToken();
}
