import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient } from "./api-client";
import type { User } from "shared-types";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    if (token) {
      apiClient.setToken(token);
      // Try to get user info
      apiClient
        .getMe()
        .then((data) => {
          setUser(data.user);
        })
        .catch(() => {
          // Token expired, try to refresh
          if (refreshToken) {
            fetch("/api/auth/refresh", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
            })
              .then((res) => res.json())
              .then((data) => {
                if (data.accessToken) {
                  localStorage.setItem("accessToken", data.accessToken);
                  apiClient.setToken(data.accessToken);
                  setUser(data.user);
                } else {
                  localStorage.removeItem("accessToken");
                  localStorage.removeItem("refreshToken");
                }
              })
              .catch(() => {
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
              });
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiClient.login({ email, password });
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    apiClient.setToken(data.accessToken);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    apiClient.setToken("");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
