import type { ReactNode } from "react";
import {
  AppShell as MantineAppShell,
  Divider,
  Group,
  NavLink,
  Text,
} from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { IconPrinter, IconUser } from "@tabler/icons-react";
import { Link, useLocation } from "react-router-dom";
import { DarkModeSwitch } from "@/components/DarkModeSwitch";
import { HeaderNavbar } from "@/components/Navbar";
import { AuthenticatedProfileDropdown } from "@/components/ProfileDropdown";

interface AcmAppShellProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export function AcmAppShell({
  children,
  showSidebar = true,
}: AcmAppShellProps) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const mobile = useMediaQuery("(max-width: 47.99375em)");
  const location = useLocation();
  const printActive =
    location.pathname === "/print" || location.pathname.startsWith("/queue");

  return (
    <MantineAppShell
      padding="md"
      header={{ height: 60 }}
      navbar={
        showSidebar
          ? {
              width: 200,
              breakpoint: "sm",
              collapsed: { mobile: !opened },
            }
          : undefined
      }
    >
      <MantineAppShell.Header>
        <HeaderNavbar
          navOpened={opened}
          onToggleNav={toggle}
          showSidebar={showSidebar}
        />
      </MantineAppShell.Header>

      {showSidebar ? (
        <MantineAppShell.Navbar
          p="sm"
          aria-hidden={mobile && !opened}
          inert={mobile && !opened}
        >
          <MantineAppShell.Section grow>
            <NavLink
              component={Link}
              to="/print"
              style={{ borderRadius: 5 }}
              h={48}
              mt="sm"
              active={printActive}
              label={
                <Text size="sm" fw={500}>
                  Print
                </Text>
              }
              leftSection={<IconPrinter />}
              onClick={close}
            />
            <NavLink
              component={Link}
              to="/profile"
              style={{ borderRadius: 5 }}
              h={48}
              mt="sm"
              active={location.pathname === "/profile"}
              label={
                <Text size="sm" fw={500}>
                  Profile
                </Text>
              }
              leftSection={<IconUser />}
              onClick={close}
            />
            {opened ? (
              <Group hiddenFrom="sm" mt="md" gap="md">
                <Divider w="100%" />
                <DarkModeSwitch />
                <AuthenticatedProfileDropdown />
              </Group>
            ) : null}
          </MantineAppShell.Section>
          <MantineAppShell.Section>
            <Text size="xs" fw={500}>
              &copy; {new Date().getFullYear()} ACM @ UIUC
            </Text>
            <Text size="xs" fw={500}>
              Print Queue
            </Text>
          </MantineAppShell.Section>
        </MantineAppShell.Navbar>
      ) : null}

      <MantineAppShell.Main>{children}</MantineAppShell.Main>
    </MantineAppShell>
  );
}
