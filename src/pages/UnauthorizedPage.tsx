import { Box, Paper, Title, Text, Button, Center, Alert } from '@mantine/core';
import { /* IconLock, */ IconArrowLeft } from '@tabler/icons-react';
import { BsFillLockFill } from 'react-icons/bs';
import { Link } from 'react-router-dom';
import { HeaderNavbar } from '@/components/Navbar';

export function UnauthorizedPage() {
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
          p="2.5rem"
          withBorder
          style={{ maxWidth: '640px', width: '100%' }}
        >
          <Center>
            <BsFillLockFill size={80} color="#0053B3" style={{ marginBottom: '1.5rem' }} />
          </Center>
          <Title order={1} ta="center" mb="md">
            Access Denied
          </Title>
          <Alert color="acmBlue" mb="xl" radius="md">
            <Text size="md">
              This service is only available to paid ACM@UIUC members.
            </Text>
          </Alert>
          <Text size="md" ta="center" c="dimmed" mb="xl">
            blah blah blah blah
          </Text>
          <Box style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Button
              component={Link}
              to="/"
              variant="light"
              size="lg"
              radius="xl"
              leftSection={<IconArrowLeft size={16} />}
            >
              Go Back
            </Button>
            <Button
              component="a"
              href="https://www.acm.illinois.edu/membership?utm_source=printqueue"
              target="_blank"
              rel="noopener noreferrer"
              color="acmBlue"
              size="lg"
              radius="xl"
            >
              Buy Membership
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
