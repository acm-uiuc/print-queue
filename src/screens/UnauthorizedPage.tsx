import {
  Alert,
  Button,
  Center,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconLock, IconLogout } from "@tabler/icons-react";
import { AcmAppShell } from "@/components/AppShell";
import { useAuth } from "@/auth/useAuth";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();

  return (
    <AcmAppShell showSidebar={false}>
      <Center mih="calc(100dvh - 92px)" px="md">
        <Paper radius="md" p="xl" withBorder maw={640} w="100%">
          <Stack gap="lg">
            <Center>
              <IconLock size={72} color="var(--illinois-blue)" />
            </Center>
            <Title order={1} ta="center">
              Membership Required
            </Title>
            <Alert
              color="var(--illinois-blue)"
              style={{ backgroundColor: "rgba(0, 83, 179, 0.1)" }}
            >
              <Text>
                {user?.name ? `${user.name}, this` : "This"} service is only
                available to paid ACM@UIUC members.
              </Text>
            </Alert>
            <Text ta="center" c="dimmed">
              Purchase or renew your membership, then sign in again. Membership
              changes may take a short time to appear.
            </Text>
            <Group justify="center">
              <Button
                variant="outline"
                leftSection={<IconLogout size={16} />}
                onClick={() => {
                  void logout().catch((error: unknown) => {
                    notifications.show({
                      title: "Logout failed",
                      message:
                        error instanceof Error
                          ? error.message
                          : "Please try again.",
                      color: "red",
                    });
                  });
                }}
              >
                Sign Out
              </Button>
              <Button
                component="a"
                href="https://www.acm.illinois.edu/membership?utm_source=printqueue"
                target="_blank"
                rel="noopener noreferrer"
                color="var(--illinois-blue)"
              >
                Buy Membership
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Center>
    </AcmAppShell>
  );
}
