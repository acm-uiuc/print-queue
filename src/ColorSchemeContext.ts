import { createContext } from "react";

export type AppColorScheme = "light" | "dark";

export interface ColorSchemeContextValue {
  colorScheme: AppColorScheme;
  onChange: (colorScheme: AppColorScheme) => void;
}

export default createContext<ColorSchemeContextValue | null>(null);
