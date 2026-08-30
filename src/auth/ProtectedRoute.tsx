import { Center, Loader } from "@mantine/core";
import { Navigate, useLocation } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "./useAuth";

interface ProtectedRouteProps {
  children: ReactElement;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Center style={{ minHeight: "50vh" }}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}`;
    const query = new URLSearchParams({ returnTo: redirectTo });
    return <Navigate to={`/login?${query.toString()}`} replace />;
  }

  return children;
}
