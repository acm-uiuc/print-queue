import { Box, Menu, Avatar, Group, Button } from "@mantine/core";
import { IconLogout, IconUser, IconPrinter } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { usePrintJobs } from "@/print/usePrintJobs";
import LogoBadge from "./Logo";
import classes from "./index.module.scss";

export const HeaderNavbar: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, logout } = useAuth();
  const { clearJobs } = usePrintJobs();
  const isLoggedIn = isAuthenticated;

  const handleLogout = async () => {
    clearJobs();
    try {
      await logout();
      // logoutRedirect will redirect the page, so this might not execute
      // But if it does, navigate to login as fallback
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // On error, navigate to login page
      navigate('/login');
    }
  };

  const getUserEmail = () => {
    return user?.email ?? 'User';
  };

  const getInitials = () => {
    const email = getUserEmail();
    const base = email.split('@')[0] ?? email;
    return base.substring(0, 2).toUpperCase();
  };

  return (
    <Box component="header" className={classes.header}>
      <div className={classes.inner}>
        <LogoBadge size="1.15rem" linkTo={isLoggedIn ? '/print' : '/login'} />
        
        {isLoggedIn ? (
        <Group gap="md">
          <Button
            variant="subtle"
            leftSection={<IconPrinter size={16} />}
            onClick={() => navigate('/print')}
          >
            Print
          </Button>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Avatar
                style={{ cursor: 'pointer' }}
                radius="xl"
                color="acmBlue"
              >
                {getInitials()}
              </Avatar>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>{getUserEmail()}</Menu.Label>
              <Menu.Item
                leftSection={<IconUser size={16} />}
                onClick={() => navigate('/profile')}
              >
                Profile
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconLogout size={16} />}
                onClick={handleLogout}
              >
                Log out
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      ) : null}
      </div>
    </Box>
  );
};
