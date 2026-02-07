import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Title,
  Text,
  Loader,
  Stack,
  Center,
  Alert,
  Group,
  Button,
  Badge,
  Divider,
} from '@mantine/core';
import { IconCheck, IconX, IconPrinter, IconClock } from '@tabler/icons-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { HeaderNavbar } from '@/components/Navbar';
import { subscribeToJobStatus, getJobStatus, type QueueStatusResponse } from '@/utils/api';
import { STATUS_BADGE_SHADOWS, type JobStatus } from '@/pages/queueShared';

type QueueStatus = QueueStatusResponse;

export function QueuePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('jobId');
  
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setError('No job ID provided');
      setLoading(false);
      return;
    }

    // Initial status fetch
    const fetchStatus = async () => {
      try {
        const status = await getJobStatus(jobId);
        setQueueStatus(status);
        setLoading(false);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to fetch queue status';
        setError(message);
        setLoading(false);
      }
    };

    fetchStatus();

    const eventSource = subscribeToJobStatus(jobId, (data) => {
      setQueueStatus(data);
      
      if (data.status === 'Done' || data.status === 'Failed') {
        setTimeout(() => {
          eventSource.close();
        }, 5000);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [jobId]);

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'Done': return 'acmBlue';
      case 'Failed': return 'red';
      case 'Printing': return 'indigo';
      case 'In queue': return 'acmBlue';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'Done': return <IconCheck size={28} />;
      case 'Failed': return <IconX size={28} />;
      case 'Printing': return <IconPrinter size={28} />;
      case 'In queue': return <IconClock size={28} />;
      default: return null;
    }
  };

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 2rem',
        }}
      >
        <Paper
          radius="lg"
          p="3rem"
          withBorder
          style={{
            maxWidth: '820px',
            width: '100%',
            boxShadow: '0 24px 70px rgba(0, 36, 77, 0.12)',
            backgroundColor: '#ffffff',
          }}
        >
          {loading ? (
            <Center style={{ minHeight: '300px' }}>
              <Stack align="center" gap="md">
                <Loader size="lg" />
                <Text c="dimmed">Loading queue status...</Text>
              </Stack>
            </Center>
          ) : error ? (
            <Alert color="red" title="Error">
              {error}
            </Alert>
          ) : queueStatus ? (
            <Stack gap="xl">
              <Center>
                <Title order={1} fw={700} style={{ fontSize: '2.5rem' }}>
                  Status
                </Title>
              </Center>

              <Divider />

              <Center>
                <Badge
                  size="xl"
                  radius="xl"
                  variant={queueStatus.status === 'In queue' ? 'light' : 'filled'}
                  color={getStatusColor(queueStatus.status)}
                  leftSection={getStatusIcon(queueStatus.status)}
                  style={{
                    padding: '1.35rem 3.5rem',
                    fontSize: '1.35rem',
                    letterSpacing: '0.03em',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    boxShadow: STATUS_BADGE_SHADOWS[queueStatus.status],
                  }}
                >
                  {queueStatus.status.toUpperCase()}
                </Badge>
              </Center>

              {queueStatus.status === 'In queue' && typeof queueStatus.position === 'number' && (
                <Stack gap="md" align="center">
                  <Text ta="center" size="lg" fw={600}>
                    Your current position
                  </Text>
                  <Text
                    ta="center"
                    fw={700}
                    style={{
                      fontSize: '3rem',
                      color: '#0053B3',
                      lineHeight: 1,
                    }}
                  >
                    #{queueStatus.position}
                  </Text>
                  <Text ta="center" c="dimmed" size="sm">
                    We'll move you forward as soon as the next printer becomes available.
                  </Text>
                </Stack>
              )}

              {queueStatus.status === 'In queue' && typeof queueStatus.position !== 'number' && (
                <Center>
                  <Text ta="center" c="dimmed">
                    We&apos;re fetching your spot in line...
                  </Text>
                </Center>
              )}

              {queueStatus.status === 'Printing' && (
                <Stack gap="md" align="center">
                  <Loader size="xl" />
                  <Text ta="center" size="lg">
                    Your document is being printed...
                  </Text>
                </Stack>
              )}

              {queueStatus.status === 'Done' && (
                <Alert color="green" title="Success!" radius="md" fz="lg">
                  Your document has been printed successfully.
                </Alert>
              )}

              {queueStatus.status === 'Failed' && (
                <Alert color="red" title="Print Failed" radius="md" fz="lg">
                  Your document failed to print. Please try again or contact support.
                </Alert>
              )}

              <Group justify="center" mt="lg" gap="lg">
                <Button
                  variant="light"
                  onClick={() => navigate('/print')}
                  size="lg"
                  radius="xl"
                  style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                >
                  Print Another
                </Button>
                {queueStatus.status === 'Done' && (
                  <Button
                    onClick={() => navigate('/profile')}
                    color="acmBlue"
                    size="lg"
                    radius="xl"
                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                  >
                    View Profile
                  </Button>
                )}
              </Group>
            </Stack>
          ) : null}
        </Paper>
      </Box>
    </Box>
  );
}
