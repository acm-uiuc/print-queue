import type { MouseEventHandler } from 'react';
import { Button, type ButtonProps } from '@mantine/core';
import blockI from '@/assets/blockI.png';
import { useAuth } from '@/auth/useAuth';

export function AcmLoginButton(
  props: ButtonProps & React.ComponentPropsWithoutRef<'button'>
) {
  const { login } = useAuth();
  const { onClick, disabled, ...rest } = props;

  const handleClick: MouseEventHandler<HTMLButtonElement> = async (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    try {
      await login();
    } catch (error: unknown) {
      const authError = typeof error === 'object' && error !== null
        ? (error as { errorCode?: string; message?: string })
        : {};
      if (authError.errorCode === 'interaction_in_progress' || 
          authError.message?.includes('interaction_in_progress')) {
        console.log('Handling interaction_in_progress error in button');
        return;
      }
      console.error('Login failed', error);
    }
  };

  return (
    <Button
      disabled={disabled}
      variant="filled"
      leftSection={
        <img
          src={blockI}
          alt="Illinois I Logo"
          style={{ height: '20px', width: 'auto' }}
        />
      }
      styles={{
        root: {
          backgroundColor: '#FF5F05',
          color: 'white',
          fontWeight: 600,
          fontSize: '0.9375rem',
          height: '44px',
          padding: '0 1.5rem',
          border: 'none',
          boxShadow: '0 2px 8px rgba(255, 95, 5, 0.25)',
          borderRadius: '8px',
          transition: 'all 150ms ease',
          '&:hover': {
            backgroundColor: '#E65404',
            boxShadow: '0 4px 12px rgba(255, 95, 5, 0.35)',
            transform: 'translateY(-1px)',
          },
          '&:disabled': { backgroundColor: '#E0E0E0', color: '#888' },
        },
        section: {
          marginRight: '0.5rem',
        },
        label: {
          display: 'flex',
          alignItems: 'center',
          lineHeight: 1.2,
        },
      }}
      onClick={handleClick}
      {...rest}
    >
      Sign in with Illinois NetID
    </Button>
  );
}
