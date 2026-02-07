import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useMsal } from '@azure/msal-react';
import { EventType, InteractionStatus, type AccountInfo } from '@azure/msal-browser';
import { AuthContext, type AuthContextValue, type AuthUser } from './AuthContextBase';
import { requestedScopes } from './msalConfig';

type MsalErrorShape = {
  errorCode?: string;
  message?: string;
};

function asMsalError(error: unknown): MsalErrorShape {
  if (typeof error === 'object' && error !== null) {
    return error as MsalErrorShape;
  }
  return {};
}

function resolveRedirectUri(override: string | undefined, fallbackPath: string | undefined) {
  if (override && override.trim().length > 0) {
    return override.trim();
  }
  if (!fallbackPath || fallbackPath.trim().length === 0) {
    return undefined;
  }
  if (/^https?:\/\//i.test(fallbackPath)) {
    return fallbackPath.trim();
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${fallbackPath}`;
  }
  return fallbackPath;
}

function clearStaleInteractionState() {
  if (typeof window === 'undefined') {
    return;
  }

  const clearFromStore = (store: Storage) => {
    Object.keys(store).forEach((key) => {
      if (key.includes('interaction.status') || key.endsWith('.interaction.status')) {
        store.removeItem(key);
      }
    });
  };

  try {
    clearFromStore(window.sessionStorage);
    clearFromStore(window.localStorage);
    document.cookie.split(';').forEach((cookie) => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.slice(0, eqPos).trim() : cookie.trim();
      if (name.startsWith('msal.') || name.includes('msal') || name.includes('interaction')) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
      }
    });
  } catch (error: unknown) {
    console.warn('Failed to clear stale interaction state', error);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const [accountState, setAccountState] = useState<{
    accounts: AccountInfo[];
    active: AccountInfo | null;
  }>(() => ({
    accounts: instance.getAllAccounts(),
    active: instance.getActiveAccount() ?? null,
  }));
  const [isBootstrapComplete, setIsBootstrapComplete] = useState(false);

  const syncAccounts = useCallback(() => {
    setAccountState(() => {
      const existingAccounts = instance.getAllAccounts();
      const currentActive = instance.getActiveAccount();
      const nextActive = currentActive ?? existingAccounts[0] ?? null;

      if (
        nextActive &&
        (!currentActive || currentActive.homeAccountId !== nextActive.homeAccountId)
      ) {
        instance.setActiveAccount(nextActive);
      }

      return {
        accounts: existingAccounts,
        active: nextActive,
      };
    });
  }, [instance]);

  useEffect(() => {
    let cancelled = false;

    instance
      .handleRedirectPromise()
      .then((response) => {
        if (cancelled) return;

        if (response?.account) {
          instance.setActiveAccount(response.account);
        }

        if (typeof window !== 'undefined' && window.location.search) {
          const url = new URL(window.location.href);
          url.search = '';
          window.history.replaceState({}, '', url.toString());
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('MSAL redirect handling error', error);
      })
      .finally(() => {
        if (!cancelled) {
          syncAccounts();
          setIsBootstrapComplete(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [instance, syncAccounts]);

  useEffect(() => {
    const callbackId = instance.addEventCallback((event) => {
      switch (event.eventType) {
        case EventType.LOGIN_SUCCESS:
        case EventType.ACQUIRE_TOKEN_SUCCESS:
        case EventType.HANDLE_REDIRECT_END:
        case EventType.SSO_SILENT_SUCCESS:
          if (event.payload && 'account' in event.payload && event.payload.account) {
            instance.setActiveAccount(event.payload.account as AccountInfo);
          }
          syncAccounts();
          break;
        case EventType.LOGOUT_SUCCESS:
          syncAccounts();
          break;
        default:
          break;
      }
    });

    return () => {
      if (callbackId) {
        instance.removeEventCallback(callbackId);
      }
    };
  }, [instance, syncAccounts]);

  useEffect(() => {
    if (!isBootstrapComplete) return;
    if (inProgress === InteractionStatus.None) {
      syncAccounts();
    }
  }, [inProgress, isBootstrapComplete, syncAccounts]);

  useEffect(() => {
    if (!isBootstrapComplete) return;
    if (accounts.length > 0) {
      syncAccounts();
    }
  }, [accounts, isBootstrapComplete, syncAccounts]);

  const activeAccount = accountState.active;
  const isAuthenticated = isBootstrapComplete && Boolean(activeAccount);

  const user = useMemo<AuthUser | null>(() => {
    if (!activeAccount) return null;
    return {
      email: activeAccount.username,
      name: activeAccount.name ?? undefined,
    };
  }, [activeAccount]);

  const loginRedirectOverride = (import.meta.env.VITE_AAD_LOGIN_REDIRECT_URI as string | undefined)
    ?? (import.meta.env.VITE_AAD_REDIRECT_URI as string | undefined);

  const login = useCallback(async () => {
    clearStaleInteractionState();

    const configuredRedirect = instance.getConfiguration().auth.redirectUri;
    const redirectUri = resolveRedirectUri(loginRedirectOverride, configuredRedirect);
    const loginRequest: Parameters<typeof instance.loginRedirect>[0] = {
      scopes: requestedScopes,
      redirectUri,
    };

    try {
      await instance.loginRedirect(loginRequest);
    } catch (error: unknown) {
      const msalError = asMsalError(error);
      if (
        msalError.errorCode === 'interaction_in_progress' ||
        msalError.message?.includes('interaction_in_progress')
      ) {
        clearStaleInteractionState();
        try {
          await instance.clearCache();
        } catch {
          // best-effort cleanup
        }
        try {
          await instance.loginRedirect(loginRequest);
        } catch (retryError: unknown) {
          console.error('Login redirect retry failed', retryError);
          throw retryError;
        }
        return;
      }
      console.error('Login redirect error', error);
      throw error;
    }
  }, [instance, loginRedirectOverride]);

  const logout = useCallback(async () => {
    const clearLocalAuthState = async () => {
      setAccountState({ accounts: [], active: null });
      try {
        await instance.clearCache();
      } catch (error: unknown) {
        console.warn('Failed to clear local auth cache', error);
      }
      clearStaleInteractionState();
    };

    await clearLocalAuthState();
  }, [instance]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isReady: isBootstrapComplete,
      isLoading: !isBootstrapComplete || inProgress !== InteractionStatus.None,
      user,
      activeAccount,
      login,
      logout,
    }),
    [isAuthenticated, isBootstrapComplete, inProgress, user, activeAccount, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
