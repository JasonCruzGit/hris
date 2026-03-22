import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, setToken, type Role } from "../api/client";

type Me = {
  id: string;
  email: string;
  role: Role;
  employee?: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    department?: { name: string; id: string };
  } | null;
};

type AuthState = {
  token: string | null;
  user: Me | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = getToken();
    setTok(t);
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api<{ user: { id: string; email: string; role: Role; employee: Me["employee"] } }>(
        "/api/auth/me",
        { token: t }
      );
      setUser({
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        employee: data.user.employee ?? null,
      });
    } catch {
      setToken(null);
      setTok(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string; user: Me }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      token: null,
    });
    setToken(res.token);
    setTok(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setTok(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      login,
      logout,
      refresh,
    }),
    [token, user, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
