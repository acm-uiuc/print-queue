import { useMemo } from 'react';
import {
  Box,
  Paper,
  Title,
  Text,
  Stack,
  Card,
  Grid,
  Group,
  Badge,
  Table,
  Avatar,
  Divider,
  Center,
} from '@mantine/core';
import {
  IconPrinter,
  IconClock,
  IconFile,
  IconCheck,
  IconMail,
  IconId,
} from '@tabler/icons-react';
import { HeaderNavbar } from '@/components/Navbar';
import { useAuth } from '@/auth/useAuth';
import { usePrintJobs } from '@/print/usePrintJobs';

const STATUS_COLORS = {
  Done: 'green',
  Failed: 'red',
  Printing: 'indigo',
  'In queue': 'acmBlue',
} as const;

export function ProfilePage() {
  const { user } = useAuth();
  const { jobs } = usePrintJobs();

  const summary = useMemo(() => {
    if (jobs.length === 0) {
      return {
        pagesPrinted: 0,
        totalSizeMb: 0,
        totalJobs: 0,
        averageTimePerJob: 0,
      };
    }

    const completedJobs = jobs.filter((job) => job.status === 'Done');
    const pagesPrinted = completedJobs.reduce((acc, job) => acc + job.pages, 0);
    const totalSizeMb = completedJobs.reduce((acc, job) => acc + job.sizeMb, 0);
    const totalDuration = completedJobs.reduce((acc, job) => acc + job.durationSec, 0);
    const averageTimePerJob = completedJobs.length ? Math.round(totalDuration / completedJobs.length) : 0;

    return {
      pagesPrinted,
      totalSizeMb,
      totalJobs: completedJobs.length,
      averageTimePerJob,
    };
  }, [jobs]);

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#f6f8fc',
      }}
    >
      <HeaderNavbar />
      <Box
        component="main"
        style={{
          flex: 1,
          padding: '3rem 2rem',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Stack gap="xl">
          <Paper radius="lg" p="2.5rem" withBorder>
            <Group justify="space-between" align="flex-start">
              <Group gap="lg">
                <Avatar size={96} radius={96} color="acmBlue">
                  {user?.email?.[0]?.toUpperCase() ?? 'A'}
                </Avatar>
                <Stack gap={4}>
                  <Title order={1} fw={700} style={{ color: '#1b335c' }}>
                    {user?.name ?? 'Demo User'}
                  </Title>
                  <Group gap="md">
                    <Group gap={6} align="center">
                      <IconMail size={16} color="#61779a" />
                      <Text c="dimmed">{user?.email ?? 'demo-user@illinois.edu'}</Text>
                    </Group>
                    <Group gap={6} align="center">
                      <IconId size={16} color="#61779a" />
                      <Text c="dimmed">ACM Member · UIUC</Text>
                    </Group>
                  </Group>
                </Stack>
              </Group>
              <Badge color="acmBlue" variant="light" size="lg" radius="md">
                Paid Member
              </Badge>
            </Group>
            <Divider my="xl" />
            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card withBorder radius="lg" p="lg">
                  <Group gap="xs" align="flex-start">
                    <IconPrinter size={28} color="#0053B3" />
                    <Stack gap={2}>
                      <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
                        Pages Printed
                      </Text>
                      <Text fw={700} size="xl">
                        {summary.pagesPrinted}
                      </Text>
                    </Stack>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card withBorder radius="lg" p="lg">
                  <Group gap="xs" align="flex-start">
                    <IconClock size={28} color="#0053B3" />
                    <Stack gap={2}>
                      <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
                        Avg. Print Time
                      </Text>
                      <Text fw={700} size="xl">
                        {summary.averageTimePerJob}s
                      </Text>
                    </Stack>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card withBorder radius="lg" p="lg">
                  <Group gap="xs" align="flex-start">
                    <IconFile size={28} color="#0053B3" />
                    <Stack gap={2}>
                      <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
                        Total Data
                      </Text>
                      <Text fw={700} size="xl">
                        {summary.totalSizeMb.toFixed(1)} MB
                      </Text>
                    </Stack>
                  </Group>
                </Card>
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                <Card withBorder radius="lg" p="lg">
                  <Group gap="xs" align="flex-start">
                    <IconCheck size={28} color="#0053B3" />
                    <Stack gap={2}>
                      <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
                        Completed Jobs
                      </Text>
                      <Text fw={700} size="xl">
                        {summary.totalJobs}
                      </Text>
                    </Stack>
                  </Group>
                </Card>
              </Grid.Col>
            </Grid>
          </Paper>

          <Paper radius="lg" p="2rem" withBorder>
            <Stack gap="lg">
              <Group justify="space-between" align="center">
                <Title order={2}>Recent Print Jobs</Title>
                {jobs.length > 0 ? (
                  <Badge color="acmBlue" variant="light">
                    Demo Data
                  </Badge>
                ) : null}
              </Group>

              {jobs.length === 0 ? (
                <Center py="xl">
                  <Text c="dimmed">
                    You haven&apos;t run any demo prints yet. Use the Test Run option on the print page to see jobs appear here.
                  </Text>
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
                          <Table.Td>
                            <Text fw={500}>{job.fileName}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={STATUS_COLORS[job.status]}>{job.status}</Badge>
                          </Table.Td>
                          <Table.Td>{job.pages}</Table.Td>
                          <Table.Td>{job.sizeMb.toFixed(2)} MB</Table.Td>
                          <Table.Td>{job.durationSec ? `${job.durationSec}s` : '—'}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
}
