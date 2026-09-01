import { useEffect, useMemo } from "react";
import {
  Avatar,
  Badge,
  Card,
  Center,
  Container,
  Grid,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  IconCheck,
  IconClock,
  IconFile,
  IconMail,
  IconPrinter,
} from "@tabler/icons-react";
import { useAuth } from "@/auth/useAuth";
import { AcmAppShell } from "@/components/AppShell";
import type { PrintJobStatus } from "@/print/PrintJobsContextBase";
import { usePrintJobs } from "@/print/usePrintJobs";
import { useRuntimeConfig } from "@/runtimeConfig";
import { subscribeToJobStatus } from "@/utils/api";

const STATUS_COLORS: Record<PrintJobStatus, string> = {
  Done: "green",
  Failed: "red",
  Printing: "indigo",
  "In queue": "blue",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const { jobs, updateJobStatus } = usePrintJobs();
  const { apiBaseUrl } = useRuntimeConfig();
  useEffect(() => {
    const subscriptions = jobs
      .filter((job) => job.status === "In queue" || job.status === "Printing")
      .map((job) =>
        subscribeToJobStatus(apiBaseUrl, job.id, ({ status }) =>
          updateJobStatus(job.id, status),
        ),
      );
    return () => subscriptions.forEach(({ close }) => close());
  }, [apiBaseUrl, jobs, updateJobStatus]);

  const summary = useMemo(() => {
    const completedJobs = jobs.filter((job) => job.status === "Done");
    const timedJobs = completedJobs.filter((job) => job.durationSec > 0);
    return {
      pagesPrinted: completedJobs.reduce((total, job) => total + job.pages, 0),
      totalSizeMb: completedJobs.reduce((total, job) => total + job.sizeMb, 0),
      totalJobs: completedJobs.length,
      averageTimePerJob:
        timedJobs.length > 0
          ? Math.round(
              timedJobs.reduce((total, job) => total + job.durationSec, 0) /
                timedJobs.length,
            )
          : null,
    };
  }, [jobs]);
  const metrics = [
    {
      label: "Pages Printed",
      value: summary.pagesPrinted,
      icon: IconPrinter,
    },
    {
      label: "Avg. Print Time",
      value:
        summary.averageTimePerJob === null
          ? "—"
          : `${summary.averageTimePerJob}s`,
      icon: IconClock,
    },
    {
      label: "Total Data",
      value: `${summary.totalSizeMb.toFixed(1)} MB`,
      icon: IconFile,
    },
    {
      label: "Completed Jobs",
      value: summary.totalJobs,
      icon: IconCheck,
    },
  ];
  const displayName = user?.name || user?.email || "Signed-in user";

  return (
    <AcmAppShell>
      <Container fluid>
        <Stack gap="xl">
          <Title>Profile</Title>
          <Paper radius="md" p="xl" withBorder>
            <Group justify="space-between" align="flex-start" wrap="wrap">
              <Group gap="lg" wrap="wrap">
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

            <Grid gap="lg" mt="xl">
              {metrics.map((metric) => (
                <Grid.Col key={metric.label} span={{ base: 12, sm: 6, md: 3 }}>
                  <Card withBorder radius="md" p="lg">
                    <Group gap="xs" align="flex-start">
                      <metric.icon size={28} color="var(--illinois-blue)" />
                      <Stack gap={2}>
                        <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
                          {metric.label}
                        </Text>
                        <Text fw={700} size="xl">
                          {metric.value}
                        </Text>
                      </Stack>
                    </Group>
                  </Card>
                </Grid.Col>
              ))}
            </Grid>
          </Paper>

          <Paper radius="md" p="xl" withBorder>
            <Stack gap="lg">
              <div>
                <Title order={2}>Recent Print Jobs</Title>
                <Text c="dimmed" size="sm">
                  History is stored only in this browser.
                </Text>
              </div>

              {jobs.length === 0 ? (
                <Center py="xl">
                  <Text c="dimmed">No print jobs have been submitted yet.</Text>
                </Center>
              ) : (
                <Table.ScrollContainer minWidth={640}>
                  <Table verticalSpacing="md" striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Submitted</Table.Th>
                        <Table.Th>File</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th>Pages</Table.Th>
                        <Table.Th>Size</Table.Th>
                        <Table.Th>Duration</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {jobs.map((job) => (
                        <Table.Tr key={job.id}>
                          <Table.Td>
                            <Text fw={500}>{job.id}</Text>
                            <Text size="sm" c="dimmed">
                              {new Date(job.submittedAt).toLocaleString()}
                            </Text>
                          </Table.Td>
                          <Table.Td>{job.fileName}</Table.Td>
                          <Table.Td>
                            <Badge color={STATUS_COLORS[job.status]}>
                              {job.status}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{job.pages}</Table.Td>
                          <Table.Td>{job.sizeMb.toFixed(2)} MB</Table.Td>
                          <Table.Td>
                            {job.durationSec > 0 ? `${job.durationSec}s` : "—"}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </AcmAppShell>
  );
}
