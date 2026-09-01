import { Center } from "@mantine/core";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { AcmAppShell } from "@/components/AppShell";
import { LoginComponent } from "@/components/LoginComponent/LoginComponent";

export default function LoginPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (isAuthenticated) {
    const requestedPath =
      new URLSearchParams(location.search).get("returnTo") ?? "";
    const isSafePath =
      requestedPath.startsWith("/") &&
      !requestedPath.startsWith("//") &&
      !requestedPath.includes("\\") &&
      requestedPath.split("?")[0] !== "/login";
    return <Navigate to={isSafePath ? requestedPath : "/print"} replace />;
  }

  return (
    <AcmAppShell showSidebar={false}>
      <Center mih="calc(100dvh - 92px)" px="md">
        <LoginComponent />
      </Center>
    </AcmAppShell>
  );
}
