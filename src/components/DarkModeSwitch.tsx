import { useContext, type ChangeEvent } from "react";
import { Switch, rem, useMantineTheme } from "@mantine/core";
import { IconMoonStars, IconSun } from "@tabler/icons-react";
import ColorSchemeContext from "@/ColorSchemeContext";

export function DarkModeSwitch() {
  const theme = useMantineTheme();
  const colorScheme = useContext(ColorSchemeContext);
  if (!colorScheme) {
    throw new Error("DarkModeSwitch must be used within ColorSchemeContext");
  }

  const handleToggle = (event: ChangeEvent<HTMLInputElement>) => {
    colorScheme.onChange(event.currentTarget.checked ? "dark" : "light");
  };

  return (
    <Switch
      aria-label="Use dark color scheme"
      size="md"
      color="dark.4"
      checked={colorScheme.colorScheme === "dark"}
      onChange={handleToggle}
      onLabel={
        <IconMoonStars
          style={{ width: rem(16), height: rem(16) }}
          stroke={2.5}
          color={theme.colors.blue[6]}
        />
      }
      offLabel={
        <IconSun
          style={{ width: rem(16), height: rem(16) }}
          stroke={2.5}
          color={theme.colors.yellow[8]}
        />
      }
    />
  );
}
