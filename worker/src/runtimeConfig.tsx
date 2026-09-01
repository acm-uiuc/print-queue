import { createContext, useContext, type ReactNode } from "react";

export interface RuntimeConfig {
  aadClientId?: string;
  aadTenantId?: string;
  aadAuthority?: string;
  aadRedirectUri?: string;
  aadPostLogoutRedirectUri?: string;
  aadScopes: string;
  apiBaseUrl: string;
  enableDemoRoutes: boolean;
}

const RuntimeConfigContext = createContext<RuntimeConfig | undefined>(
  undefined,
);

export function RuntimeConfigProvider({
  config,
  children,
}: {
  config: RuntimeConfig;
  children: ReactNode;
}) {
  return (
    <RuntimeConfigContext.Provider value={config}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig(): RuntimeConfig {
  const config = useContext(RuntimeConfigContext);
  if (!config) {
    throw new Error(
      "useRuntimeConfig must be used within RuntimeConfigProvider",
    );
  }
  return config;
}
