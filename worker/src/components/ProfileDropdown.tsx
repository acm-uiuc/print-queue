import { useState } from "react";
import {
  Avatar,
  Box,
  Group,
  Menu,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronDown, IconLogout, IconUser } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";

export function AuthenticatedProfileDropdown() {
  const [opened, setOpened] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  if (!user) return null;

  const displayName = user.name || user.email;
  const handleLogout = async () => {
    setOpened(false);
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
    <Menu
      width={300}
      position="bottom-end"
      shadow="md"
      opened={opened}
      onChange={setOpened}
    >
      <Menu.Target>
        <UnstyledButton
          aria-label="Open account menu"
          aria-expanded={opened}
          px="xs"
        >
          <Group gap="xs" wrap="nowrap">
            <Avatar name={displayName} color="initials" />
            <IconChevronDown size={16} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Box px="md" py="xs">
          <Text fw={500}>{displayName}</Text>
          <Text size="sm" c="dimmed">
            {user.email}
          </Text>
        </Box>
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconUser size={16} />}
          onClick={() => navigate("/profile")}
        >
          Profile
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={<IconLogout size={16} />}
          onClick={() => void handleLogout()}
        >
          Log Out
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
