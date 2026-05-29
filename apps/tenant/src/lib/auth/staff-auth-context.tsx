'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  bootstrapStaffSession,
  loginStaff,
  logoutStaff,
} from '@/lib/auth/staff-client';
import {
  clearStaffSession,
  readStaffSession,
  writeStaffSession,
  type StoredStaffSession,
} from '@/lib/storage/staff-session';
import {
  broadcastTenantAuthEvent,
  subscribeTenantAuthEvents,
} from '@/lib/auth/auth-expiry';

type StaffAuthValue = {
  session: StoredStaffSession | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (session: StoredStaffSession) => void;
  syncFromStorage: () => void;
};

const StaffAuthContext = createContext<StaffAuthValue | null>(null);

/**
 * Staff auth provider. Lives ALONGSIDE TenantAuthProvider, never inside it,
 * never coupled to it. Different storage key, different session shape.
 *
 * Mounted only on `/staff/*` pages so the rest of the tenant app does not
 * pay the bootstrap cost. The provider self-bootstraps from localStorage on
 * first mount and revalidates via /staff/me; on expiry it falls back to
 * /staff/refresh.
 */
export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<StoredStaffSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const cached = readStaffSession();
    if (!cached) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    void bootstrapStaffSession(cached)
      .then((rotated) => {
        if (cancelled) return;
        // Persist the rotated tokens (matches tenant-auth-context behavior).
        if (rotated.accessToken !== cached.accessToken) {
          writeStaffSession(rotated);
        }
        setSessionState(rotated);
      })
      .catch(() => {
        if (cancelled) return;
        clearStaffSession();
        setSessionState(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setSession = useCallback((next: StoredStaffSession) => {
    writeStaffSession(next);
    setSessionState(next);
    setError(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const next = await loginStaff(email, password);
      writeStaffSession(next);
      setSessionState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'staff_login_failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const current = session;
    setSessionState(null);
    clearStaffSession();
    broadcastTenantAuthEvent('staff', 'manual_logout');
    if (current) {
      try {
        await logoutStaff(current);
      } catch {
        // best-effort revoke; local state has already cleared.
      }
    }
  }, [session]);

  // Cross-tab: a logout / session expiry on another tab (or a staff 401 in
  // this tab handled by staffAuthedFetch) clears local state. Owner-subject
  // events do not affect staff and vice versa.
  useEffect(() => {
    return subscribeTenantAuthEvents((event) => {
      if (event.subject !== 'staff') return;
      clearStaffSession();
      setSessionState(null);
    });
  }, []);

  const syncFromStorage = useCallback(() => {
    setSessionState(readStaffSession());
  }, []);

  return (
    <StaffAuthContext.Provider
      value={{ session, loading, error, login, logout, setSession, syncFromStorage }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth(): StaffAuthValue {
  const value = useContext(StaffAuthContext);
  if (!value) {
    throw new Error('useStaffAuth must be used inside <StaffAuthProvider>.');
  }
  return value;
}
