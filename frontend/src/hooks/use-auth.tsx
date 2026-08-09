"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  api,
  clearSession,
  getStoredUser,
  getToken,
  storeSession,
  type StoredUser,
} from "@/lib/api";

interface AuthContextValue {
  user: StoredUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  registerPatient: (data: Record<string, unknown>) => Promise<boolean>;
  registerHospital: (data: Record<string, unknown>) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (patch: Partial<StoredUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (getToken()) {
      setUser(getStoredUser());
      api<StoredUser>("/auth/me")
        .then((me) => {
          setUser(me);
          localStorage.setItem("ss_user", JSON.stringify(me));
        })
        .catch(() => {
          clearSession();
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await api<{ user: StoredUser; tokens: { access_token: string; refresh_token: string } }>(
        "/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }) }
      );
      storeSession(data.tokens, data.user);
      setUser(data.user);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Login failed");
      return false;
    }
  }, []);

  const registerPatient = useCallback(async (data: Record<string, unknown>) => {
    try {
      const res = await api<{ user: StoredUser; tokens: { access_token: string; refresh_token: string } }>(
        "/auth/register/patient",
        { method: "POST", body: JSON.stringify(data) }
      );
      storeSession(res.tokens, res.user);
      setUser(res.user);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
      return false;
    }
  }, []);

  const registerHospital = useCallback(async (data: Record<string, unknown>) => {
    try {
      const res = await api<{ user: StoredUser; tokens: { access_token: string; refresh_token: string } }>(
        "/auth/register/hospital",
        { method: "POST", body: JSON.stringify(data) }
      );
      storeSession(res.tokens, res.user);
      setUser(res.user);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Registration failed");
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    router.push("/");
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api<StoredUser>("/auth/me");
      setUser(me);
      localStorage.setItem("ss_user", JSON.stringify(me));
    } catch {
      /* ignore */
    }
  }, []);

  const updateUser = useCallback((patch: Partial<StoredUser>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, registerPatient, registerHospital, logout, refreshUser, updateUser }),
    [user, loading, login, registerPatient, registerHospital, logout, refreshUser, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function dashboardPath(role: string) {
  switch (role) {
    case "patient":
      return "/dashboard/patient";
    case "doctor":
      return "/dashboard/doctor";
    case "receptionist":
      return "/dashboard/reception";
    case "admin":
      return "/dashboard/admin";
    case "super_admin":
      return "/dashboard/superadmin";
    default:
      return "/";
  }
}
