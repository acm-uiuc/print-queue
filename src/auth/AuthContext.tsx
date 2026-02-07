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

const scopeEnv = (import.meta.env.VITE_AAD_SCOPES as string | undefined) ?? '';
const parsedScopes = scopeEnv
  .split(',')
  .map((scope) => scope.trim())
  .filter(Boolean);
const requestedScopes = parsedScopes.length > 0 ? parsedScopes : ['User.Read'];

type MsalErrorShape = {
  errorCode?: string;
  errorMessage?: string;
  message?: string;
  name?: string;
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
        // Clean up URL parameters after successful redirect handling
        if (typeof window !== 'undefined' && window.location.search) {
          const url = new URL(window.location.href);
          url.search = '';
          window.history.replaceState({}, '', url.toString());
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const msalError = asMsalError(error);
        // Ignore errors for already-redeemed codes or invalid grants
        // These are common when refreshing after logout or when codes expire
        if (msalError.errorCode === 'invalid_grant' || 
            msalError.errorMessage?.includes('54005') ||
            msalError.errorMessage?.includes('already redeemed')) {
          console.log('Ignoring already-redeemed authorization code (this is normal after logout/refresh)');
          // Clean up URL parameters
          if (typeof window !== 'undefined' && window.location.search) {
            const url = new URL(window.location.href);
            url.search = '';
            window.history.replaceState({}, '', url.toString());
          }
        } else if (msalError.errorCode === 'post_request_failed' || 
                   msalError.errorMessage?.includes('CORS')) {
          // Ignore CORS errors - these can happen during redirect handling
          console.log('Ignoring CORS error during redirect handling');
        } else {
          console.error('MSAL redirect handling error', error);
        }
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
  const logoutRedirectOverride = (import.meta.env.VITE_AAD_LOGOUT_REDIRECT_URI as string | undefined)
    ?? (import.meta.env.VITE_AAD_POST_LOGOUT_REDIRECT_URI as string | undefined);

  const login = useCallback(async () => {
    // Proactively clear any stuck interaction state before attempting login
    if (typeof window !== 'undefined') {
      try {
        // Clear MSAL session storage that might have interaction state
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('msal.') || key.includes('msal') || key.includes('interaction')) {
            sessionStorage.removeItem(key);
          }
        });
        
        // Clear MSAL cookies (MSAL stores interaction state in cookies when storeAuthStateInCookie is true)
        document.cookie.split(';').forEach(cookie => {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (name.startsWith('msal.') || name.includes('msal') || name.includes('interaction')) {
            // Clear cookie by setting it to expire in the past
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
          }
        });
        
        // Also clear localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('msal.') || key.includes('msal') || key.includes('interaction')) {
            localStorage.removeItem(key);
          }
        });
      } catch {
        // Ignore storage errors
      }
    }
    
    const configuredRedirect = instance.getConfiguration().auth.redirectUri;
    const redirectUri = resolveRedirectUri(loginRedirectOverride, configuredRedirect);

    const loginRequest: Parameters<typeof instance.loginRedirect>[0] = {
      scopes: requestedScopes,
      redirectUri,
    };

    try {
      instance.loginRedirect(loginRequest);
      return Promise.resolve();
    } catch (error: unknown) {
      const msalError = asMsalError(error);
      // Handle interaction_in_progress errors
      if (msalError.errorCode === 'interaction_in_progress' || 
          msalError.message?.includes('interaction_in_progress') ||
          msalError.name === 'BrowserAuthError') {
        console.log('Interaction in progress detected, clearing all state and redirecting manually...');
        // Clear everything and redirect manually
        try {
          instance.clearCache();
        } catch {
          // Ignore
        }
        
        if (typeof window !== 'undefined') {
          // Clear all MSAL storage
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('msal.') || key.includes('msal') || key.includes('interaction')) {
              sessionStorage.removeItem(key);
            }
          });
          
          // Redirect manually to Azure AD
          const authority = instance.getConfiguration().auth.authority;
          const clientId = instance.getConfiguration().auth.clientId;
          const safeRedirectUri = redirectUri || configuredRedirect || '';
          const loginUrl = `${authority}/oauth2/v2.0/authorize?` +
            `client_id=${clientId}&` +
            `response_type=code&` +
            `redirect_uri=${encodeURIComponent(safeRedirectUri)}&` +
            `response_mode=query&` +
            `scope=${encodeURIComponent(requestedScopes.join(' '))}`;
          window.location.href = loginUrl;
        }
        return Promise.resolve();
      }
      console.error('Login redirect error', error);
      return Promise.reject(error);
    }
  }, [instance, loginRedirectOverride]);

  const logout = useCallback(async () => {
    // Clear local account state immediately
    setAccountState({ accounts: [], active: null });
    
    // Clear all MSAL cache and storage
    try {
      instance.clearCache();
    } catch (clearError: unknown) {
      console.log('Error clearing cache:', clearError);
    }
    
    // Clear all storage and cookies (MSAL stores tokens and interaction state here)
    if (typeof window !== 'undefined') {
      try {
        // Clear MSAL-related session storage
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('msal.') || key.includes('msal') || key.includes('interaction')) {
            sessionStorage.removeItem(key);
          }
        });
        
        // Clear MSAL-related localStorage
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('msal.') || key.includes('msal') || key.includes('interaction')) {
            localStorage.removeItem(key);
          }
        });
        
        // Clear auth token
        localStorage.removeItem('auth_token');
        
        // Clear MSAL cookies (MSAL stores interaction state in cookies when storeAuthStateInCookie is true)
        document.cookie.split(';').forEach(cookie => {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          if (name.startsWith('msal.') || name.includes('msal') || name.includes('interaction')) {
            // Clear cookie by setting it to expire in the past
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
          }
        });
      } catch (storageError: unknown) {
        console.log('Error clearing storage:', storageError);
      }
    }
    
    try {
      const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? undefined;
      
      // If no account, just redirect to login
      if (!account) {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return Promise.resolve();
      }
      
      const configuredLogout = instance.getConfiguration().auth.postLogoutRedirectUri;
      const postLogoutRedirectUri = resolveRedirectUri(
        logoutRedirectOverride, 
        configuredLogout ?? (typeof window !== 'undefined' ? window.location.origin + '/login' : '/login')
      );

      // Try logout redirect, but catch all errors and fallback to manual redirect
      try {
        instance.logoutRedirect({
          account,
          postLogoutRedirectUri,
        });
        // If redirect succeeds, this won't execute
        return Promise.resolve();
      } catch (redirectError: unknown) {
        const msalError = asMsalError(redirectError);
        // Catch any error (interaction_in_progress, network errors, etc.)
        console.log('Logout redirect failed, using manual redirect:', msalError.errorCode || msalError.message);
        // Fall through to manual redirect
      }
    } catch (error: unknown) {
      const msalError = asMsalError(error);
      console.log('Logout error, using manual redirect:', msalError.errorCode || msalError.message);
    }
    
    // Always redirect manually as fallback
    if (typeof window !== 'undefined') {
      // Force a hard redirect to ensure clean state
      window.location.href = '/login';
    }
    return Promise.resolve();
  }, [instance, logoutRedirectOverride]);

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
