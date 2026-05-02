"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearStoredAuth,
  getStoredAuth,
  hydrateRestaurantSession,
  normalizeAuthSession,
  setStoredAuth,
} from "@/lib/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = getStoredAuth();
    if (!stored) {
      setReady(true);
      return;
    }

    setAuth(stored);
    hydrateRestaurantSession(stored)
      .then((session) => {
        if (session) {
          setAuth(session);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const saveAuth = async (sessionLike, { hydrate = false } = {}) => {
    const normalized = normalizeAuthSession(sessionLike);
    if (!normalized) {
      clearStoredAuth();
      setAuth(null);
      return null;
    }

    const next = hydrate
      ? await hydrateRestaurantSession(normalized)
      : normalized;
    const finalSession = next || normalized;

    setStoredAuth(finalSession);
    setAuth(finalSession);
    return finalSession;
  };

  const signOut = () => {
    clearStoredAuth();
    setAuth(null);
  };

  const value = useMemo(
    () => ({
      auth,
      ready,
      saveAuth,
      signOut,
      refreshAuth: async () => {
        if (!auth) return null;
        const next = await hydrateRestaurantSession(auth);
        if (next) {
          setAuth(next);
        }
        return next;
      },
    }),
    [auth, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
