import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMsal } from "@azure/msal-react";
import {
  EventType,
  InteractionStatus,
  type AccountInfo,
} from "@azure/msal-browser";
import {
  AuthContext,
  type AuthContextValue,
  type AuthUser,
} from "./AuthContextBase";

export function AuthProvider({
  children,
  requestedScopes,
}: {
  children: ReactNode;
  requestedScopes: string[];
}) {
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
        (!currentActive ||
          currentActive.homeAccountId !== nextActive.homeAccountId)
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
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("MSAL redirect handling error", error);
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
          if (
            event.payload &&
            "account" in event.payload &&
            event.payload.account
          ) {
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

  const login = useCallback(async () => {
    if (inProgress !== InteractionStatus.None) {
      return;
    }
    await instance.loginRedirect({ scopes: requestedScopes });
  }, [inProgress, instance, requestedScopes]);

  const logout = useCallback(async () => {
    const account =
      instance.getActiveAccount() ?? accountState.active ?? undefined;
    setAccountState({ accounts: [], active: null });
    try {
      await instance.logoutRedirect({ account });
    } catch (error: unknown) {
      try {
        await instance.clearCache();
      } catch (cacheError: unknown) {
        console.warn("Failed to clear local auth cache", cacheError);
      }
      throw error;
    }
  }, [accountState.active, instance]);

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
    [
      isAuthenticated,
      isBootstrapComplete,
      inProgress,
      user,
      activeAccount,
      login,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
