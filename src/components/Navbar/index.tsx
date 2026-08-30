import { Box, Burger, Group } from "@mantine/core";
import { useAuth } from "@/auth/useAuth";
import { DarkModeSwitch } from "@/components/DarkModeSwitch";
import { AuthenticatedProfileDropdown } from "@/components/ProfileDropdown";
import LogoBadge from "./Logo";
import classes from "./index.module.css";

interface HeaderNavbarProps {
  navOpened: boolean;
  onToggleNav: () => void;
  showSidebar: boolean;
}

export function HeaderNavbar({
  navOpened,
  onToggleNav,
  showSidebar,
}: HeaderNavbarProps) {
  const { isAuthenticated } = useAuth();
  const actions = (
    <>
      <DarkModeSwitch />
      {isAuthenticated ? <AuthenticatedProfileDropdown /> : null}
    </>
  );

  return (
    <Box>
      <header className={classes.header}>
        <Group justify="space-between" align="center" h="100%">
          <Group justify="flex-start" align="center" h="100%" gap={10}>
            <LogoBadge linkTo={isAuthenticated ? "/print" : "/login"} />
          </Group>
          {showSidebar ? (
            <>
              <Group
                h="100%"
                justify="flex-end"
                align="center"
                gap={10}
                visibleFrom="sm"
              >
                {actions}
              </Group>
              <Burger
                opened={navOpened}
                onClick={onToggleNav}
                hiddenFrom="sm"
                aria-label="Toggle navigation"
              />
            </>
          ) : (
            <Group h="100%" justify="flex-end" align="center" gap={10}>
              {actions}
            </Group>
          )}
        </Group>
      </header>
    </Box>
  );
}
