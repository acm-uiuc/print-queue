import { useEffect, useState } from "react";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { AcmAppShell } from "@/components/AppShell";
import { usePrintJobs } from "@/print/usePrintJobs";
import { useRuntimeConfig } from "@/runtimeConfig";
import type { JobStatus } from "@/screens/queueShared";
import { subscribeToJobStatus, type QueueStatusResponse } from "@/utils/api";

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

export function QueuePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { apiBaseUrl } = useRuntimeConfig();
  const { updateJobStatus } = usePrintJobs();
  const jobId = searchParams.get("jobId")?.trim() ?? "";
  const [queueStatus, setQueueStatus] = useState<QueueStatusResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQueueStatus(null);
    setError(null);
    setLoading(true);
    if (!jobId) {
      setError("No job ID was provided.");
      setLoading(false);
      return;
    }

    const subscription = subscribeToJobStatus(
      apiBaseUrl,
      jobId,
      (status) => {
        setQueueStatus(status);
        setError(null);
        setLoading(false);
        updateJobStatus(jobId, status.status);
      },
      (subscriptionError: unknown) => {
        setError(
          subscriptionError instanceof Error
            ? subscriptionError.message
            : "Failed to refresh queue status.",
        );
        setLoading(false);
      },
    );
    return subscription.close;
  }, [apiBaseUrl, jobId, updateJobStatus]);

  const StatusIcon = queueStatus ? STATUS_ICONS[queueStatus.status] : null;

  return (
    <AcmAppShell>
      <Container size="md">
        <Paper radius="md" p="xl" withBorder>
          {loading ? (
            <Center mih={300}>
              <Stack align="center" gap="md">
                <Loader />
                <Text c="dimmed">Loading queue status…</Text>
              </Stack>
            </Center>
          ) : !queueStatus ? (
            <Stack>
              <Alert color="red" title="Unable to load print job">
                {error}
              </Alert>
              <Group justify="center">
                <Button variant="outline" onClick={() => navigate("/print")}>
                  Return to Print
                </Button>
              </Group>
            </Stack>
          ) : (
            <Stack gap="xl">
              <Title order={1}>Print Status</Title>
              <Text c="dimmed" size="sm">
                Job {jobId}
              </Text>
              <Divider />

              {error ? (
                <Alert color="orange" title="Status refresh delayed">
                  {error} Retrying automatically.
                </Alert>
              ) : null}

              <Center>
                <Badge
                  size="xl"
                  variant={
                    queueStatus.status === "In queue" ? "light" : "filled"
                  }
                  color={STATUS_COLORS[queueStatus.status]}
                  leftSection={StatusIcon ? <StatusIcon size={18} /> : null}
                >
                  {queueStatus.status}
                </Badge>
              </Center>

              {queueStatus.status === "In queue" ? (
                <Stack gap="xs" align="center">
                  <Text fw={500}>Your current position</Text>
                  {typeof queueStatus.position === "number" ? (
                    <Title order={2} c="var(--illinois-blue)">
                      #{queueStatus.position}
                    </Title>
                  ) : (
                    <Text c="dimmed">Fetching your spot in line…</Text>
                  )}
                </Stack>
              ) : null}

              {queueStatus.status === "Printing" ? (
                <Stack gap="md" align="center">
                  <Loader />
                  <Text>Your document is being printed…</Text>
                </Stack>
              ) : null}

              {queueStatus.status === "Done" ? (
                <Alert color="green" title="Printed">
                  Your document has been printed successfully.
                </Alert>
              ) : null}

              {queueStatus.status === "Failed" ? (
                <Alert color="red" title="Print failed">
                  Your document failed to print. Try again or contact support.
                </Alert>
              ) : null}

              <Group justify="center">
                <Button variant="outline" onClick={() => navigate("/print")}>
                  Print Another
                </Button>
                {queueStatus.status === "Done" ? (
                  <Button onClick={() => navigate("/profile")}>
                    View Profile
                  </Button>
                ) : null}
              </Group>
            </Stack>
          )}
        </Paper>
      </Container>
    </AcmAppShell>
  );
}
