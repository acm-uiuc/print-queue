import {
  Alert,
  Anchor,
  Center,
  Group,
  Paper,
  Text,
  Title,
  type PaperProps,
} from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import brandImgUrl from "@/assets/banner-blue.png";
import { AcmLoginButton } from "./AcmLoginButton";

export function LoginComponent(props: PaperProps) {
  return (
    <Paper radius="md" p="xl" withBorder maw={520} w="100%" {...props}>
      <Center>
        <img
          src={brandImgUrl.src}
          alt="ACM Logo"
          style={{ height: "5em", marginBottom: "1em" }}
        />
      </Center>

      <Center>
        <Text size="lg" fw={500}>
          Welcome to the ACM@UIUC Print Queue
        </Text>
      </Center>

      <Alert
        mt="md"
        title={
          <Title order={5} style={{ color: "var(--illinois-blue)" }}>
            Paid ACM@UIUC Members Only
          </Title>
        }
        icon={<IconLock style={{ color: "var(--illinois-blue)" }} />}
        color="var(--illinois-blue)"
        style={{ backgroundColor: "rgba(0, 83, 179, 0.1)" }}
      >
        <Text size="sm">
          Sign in with your Illinois NetID to access the club printing service.
        </Text>
      </Alert>

      <Group grow my="md">
        <AcmLoginButton radius="xl">Sign in with Illinois NetID</AcmLoginButton>
      </Group>

      <Text ta="center" size="sm">
        Not a paid member?{" "}
        <Anchor
          href="https://www.acm.illinois.edu/membership?utm_source=printqueue"
          target="_blank"
          rel="noopener noreferrer"
          fw={600}
        >
          Sign up today
        </Anchor>
      </Text>
    </Paper>
  );
}
