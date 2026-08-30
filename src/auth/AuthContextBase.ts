import { createContext } from "react";
import type { AccountInfo } from "@azure/msal-browser";

export interface AuthUser {
  email: string;
  name?: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  isReady: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  activeAccount: AccountInfo | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
