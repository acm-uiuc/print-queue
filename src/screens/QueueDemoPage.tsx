import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Center,
  Container,
  Divider,
  Group,
  Loader,
  Paper,
  Progress,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconCheck,
  IconClock,
  IconPrinter,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { AcmAppShell } from "@/components/AppShell";
import type { JobStatus } from "@/screens/queueShared";

const DEMO_POSITIONS = [3, 2, 1] as const;
const STEP_INTERVAL_MS = 2000;
const STATUS_COLORS: Record<JobStatus, string> = {
  Done: "green",
  Failed: "red",
  Printing: "indigo",
  "In queue": "blue",
};
const STATUS_ICONS: Record<JobStatus, Icon> = {
  Done: IconCheck,
  Failed: IconX,
  Printing: IconPrinter,
  "In queue": IconClock,
};

export function QueueDemoPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<JobStatus>("In queue");
  const [positionIndex, setPositionIndex] = useState(0);

  useEffect(() => {
    const timers = DEMO_POSITIONS.slice(1).map((_, index) =>
      window.setTimeout(
        () => setPositionIndex(index + 1),
        STEP_INTERVAL_MS * (index + 1),
      ),
    );
    timers.push(
      window.setTimeout(
        () => setStatus("Printing"),
        STEP_INTERVAL_MS * DEMO_POSITIONS.length,
      ),
      window.setTimeout(
        () => setStatus("Done"),
        STEP_INTERVAL_MS * (DEMO_POSITIONS.length + 1),
      ),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const progressValue = useMemo(() => {
    const finalIndex = DEMO_POSITIONS.length + 1;
    if (status === "Printing") {
      return (DEMO_POSITIONS.length / finalIndex) * 100;
    }
    if (status === "Done" || status === "Failed") return 100;
    return (positionIndex / finalIndex) * 100;
  }, [positionIndex, status]);
  const StatusIcon = STATUS_ICONS[status];
  const currentPosition = DEMO_POSITIONS[positionIndex] ?? 1;

  return (
    <AcmAppShell>
      <Container size="md">
        <Paper radius="md" p="xl" withBorder>
          <Stack gap="xl">
            <Title>Print Status</Title>
            <Divider />
            <Alert color="blue" variant="light">
              Demo mode — no document was sent to a printer.
            </Alert>
            <Center>
              <Badge
                size="xl"
                variant={status === "In queue" ? "light" : "filled"}
                color={STATUS_COLORS[status]}
                leftSection={<StatusIcon size={18} />}
              >
                {status}
              </Badge>
            </Center>
            <Stack gap="md" align="center">
              <Text fw={500}>Your current position</Text>
              <Title order={2} c="var(--illinois-blue)">
                {status === "In queue"
                  ? `#${currentPosition}`
                  : status === "Printing"
                    ? "Printing…"
                    : "Complete"}
              </Title>
              <Progress
                value={progressValue}
                animated={status !== "Done" && status !== "Failed"}
                w="100%"
                maw={480}
              />
            </Stack>
            {status === "Printing" ? (
              <Stack gap="md" align="center">
                <Loader />
                <Text>Your document is being printed…</Text>
              </Stack>
            ) : null}
            {status === "Done" ? (
              <Alert color="green" title="Demo complete">
                The simulated print job completed successfully.
              </Alert>
            ) : null}
            {status === "Failed" ? (
              <Alert color="red" title="Print failed">
                The simulated print job failed.
              </Alert>
            ) : null}
            <Group justify="center">
              <Button variant="outline" onClick={() => navigate("/print")}>
                Return to Print
              </Button>
              {status === "Done" ? (
                <Button onClick={() => navigate("/profile")}>
                  View Profile
                </Button>
              ) : null}
            </Group>
          </Stack>
        </Paper>
      </Container>
    </AcmAppShell>
  );
}
