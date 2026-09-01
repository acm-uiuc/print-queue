import { Avatar, Badge, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconMail } from "@tabler/icons-react";
import { useAuth } from "@/auth/useAuth";
import { AcmAppShell } from "@/components/AppShell";

export default function ProfilePage() {
  const { user } = useAuth();
  const displayName = user?.name || user?.email || "Signed-in user";

  return (
    <AcmAppShell>
      <Container size="sm">
        <Stack gap="xl">
          <Title>Profile</Title>
          <Paper radius="md" p="xl" withBorder>
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Group gap="lg">
                <Avatar size={80} name={displayName} color="initials" />
                <Stack gap={4}>
                  <Title order={2}>{displayName}</Title>
                  {user?.email ? (
                    <Group gap={6}>
                      <IconMail size={16} />
                      <Text c="dimmed">{user.email}</Text>
                    </Group>
                  ) : null}
                </Stack>
              </Group>
              <Badge variant="light">Print Queue</Badge>
            </Group>
          </Paper>
        </Stack>
      </Container>
    </AcmAppShell>
  );
}
