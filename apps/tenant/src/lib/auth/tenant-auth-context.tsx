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
  apiBaseUrl,
  bootstrapTenantSession,
  loginTenant,
  logoutTenant,
} from '@/lib/tenant-client';
import { resumeTenantOnboarding } from '@/lib/tenant-onboarding-client';
import {
  clearContinuationToken,
  clearTenantSession,
  readTenantSession,
  writeContinuationToken,
  writeTenantSession,
  type StoredTenantSession,
} from '@/lib/storage/tenant-session';
import { toTenantStatus, type TenantStatus } from '@/lib/auth/tenant-status';
import {
  broadcastTenantAuthEvent,
  subscribeTenantAuthEvents,
} from '@/lib/auth/auth-expiry';

type TenantAuthValue = {
  /** The authenticated tenant session, or null when signed out. */
  session: StoredTenantSession | null;
  /** Coarse lifecycle state — the single input to routing. */
  status: TenantStatus | null;
  /** Raw 8-value status — used only for messaging detail (rejected/suspended). */
  onboardingStatus: string | null;
  /** True while the initial session bootstrap is in flight. */
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-read the session from storage — call after a flow writes it directly. */
  syncFromStorage: () => void;
};

const TenantAuthContext = createContext<TenantAuthValue | null>(null);

/** Reads a `?token=` onboarding continuation link from the current URL. */
function readResumeTokenFromUrl(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const token = new URLSearchParams(window.location.search).get('token');
  return token && token.trim() ? token.trim() : null;
}

/** Removes the continuation token from the URL once it has been consumed. */
function stripResumeTokenFromUrl() {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.toString());
}

function deriveStatus(session: StoredTenantSession | null): TenantStatus | null {
  if (!session) {
    return null;
  }
  return session.tenant.status ?? toTenantStatus(session.tenant.onboardingStatus);
}

function isLegacyPasswordlessOnboardingSession(session: StoredTenantSession) {
  return deriveStatus(session) === 'ONBOARDING' && session.tenant.hasPassword === false;
}

export function TenantAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredTenantSession | null>(null);
  const [status, setStatus] = useState<TenantStatus | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback((next: StoredTenantSession | null) => {
    setSession(next);
    setStatus(deriveStatus(next));
    setOnboardingStatus(next?.tenant.onboardingStatus ?? null);
  }, []);

  // ── Initial bootstrap: read the stored session and refresh it if needed ──
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      // Onboarding resume: a `?token=` continuation link takes priority over
      // any stored session so a partner can continue on a fresh device.
      const resumeToken = readResumeTokenFromUrl();
      if (resumeToken) {
        try {
          const resumed = await resumeTenantOnboarding(resumeToken);
          writeTenantSession(resumed);
          writeContinuationToken(resumed.continuationToken);
          stripResumeTokenFromUrl();
          if (!cancelled) {
            applySession(resumed);
            setLoading(false);
          }
          return;
        } catch {
          // Invalid/expired link — drop it and fall back to the stored session.
          stripResumeTokenFromUrl();
        }
      }

      const stored = readTenantSession();
      if (!stored) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      if (isLegacyPasswordlessOnboardingSession(stored)) {
        clearTenantSession();
        clearContinuationToken();
        if (!cancelled) {
          applySession(null);
          setLoading(false);
        }
        return;
      }

      try {
        const next = await bootstrapTenantSession(stored);
        if (isLegacyPasswordlessOnboardingSession(next)) {
          clearTenantSession();
          clearContinuationToken();
          if (!cancelled) {
            applySession(null);
          }
          return;
        }
        writeTenantSession(next);
        if (!cancelled) {
          applySession(next);
        }
      } catch {
        clearTenantSession();
        if (!cancelled) {
          applySession(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const next = await loginTenant(email, password);
        writeTenantSession(next);
        applySession(next);
      } catch {
        setError('Giriş başarısız. E-posta veya şifrenizi kontrol edin.');
        throw new Error('tenant_login_failed');
      }
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    if (session) {
      try {
        await logoutTenant(session);
      } catch {
        // Best-effort — clear the local session regardless.
      }
    }
    clearTenantSession();
    clearContinuationToken();
    applySession(null);
    broadcastTenantAuthEvent('owner', 'manual_logout');
  }, [session, applySession]);

  // Cross-tab: react to logout / session expiry triggered by another tab
  // (or by the centralized tenantAuthedFetch when this same tab's request
  // hit an unrecoverable 401). Only owner-subject events affect us; staff
  // events are handled by StaffAuthProvider in /staff/*.
  useEffect(() => {
    return subscribeTenantAuthEvents((event) => {
      if (event.subject !== 'owner') return;
      clearTenantSession();
      clearContinuationToken();
      applySession(null);
    });
  }, [applySession]);

  const syncFromStorage = useCallback(() => {
    applySession(readTenantSession());
  }, [applySession]);

  // ── Real-time status: subscribe to the SSE stream while authenticated ────
  const accessToken = session?.accessToken;
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const url = `${apiBaseUrl}/tenants/me/status/stream?access_token=${encodeURIComponent(
      accessToken,
    )}`;
    let source: EventSource | null = new EventSource(url);

    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as {
          status?: TenantStatus;
          onboardingStatus?: string;
        };

        if (payload.status) {
          setStatus(payload.status);
        }
        if (payload.onboardingStatus) {
          setOnboardingStatus(payload.onboardingStatus);
        }

        // Persist the change so a page refresh resumes on the right screen.
        const stored = readTenantSession();
        if (stored && payload.status) {
          const updated: StoredTenantSession = {
            ...stored,
            tenant: {
              ...stored.tenant,
              status: payload.status,
              onboardingStatus:
                payload.onboardingStatus ?? stored.tenant.onboardingStatus,
            },
          };
          writeTenantSession(updated);
          setSession(updated);
        }
      } catch {
        // Ignore malformed events.
      }
    };

    source.onerror = () => {
      // On a hard failure (e.g. expired access token) refresh the session once
      // and reconnect; EventSource handles transient drops on its own.
      source?.close();
      source = null;
      if (reconnectTimer.current) {
        return;
      }
      reconnectTimer.current = setTimeout(() => {
        reconnectTimer.current = null;
        const stored = readTenantSession();
        if (!stored) {
          return;
        }
        void bootstrapTenantSession(stored)
          .then((next) => {
            writeTenantSession(next);
            // Re-runs this effect with a fresh token.
            setSession(next);
          })
          .catch(() => {
            // Give up silently — a manual refresh will recover.
          });
      }, 5000);
    };

    return () => {
      source?.close();
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };
  }, [accessToken]);

  return (
    <TenantAuthContext.Provider
      value={{
        session,
        status,
        onboardingStatus,
        loading,
        error,
        login,
        logout,
        syncFromStorage,
      }}
    >
      {children}
    </TenantAuthContext.Provider>
  );
}

export function useTenantAuth(): TenantAuthValue {
  const context = useContext(TenantAuthContext);
  if (!context) {
    throw new Error('useTenantAuth must be used within a TenantAuthProvider.');
  }
  return context;
}
