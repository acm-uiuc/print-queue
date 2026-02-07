import { Center, Loader } from '@mantine/core';
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from './useAuth';

interface ProtectedRouteProps {
  children: ReactElement;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <Center style={{ minHeight: '50vh' }}>
        <Loader size="lg" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to="/login"
        state={{ from: redirectTo }}
        replace
      />
    );
  }

  return children;
}
