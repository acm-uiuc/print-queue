import { useEffect } from 'react';
import { Box } from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';
import { HeaderNavbar } from '@/components/Navbar';
import { LoginComponent } from '@/components/LoginComponent/LoginComponent';
import { useAuth } from '@/auth/useAuth';

export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      const state = location.state as { from?: string } | null;
      const requestedPath = typeof state?.from === 'string' ? state.from : '';
      const isSafeInternalPath =
        requestedPath.startsWith('/') && !requestedPath.startsWith('//');
      const redirectTo =
        isSafeInternalPath && requestedPath !== '/login'
          ? requestedPath
          : '/print';
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  return (
    <Box
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#f6f8fc',
      }}
    >
      <HeaderNavbar />
      <Box
        component="main"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 2rem',
        }}
      >
        <LoginComponent />
      </Box>
    </Box>
  );
}
