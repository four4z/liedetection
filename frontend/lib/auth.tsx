"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ApiUser } from "@/lib/api";

interface AuthContextType {
  token: string | null;
  user: ApiUser | null;
  login: (token: string, user: ApiUser) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const canUseStorage = () => typeof window !== "undefined";

const readStoredToken = (): string | null => {
  if (!canUseStorage()) {
    return null;
  }
  return localStorage.getItem("token");
};

const readStoredUser = (): ApiUser | null => {
  if (!canUseStorage()) {
    return null;
  }

  const storedUser = localStorage.getItem("user");
  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as ApiUser;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken());
  const [user, setUser] = useState<ApiUser | null>(() => readStoredUser());
  const isLoading = false;

  const login = (newToken: string, newUser: ApiUser) => {
    setToken(newToken);
    setUser(newUser);
    if (canUseStorage()) {
      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(newUser));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    if (canUseStorage()) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  };

  const value: AuthContextType = {
    token,
    user,
    login,
    logout,
    isLoading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function getAuthHeaders(token: string | null) {
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}
