import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, type AuthStatus, type AuthUser } from "./api";
import {
  clearApiUrl,
  clearToken,
  getApiUrl,
  getToken,
  getUserEmail,
  setApiUrl as persistApiUrl,
  setToken as persistToken,
  setUserEmail as persistUserEmail,
} from "./storage";

type AuthState = {
  ready: boolean;
  apiUrl: string | null;
  token: string | null;
  user: AuthUser | null;
  hasUser: boolean | null;
  error: string | null;
  setServerUrl: (url: string) => Promise<void>;
  refreshStatus: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetServer: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [apiUrl, setApiUrlState] = useState<string | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const url = await getApiUrl();
    if (!url) {
      setHasUser(null);
      return;
    }
    const status = await apiRequest<AuthStatus>("/auth/status", { auth: false, apiUrl: url });
    setHasUser(status.hasUser);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [storedUrl, storedToken, storedEmail] = await Promise.all([
          getApiUrl(),
          getToken(),
          getUserEmail(),
        ]);
        if (cancelled) return;

        setApiUrlState(storedUrl);
        setTokenState(storedToken);

        if (storedUrl) {
          try {
            const status = await apiRequest<AuthStatus>("/auth/status", {
              auth: false,
              apiUrl: storedUrl,
            });
            if (cancelled) return;
            setHasUser(status.hasUser);

            if (storedToken) {
              setUser({ id: 0, email: storedEmail ?? "", createdAt: "" });
            }
          } catch {
            if (cancelled) return;
            setHasUser(Boolean(storedToken));
            if (storedToken) {
              setUser({ id: 0, email: storedEmail ?? "", createdAt: "" });
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to bootstrap auth");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setServerUrl = useCallback(async (url: string) => {
    setError(null);
    const normalized = await persistApiUrl(url);
    setApiUrlState(normalized);
    const status = await apiRequest<AuthStatus>("/auth/status", {
      auth: false,
      apiUrl: normalized,
    });
    setHasUser(status.hasUser);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const result = await apiRequest<{ token: string; user: AuthUser }>("/auth/login", {
      auth: false,
      body: { email, password },
    });
    await persistToken(result.token);
    await persistUserEmail(result.user.email);
    setTokenState(result.token);
    setUser(result.user);
    setHasUser(true);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setError(null);
    const result = await apiRequest<{ token: string; user: AuthUser }>("/auth/register", {
      auth: false,
      body: { email, password },
    });
    await persistToken(result.token);
    await persistUserEmail(result.user.email);
    setTokenState(result.token);
    setUser(result.user);
    setHasUser(true);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const resetServer = useCallback(async () => {
    await clearToken();
    await clearApiUrl();
    setTokenState(null);
    setUser(null);
    setApiUrlState(null);
    setHasUser(null);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      apiUrl,
      token,
      user,
      hasUser,
      error,
      setServerUrl,
      refreshStatus,
      login,
      register,
      logout,
      resetServer,
    }),
    [
      ready,
      apiUrl,
      token,
      user,
      hasUser,
      error,
      setServerUrl,
      refreshStatus,
      login,
      register,
      logout,
      resetServer,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
