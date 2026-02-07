import {
  InteractionRequiredAuthError,
  type Configuration,
  PublicClientApplication,
} from '@azure/msal-browser';

const clientId = (import.meta.env.VITE_AAD_CLIENT_ID as string | undefined)?.trim() ?? '';
const tenantId = (import.meta.env.VITE_AAD_TENANT_ID as string | undefined)?.trim();
const explicitAuthority = (import.meta.env.VITE_AAD_AUTHORITY as string | undefined)?.trim();
const authority =
  explicitAuthority && explicitAuthority.length > 0
    ? explicitAuthority
    : tenantId
      ? `https://login.microsoftonline.com/${tenantId}`
      : '';

const configErrors: string[] = [];
if (!clientId) configErrors.push('VITE_AAD_CLIENT_ID');
if (!authority) configErrors.push('VITE_AAD_TENANT_ID or VITE_AAD_AUTHORITY');

export const authConfigError =
  configErrors.length > 0
    ? `Missing required auth config: ${configErrors.join(', ')}. Add these to your .env file.`
    : null;

// Keep app boot stable even when env is missing; auth functions fail closed via ensureAuthConfigured().
const safeClientId = clientId || '00000000-0000-0000-0000-000000000000';
const safeAuthority = authority || 'https://login.microsoftonline.com/organizations';

const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const defaultRedirectUri = appOrigin ? `${appOrigin}/` : '/';
const defaultLogoutRedirectUri = appOrigin ? `${appOrigin}/login` : '/login';

const scopeEnv = (import.meta.env.VITE_AAD_SCOPES as string | undefined) ?? '';
const parsedScopes = scopeEnv
  .split(',')
  .map((scope) => scope.trim())
  .filter(Boolean);

export const requestedScopes = parsedScopes.length > 0 ? parsedScopes : ['User.Read'];

export const msalConfiguration: Configuration = {
  auth: {
    clientId: safeClientId,
    authority: safeAuthority,
    redirectUri:
      (import.meta.env.VITE_AAD_REDIRECT_URI as string | undefined)?.trim() || defaultRedirectUri,
    postLogoutRedirectUri:
      (import.meta.env.VITE_AAD_POST_LOGOUT_REDIRECT_URI as string | undefined)?.trim() ||
      defaultLogoutRedirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    // Cookie-backed interaction state is mainly for legacy browsers and can get stale.
    storeAuthStateInCookie: false,
  },
};

export const pca = new PublicClientApplication(msalConfiguration);

let initializePromise: Promise<void> | null = null;

function ensureAuthConfigured(): void {
  if (authConfigError) {
    throw new Error(authConfigError);
  }
}

export function initializeMsal(): Promise<void> {
  if (!initializePromise) {
    initializePromise = pca.initialize();
  }
  return initializePromise;
}

export async function acquireAccessToken(): Promise<string> {
  ensureAuthConfigured();
  await initializeMsal();

  const cachedAccounts = pca.getAllAccounts();
  const account = pca.getActiveAccount() ?? cachedAccounts[0] ?? null;

  if (!account) {
    throw new Error('Not authenticated. Sign in before making API requests.');
  }

  if (!pca.getActiveAccount()) {
    pca.setActiveAccount(account);
  }

  try {
    const response = await pca.acquireTokenSilent({
      account,
      scopes: requestedScopes,
    });
    return response.accessToken;
  } catch (error: unknown) {
    if (error instanceof InteractionRequiredAuthError) {
      throw new Error('Session expired. Please sign in again.');
    }
    throw error;
  }
}
