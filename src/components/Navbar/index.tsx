import { Burger, Group } from "@mantine/core";
import { useAuth } from "@/auth/useAuth";
import { DarkModeSwitch } from "@/components/DarkModeSwitch";
import { AuthenticatedProfileDropdown } from "@/components/ProfileDropdown";
import LogoBadge from "./Logo";

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
    <Group justify="space-between" h="100%" px="md">
      <LogoBadge linkTo={isAuthenticated ? "/print" : "/login"} />
      {showSidebar ? (
        <>
          <Group gap="sm" visibleFrom="sm">
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
        <Group gap="sm">{actions}</Group>
      )}
    </Group>
  );
}
