import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MsalProvider } from "@azure/msal-react";
import {
  Alert,
  Center,
  Code,
  Container,
  Loader,
  MantineProvider,
  Stack,
  Text,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { useColorScheme, useLocalStorage } from "@mantine/hooks";
import { BrowserRouter } from "react-router-dom";
import "@ungap/with-resolvers";
import App from "@/App";
import { AuthProvider } from "@/auth/AuthContext";
import { configureMsal, type MsalSetup } from "@/auth/msalConfig";
import ColorSchemeContext, { type AppColorScheme } from "@/ColorSchemeContext";
import { PrintJobsProvider } from "@/print/PrintJobsContext";
import { RuntimeConfigProvider, type RuntimeConfig } from "@/runtimeConfig";
import { cssVariablesResolver, theme } from "@/theme";

interface ClientAppProps {
  config: RuntimeConfig;
}

function ConfigurationError({ message }: { message: string }) {
  return (
    <Container size="sm" py="xl">
      <Alert color="red" title="App configuration error">
        <Stack gap="xs">
          <Text>{message}</Text>
          <Text size="sm">
            Set the missing Cloudflare Worker variables, or add them to{" "}
            <Code>.dev.vars</Code> for local development.
          </Text>
        </Stack>
      </Alert>
    </Container>
  );
}

function LoadingApp() {
  return (
    <Center mih="100vh">
      <Stack align="center" gap="sm">
        <Loader />
        <Text c="dimmed">Loading Print Queue…</Text>
      </Stack>
    </Center>
  );
}

function InitializedApp({ setup }: { setup: MsalSetup }) {
  return (
    <MsalProvider instance={setup.instance}>
      <AuthProvider requestedScopes={setup.requestedScopes}>
        <PrintJobsProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </PrintJobsProvider>
      </AuthProvider>
    </MsalProvider>
  );
}

function CoreTheme({ children }: { children: ReactNode }) {
  const preferredColorScheme = useColorScheme();
  const [colorScheme, setColorScheme] = useLocalStorage<AppColorScheme>({
    key: "acm-manage-color-scheme",
    defaultValue: preferredColorScheme,
  });

  return (
    <ColorSchemeContext.Provider
      value={{ colorScheme, onChange: setColorScheme }}
    >
      <MantineProvider
        withGlobalClasses
        withCssVariables
        forceColorScheme={colorScheme}
        theme={theme}
        cssVariablesResolver={cssVariablesResolver}
      >
        <Notifications position="top-right" />
        {children}
      </MantineProvider>
    </ColorSchemeContext.Provider>
  );
}

export default function ClientApp({ config }: ClientAppProps) {
  const setup = useMemo(
    () => configureMsal(config),
    [
      config.aadAuthority,
      config.aadClientId,
      config.aadPostLogoutRedirectUri,
      config.aadRedirectUri,
      config.aadScopes,
      config.aadTenantId,
    ],
  );
  const [initialization, setInitialization] = useState<
    "loading" | "ready" | string
  >("loading");

  useEffect(() => {
    let cancelled = false;
    setup.initialize().then(
      () => {
        if (!cancelled) setInitialization("ready");
      },
      (error: unknown) => {
        if (!cancelled) {
          setInitialization(
            error instanceof Error
              ? error.message
              : "Failed to initialize authentication.",
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [setup]);

  let content: ReactNode;
  if (setup.authConfigError) {
    content = <ConfigurationError message={setup.authConfigError} />;
  } else if (initialization === "loading") {
    content = <LoadingApp />;
  } else if (initialization !== "ready") {
    content = <ConfigurationError message={initialization} />;
  } else {
    content = <InitializedApp setup={setup} />;
  }

  return (
    <RuntimeConfigProvider config={config}>
      <CoreTheme>{content}</CoreTheme>
    </RuntimeConfigProvider>
  );
}
