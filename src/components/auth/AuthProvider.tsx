"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "CLIENT" | "STAFF" | "ADMIN";
  status: string;
};

type ClientContext = {
  id: string;
  name: string;
  role: "OWNER" | "MANAGER" | "STAFF" | "VIEWER";
};

type AuthState = {
  user: SessionUser | null;
  client: ClientContext | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  client: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [client, setClient] = useState<ClientContext | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setClient(data.client);
      } else {
        setUser(null);
        setClient(null);
      }
    } catch {
      setUser(null);
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setClient(null);
    window.location.href = "/portal/login";
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, client, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
