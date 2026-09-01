import type { MouseEventHandler } from "react";
import { Button, type ButtonProps } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuth } from "@/auth/useAuth";

export function AcmLoginButton(
  props: ButtonProps & React.ComponentPropsWithoutRef<"button">,
) {
  const { login, isLoading } = useAuth();
  const { children, disabled, onClick, ...rest } = props;

  const handleClick: MouseEventHandler<HTMLButtonElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    void login().catch((error: unknown) => {
      notifications.show({
        title: "Login failed",
        message:
          error instanceof Error
            ? error.message
            : "Please clear your cookies and try again.",
        color: "red",
      });
      console.error("Login failed", error);
    });
  };

  return (
    <Button
      leftSection={null}
      color="#FF5F05"
      variant="filled"
      {...rest}
      disabled={disabled || isLoading}
      onClick={handleClick}
    >
      {children}
    </Button>
  );
}
