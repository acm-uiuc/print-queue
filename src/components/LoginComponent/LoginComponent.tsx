import {
  Text,
  Paper,
  Divider,
  Center,
  Alert,
  Anchor,
  Title,
  type PaperProps,
} from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { AcmLoginButton } from './AcmLoginButton';
import brandImgUrl from '@/assets/banner-blue.png';

export function LoginComponent(props: PaperProps) {
  return (
    <Paper
      radius="lg"
      p="2.5rem"
      withBorder
      style={{
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 10px 40px rgba(0, 36, 77, 0.12)',
      }}
      {...props}
    >
      <Center mb="lg">
        <img
          src={brandImgUrl}
          alt="ACM Logo"
          style={{ height: '4rem', width: 'auto' }}
        />
      </Center>
      
      <Title order={1} ta="center" fw={700} mb="sm" style={{ color: '#1b335c' }}>
        Welcome to Print Queue
      </Title>
      
      <Text ta="center" size="md" c="dimmed" mb="xl">
        ACM@UIUC's printing service
      </Text>

      <Divider label="Student Login" labelPosition="center" my="xl" />

      <AcmLoginButton fullWidth size="lg" mb="xl">
        Sign in with Illinois NetID
      </AcmLoginButton>

      <Alert
        title={<Text size="md" fw={600}>Paid ACM@UIUC Members Only</Text>}
        icon={<IconLock size={20} />}
        color="acmBlue"
        variant="light"
        radius="md"
      >
        <Text size="md">
          Not a paid member?{' '}
          <Anchor
            size="md"
            href="https://www.acm.illinois.edu/membership?utm_source=printqueue"
            target="_blank"
            rel="noopener noreferrer"
            fw={600}
          >
            Sign up today!
          </Anchor>
        </Text>
      </Alert>
    </Paper>
  );
}
