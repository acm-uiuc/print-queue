import { useEffect, useMemo, useState } from 'react';
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
  Progress,
} from '@mantine/core';
import { IconCheck, IconX, IconPrinter, IconClock } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { HeaderNavbar } from '@/components/Navbar';
import { STATUS_BADGE_SHADOWS, type JobStatus } from '@/pages/queueShared';

const DEMO_POSITIONS = [3, 2, 1];
const STEP_INTERVAL_MS = 2000;

export function QueueDemoPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<JobStatus>('In queue');
  const [positionIndex, setPositionIndex] = useState(0);

  useEffect(() => {
    const timers: number[] = [];

    DEMO_POSITIONS.slice(1).forEach((_, idx) => {
      timers.push(
        window.setTimeout(() => {
          setPositionIndex(idx + 1);
        }, STEP_INTERVAL_MS * (idx + 1))
      );
    });

    timers.push(
      window.setTimeout(() => {
        setStatus('Printing');
      }, STEP_INTERVAL_MS * (DEMO_POSITIONS.length + 0))
    );

    timers.push(
      window.setTimeout(() => {
        setStatus('Done');
      }, STEP_INTERVAL_MS * (DEMO_POSITIONS.length + 1))
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const currentPosition = status === 'In queue' ? DEMO_POSITIONS[positionIndex] : undefined;
  const progressValue = useMemo(() => {
    const totalMilestones = DEMO_POSITIONS.length + 2; 
    const finalIndex = totalMilestones - 1;
    let milestoneIndex = positionIndex;
    if (status === 'Printing') {
      milestoneIndex = DEMO_POSITIONS.length;
    }
    if (status === 'Done' || status === 'Failed') {
      milestoneIndex = finalIndex;
    }
    return (milestoneIndex / finalIndex) * 100;
  }, [positionIndex, status]);

  const getStatusColor = (value: JobStatus) => {
    switch (value) {
      case 'Done': return 'acmBlue';
      case 'Failed': return 'red';
      case 'Printing': return 'indigo';
      case 'In queue': return 'acmBlue';
      default: return 'gray';
    }
  };

  const getStatusIcon = (value: JobStatus) => {
    switch (value) {
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
          <Stack gap="xl">
            <Center>
              <Title order={1} fw={700} style={{ fontSize: '2.5rem' }}>
                Status
              </Title>
            </Center>

            <Divider />

            <Alert color="acmBlue" variant="light" radius="md" fz="md">
              Test
            </Alert>

            <Center>
              <Badge
                size="xl"
                radius="xl"
                variant={status === 'In queue' ? 'light' : 'filled'}
                color={getStatusColor(status)}
                leftSection={getStatusIcon(status)}
                style={{
                  padding: '1.35rem 3.5rem',
                  fontSize: '1.35rem',
                  letterSpacing: '0.03em',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  boxShadow: STATUS_BADGE_SHADOWS[status],
                }}
              >
                {status.toUpperCase()}
              </Badge>
            </Center>

            <Stack gap="md" align="center">
              <Text ta="center" size="lg" fw={600}>
                Your current position
              </Text>
              <Text
                ta="center"
                fw={700}
                style={{
                  fontSize: status === 'In queue' ? '3rem' : '2rem',
                  color: '#0053B3',
                  lineHeight: 1,
                }}
              >
                {status === 'In queue' ? `#${currentPosition}` : status === 'Printing' ? 'Printing…' : 'Complete'}
              </Text>
              <Progress
                value={progressValue}
                size="xl"
                radius="xl"
                animated={status !== 'Done' && status !== 'Failed'}
                style={{ width: '100%', maxWidth: '480px', height: '1.1rem' }}
              />
            </Stack>

            {status === 'Printing' && (
              <Stack gap="md" align="center">
                <Loader size="xl" />
                <Text ta="center" size="lg">
                  Your document is being printed...
                </Text>
              </Stack>
            )}

            {status === 'Done' && (
              <Alert color="acmBlue" title="Success!" radius="md" fz="lg">
                Your document has been printed successfully.
              </Alert>
            )}

            {status === 'Failed' && (
              <Alert color="red" title="Print Failed" radius="md" fz="lg">
                Your document failed to print. Please try again or contact support.
              </Alert>
            )}

            <Group justify="center" mt="lg" gap="lg">
              {status === 'Done' && (
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
        </Paper>
      </Box>
    </Box>
  );
}
