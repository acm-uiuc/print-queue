import { useEffect, useState, type ReactNode } from "react";
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
  localStorageColorSchemeManager,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { BrowserRouter } from "react-router-dom";
import "@ungap/with-resolvers";
import App from "@/App";
import { AuthProvider } from "@/auth/AuthContext";
import { configureMsal } from "@/auth/msalConfig";
import { RuntimeConfigProvider, type RuntimeConfig } from "@/runtimeConfig";

const colorSchemeManager = localStorageColorSchemeManager({
  key: "acm-manage-color-scheme",
});

interface ClientAppProps {
  config: RuntimeConfig;
}

function AppError({
  message,
  configuration = false,
}: {
  message: string;
  configuration?: boolean;
}) {
  return (
    <Container size="sm" py="xl">
      <Alert
        color="red"
        title={configuration ? "App configuration error" : "Unable to start app"}
      >
        <Stack gap="xs">
          <Text>{message}</Text>
          {configuration ? (
            <Text size="sm">
              Set the missing Cloudflare Worker variables, or add them to{" "}
              <Code>.dev.vars</Code> for local development.
            </Text>
          ) : (
            <Text size="sm">Refresh the page to try again.</Text>
          )}
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

export default function ClientApp({ config }: ClientAppProps) {
  const [setup] = useState(() => configureMsal(config));
  const [initializationError, setInitializationError] = useState<
    string | null
  >();

  useEffect(() => {
    if (setup.authConfigError) return;

    let active = true;
    setup.initialize().then(
      () => {
        if (active) setInitializationError(null);
      },
      (error: unknown) => {
        if (active) {
          setInitializationError(
            error instanceof Error
              ? error.message
              : "Failed to initialize authentication.",
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [setup]);

  let content: ReactNode;
  if (setup.authConfigError) {
    content = (
      <AppError message={setup.authConfigError} configuration />
    );
  } else if (initializationError === undefined) {
    content = <LoadingApp />;
  } else if (initializationError) {
    content = <AppError message={initializationError} />;
  } else {
    content = (
      <MsalProvider instance={setup.instance}>
        <AuthProvider requestedScopes={setup.requestedScopes}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </MsalProvider>
    );
  }

  return (
    <RuntimeConfigProvider config={config}>
      <MantineProvider
        colorSchemeManager={colorSchemeManager}
        defaultColorScheme="auto"
        theme={{ defaultRadius: "sm" }}
      >
        <Notifications position="top-right" />
        {content}
      </MantineProvider>
    </RuntimeConfigProvider>
  );
}
