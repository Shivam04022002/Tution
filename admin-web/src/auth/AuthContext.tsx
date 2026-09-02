import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as authApi from '../api/auth';
import { ApiError, configureClient } from '../api/client';
import { SESSION_STORAGE_KEY } from '../config/env';
import type { AuthUser } from '../types';
import { permissionGranted, type Permission } from './permissions';

interface StoredSession {
  token: string;
  user: AuthUser;
}

type SessionEndReason = 'expired' | 'signed-out' | null;

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  /** True until the persisted session has been re-validated against `/auth/me`. */
  restoring: boolean;
  signIn: (emailOrMobile: string, password: string) => Promise<void>;
  signOut: () => void;
  /** UX-level permission check. Backend authorization still applies. */
  can: (permission: Permission) => boolean;
  sessionEndReason: SessionEndReason;
  clearSessionEndReason: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string' && parsed.user) return parsed as StoredSession;
  } catch {
    // Corrupt or unreadable storage is treated as "no session".
  }
  return null;
}

function writeStoredSession(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Private-mode storage failures must not break the session in memory.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initialiser: localStorage is read once, not on every render.
  const [initial] = useState(readStoredSession);

  const [token, setToken] = useState<string | null>(initial?.token ?? null);
  const [user, setUser] = useState<AuthUser | null>(initial?.user ?? null);
  const [restoring, setRestoring] = useState(Boolean(initial));
  const [sessionEndReason, setSessionEndReason] = useState<SessionEndReason>(null);

  // The client reads the live token through a ref so a re-render is never
  // needed for a request to pick up the current credentials.
  const tokenRef = useRef<string | null>(token);
  tokenRef.current = token;

  const endSession = useCallback((reason: SessionEndReason) => {
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    writeStoredSession(null);
    setSessionEndReason(reason);
  }, []);

  useEffect(() => {
    configureClient({
      getToken: () => tokenRef.current,
      // Any 401 from any endpoint means the JWT is gone or expired.
      onUnauthorized: () => {
        if (tokenRef.current) endSession('expired');
      },
    });
  }, [endSession]);

  // Re-validate a restored session before trusting the cached role.
  useEffect(() => {
    if (!initial) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await authApi.getCurrentUser();
        if (cancelled) return;

        const fresh = response.user;
        if (fresh?.role !== 'admin') {
          endSession('signed-out');
          return;
        }
        setUser(fresh);
        writeStoredSession({ token: initial.token, user: fresh });
      } catch (error) {
        if (cancelled) return;
        // A 401 already cleared the session via onUnauthorized. Anything else
        // (server down, offline) keeps the cached session so a transient
        // backend blip does not sign the admin out.
        if (error instanceof ApiError && error.status === 401) endSession('expired');
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initial, endSession]);

  const signIn = useCallback(async (emailOrMobile: string, password: string) => {
    const result = await authApi.login(emailOrMobile, password);

    if (result.role !== 'admin') {
      throw new ApiError(
        403,
        'This account does not have admin access. Use the mobile app for parent, tutor or staff sign-in.'
      );
    }

    const session: StoredSession = { token: result.token, user: result.user };
    tokenRef.current = result.token;
    setToken(result.token);
    setUser(result.user);
    writeStoredSession(session);
    setSessionEndReason(null);
  }, []);

  const signOut = useCallback(() => {
    // Fire-and-forget: the backend's logout is a no-op for JWTs, and the local
    // session must be cleared whether or not the call lands.
    authApi.logout().catch(() => {});
    endSession('signed-out');
  }, [endSession]);

  const can = useCallback(
    (permission: Permission) => {
      if (!user || user.role !== 'admin') return false;
      return permissionGranted(user.permissions, permission);
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      restoring,
      signIn,
      signOut,
      can,
      sessionEndReason,
      clearSessionEndReason: () => setSessionEndReason(null),
    }),
    [user, token, restoring, signIn, signOut, can, sessionEndReason]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
