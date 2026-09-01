import {
  ActionIcon,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoonStars, IconSun } from "@tabler/icons-react";

export function DarkModeSwitch() {
  const colorScheme = useComputedColorScheme("light");
  const { toggleColorScheme } = useMantineColorScheme();

  const nextColorScheme = colorScheme === "dark" ? "light" : "dark";
  return (
    <ActionIcon
      aria-label={`Use ${nextColorScheme} color scheme`}
      onClick={() => toggleColorScheme()}
      size="lg"
      variant="default"
    >
      {colorScheme === "dark" ? (
        <IconSun size={18} />
      ) : (
        <IconMoonStars size={18} />
      )}
    </ActionIcon>
  );
}
