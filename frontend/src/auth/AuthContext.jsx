import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authed | anon

  // On first load, ask the server whether the cookie is still valid.
  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then(({ user }) => {
        if (cancelled) return;
        setUser(user);
        setStatus("authed");
      })
      .catch(() => {
        if (!cancelled) setStatus("anon");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const { user } = await api.login(credentials);
    setUser(user);
    setStatus("authed");
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setStatus("anon");
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout }),
    [user, status, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
