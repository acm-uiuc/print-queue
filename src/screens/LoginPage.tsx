import { useEffect } from "react";
import { Center } from "@mantine/core";
import { useLocation, useNavigate } from "react-router-dom";
import { LoginComponent } from "@/components/LoginComponent/LoginComponent";
import { useAuth } from "@/auth/useAuth";
import { AcmAppShell } from "@/components/AppShell";

export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      const state = location.state as { from?: string } | null;
      const queryPath = new URLSearchParams(location.search).get("returnTo");
      const requestedPath =
        typeof state?.from === "string" ? state.from : (queryPath ?? "");
      const isSafeInternalPath =
        requestedPath.startsWith("/") &&
        !requestedPath.startsWith("//") &&
        !requestedPath.includes("\\");
      const requestedRoute = requestedPath.split("?")[0];
      const redirectTo =
        isSafeInternalPath && requestedRoute !== "/login"
          ? requestedPath
          : "/print";
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, location.search, location.state, navigate]);

  return (
    <AcmAppShell showSidebar={false}>
      <Center mih="calc(100dvh - 92px)" px="md">
        <LoginComponent />
      </Center>
    </AcmAppShell>
  );
}
