import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Popover,
  SimpleGrid,
  Text,
  ThemeIcon,
  UnstyledButton,
  rem,
  useMantineTheme,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronDown, IconMail, IconUser } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { usePrintJobs } from "@/print/usePrintJobs";
import classes from "@/components/Navbar/index.module.css";

export function AuthenticatedProfileDropdown() {
  const [opened, setOpened] = useState(false);
  const theme = useMantineTheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { clearJobs } = usePrintJobs();
  if (!user) return null;

  const displayName = user.name || user.email;
  const handleLogout = async () => {
    clearJobs();
    try {
      await logout();
    } catch (error: unknown) {
      notifications.show({
        title: "Logout failed",
        message: error instanceof Error ? error.message : "Please try again.",
        color: "red",
      });
      navigate("/login", { replace: true });
    }
  };

  return (
    <Popover
      width={300}
      position="bottom"
      radius="md"
      shadow="md"
      withinPortal
      opened={opened}
      onClose={() => setOpened(false)}
      zIndex={1_000_010}
    >
      <Popover.Target>
        <UnstyledButton
          className={classes.link}
          aria-label="Open account menu"
          aria-expanded={opened}
          onClick={() => setOpened((current) => !current)}
        >
          <Center inline>
            <Box component="span" mr={5}>
              <Avatar name={displayName} color="initials" />
            </Box>
            <IconChevronDown
              style={{ width: rem(16), height: rem(16) }}
              color={theme.colors.blue[6]}
            />
          </Center>
        </UnstyledButton>
      </Popover.Target>

      <Popover.Dropdown
        style={{ overflow: "hidden" }}
        aria-label="Authenticated account menu"
      >
        <SimpleGrid cols={1} spacing={0}>
          <Box className={classes.subLink}>
            <Group wrap="nowrap" align="flex-start">
              <ThemeIcon size={40} variant="default" radius="md">
                <IconUser
                  style={{ width: rem(22), height: rem(22) }}
                  color={theme.colors.blue[6]}
                />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">
                  Name
                </Text>
                <Text size="sm" fw={500}>
                  {displayName}
                </Text>
              </div>
            </Group>
          </Box>
          <Box className={classes.subLink}>
            <Group wrap="nowrap" align="flex-start">
              <ThemeIcon size={40} variant="default" radius="md">
                <IconMail
                  style={{ width: rem(22), height: rem(22) }}
                  color={theme.colors.blue[6]}
                />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">
                  Email
                </Text>
                <Text size="sm" fw={500}>
                  {user.email}
                </Text>
              </div>
            </Group>
          </Box>
          <Divider my="sm" />
          <Button
            mb="sm"
            fullWidth
            onClick={() => {
              setOpened(false);
              navigate("/profile");
            }}
          >
            Profile
          </Button>
          <Button variant="outline" fullWidth onClick={handleLogout}>
            Log Out
          </Button>
        </SimpleGrid>
      </Popover.Dropdown>
    </Popover>
  );
}
