'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

/**
 * Platform initialization gate — shared by apps/web, apps/admin and
 * apps/tenant (path-mapped as `@shared/system-state-gate`).
 *
 * It calls the public `GET /config/branding` endpoint and inspects the
 * branding fields one by one. The app may only render when every required
 * field (project name, support email, country, language, currency, timezone)
 * is present; otherwise it shows a blocking notice pointing to the setup
 * wizard.
 *
 * PASSIVE AFTER SETUP: once a ready platform is confirmed, the result is
 * cached in localStorage. On every later load the app renders immediately
 * with NO loading screen — a silent background revalidation runs only to
 * self-heal if the backend was wiped. The check is effectively invisible
 * once setup is complete.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';
const SETUP_URL =
  process.env.NEXT_PUBLIC_SETUP_URL ?? 'http://localhost:3070/setup';

/** localStorage flag set once the platform is confirmed ready. */
const READY_CACHE_KEY = 'lz_platform_ready';

/** Branding fields that must exist before the platform counts as ready. */
const REQUIRED_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'platformName', label: 'Proje adı' },
  { key: 'supportEmail', label: 'Destek e-postası' },
  { key: 'defaultCountry', label: 'Ülke' },
  { key: 'defaultLanguage', label: 'Sistem dili' },
  { key: 'defaultCurrency', label: 'Para birimi' },
  { key: 'defaultTimezone', label: 'Saat dilimi' },
];

// `pass` = render the app. Everything else renders a blocking screen.
type GatePhase = 'pass' | 'checking' | 'not-configured' | 'incomplete' | 'error';

// useLayoutEffect on the client (runs before paint), useEffect on the server.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function readReadyCache(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      window.localStorage.getItem(READY_CACHE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

function writeReadyCache(ready: boolean): void {
  try {
    if (typeof window === 'undefined') return;
    if (ready) {
      window.localStorage.setItem(READY_CACHE_KEY, '1');
    } else {
      window.localStorage.removeItem(READY_CACHE_KEY);
    }
  } catch {
    /* localStorage unavailable — fall back to a live check each load. */
  }
}

export function SystemStateGate({ children }: { children: ReactNode }) {
  // Starts as `pass` so the server-rendered HTML is the real app — a cached,
  // already-set-up platform then never flashes a loading screen.
  const [phase, setPhase] = useState<GatePhase>('pass');
  const [missing, setMissing] = useState<string[]>([]);

  const check = useCallback(async (silent: boolean) => {
    if (!silent) {
      setPhase('checking');
    }
    try {
      const response = await fetch(`${API_BASE_URL}/config/branding`, {
        cache: 'no-store',
      });

      // 404 → no PlatformSetup row: the platform was never initialized.
      if (response.status === 404) {
        writeReadyCache(false);
        setMissing([]);
        setPhase('not-configured');
        return;
      }
      if (!response.ok) {
        // A transient error must not lock out an already-set-up platform.
        if (!silent) setPhase('error');
        return;
      }

      const branding = (await response.json()) as Record<string, unknown>;
      const gaps = REQUIRED_FIELDS.filter((field) => {
        const value = branding[field.key];
        return typeof value !== 'string' || value.trim() === '';
      }).map((field) => field.label);

      if (gaps.length > 0) {
        writeReadyCache(false);
        setMissing(gaps);
        setPhase('incomplete');
        return;
      }

      writeReadyCache(true);
      setPhase('pass');
    } catch {
      // Network failure: during a silent revalidate keep trusting the cache.
      if (!silent) setPhase('error');
    }
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (readReadyCache()) {
      // Setup already completed on this browser → render the app at once,
      // no loading screen. Revalidate silently so a wiped backend self-heals.
      void check(true);
    } else {
      void check(false);
    }
  }, [check]);

  if (phase === 'pass') {
    return <>{children}</>;
  }

  return (
    <GateScreen phase={phase} missing={missing} onRetry={() => void check(false)} />
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Blocking screen
   ──────────────────────────────────────────────────────────────────────── */

function GateScreen({
  phase,
  missing,
  onRetry,
}: {
  phase: Exclude<GatePhase, 'pass'>;
  missing: string[];
  onRetry: () => void;
}) {
  return (
    <div style={styles.backdrop}>
      <style>{SPIN_KEYFRAMES}</style>

      {phase === 'checking' ? (
        <div style={styles.card}>
          <div style={styles.spinner} aria-hidden />
          <p style={styles.message}>Sistem durumu kontrol ediliyor…</p>
        </div>
      ) : (
        <div style={styles.card}>
          <div
            style={{
              ...styles.iconWrap,
              ...(phase === 'error' ? styles.iconError : styles.iconWarning),
            }}
            aria-hidden
          >
            <WarningIcon />
          </div>

          <h1 style={styles.title}>{TITLES[phase]}</h1>
          <p style={styles.message}>{MESSAGES[phase]}</p>

          {phase === 'incomplete' && missing.length > 0 ? (
            <ul style={styles.missingList}>
              {missing.map((label) => (
                <li key={label} style={styles.missingItem}>
                  {label}
                </li>
              ))}
            </ul>
          ) : null}

          <div style={styles.actions}>
            {phase === 'not-configured' || phase === 'incomplete' ? (
              <a href={SETUP_URL} style={styles.primaryButton}>
                Kurulum sihirbazını aç
              </a>
            ) : null}
            <button
              type="button"
              onClick={onRetry}
              style={
                phase === 'error'
                  ? styles.primaryButton
                  : styles.secondaryButton
              }
            >
              Yeniden dene
            </button>
          </div>

          <p style={styles.hint}>
            Bu uygulama, platform kurulumu tamamlanana kadar kullanıma kapalıdır.
          </p>
        </div>
      )}
    </div>
  );
}

const TITLES: Record<Exclude<GatePhase, 'pass' | 'checking'>, string> = {
  'not-configured': 'Platform henüz kurulmadı',
  incomplete: 'Platform kurulumu eksik',
  error: 'API’ye ulaşılamıyor',
};

const MESSAGES: Record<Exclude<GatePhase, 'pass' | 'checking'>, string> = {
  'not-configured':
    'Bu uygulamayı kullanabilmek için önce platform kurulumunun ' +
    '(proje adı, ülke, sistem dili ve temel ayarlar) tamamlanması gerekir.',
  incomplete:
    'Platform kurulumu başlatılmış ancak aşağıdaki zorunlu alanlar eksik. ' +
    'Kurulum sihirbazından bu bilgileri tamamlayın.',
  error:
    'Sistem durumu doğrulanamadı. API’nin çalışıyor olduğundan emin olun ve ' +
    'yeniden deneyin.',
};

function WarningIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

const SPIN_KEYFRAMES =
  '@keyframes lz-gate-spin { to { transform: rotate(360deg); } }';

const styles: Record<string, CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483647,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    background: '#f1f5f9',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    boxShadow: '0 12px 40px -12px rgba(15, 23, 42, 0.25)',
    padding: '32px 28px',
    textAlign: 'center',
  },
  iconWrap: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 52,
    borderRadius: '50%',
    marginBottom: 16,
  },
  iconWarning: { background: '#fef3c7', color: '#b45309' },
  iconError: { background: '#fee2e2', color: '#b91c1c' },
  title: {
    margin: '0 0 8px',
    fontSize: 19,
    fontWeight: 600,
    color: '#0f172a',
    letterSpacing: '-0.01em',
  },
  message: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: '#475569',
  },
  missingList: {
    margin: '16px 0 0',
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  missingItem: {
    padding: '4px 10px',
    borderRadius: 999,
    background: '#fff7ed',
    border: '1px solid #fed7aa',
    color: '#9a3412',
    fontSize: 12.5,
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginTop: 22,
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    padding: '0 18px',
    borderRadius: 10,
    border: '1px solid #f97316',
    background: '#f97316',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    padding: '0 18px',
    borderRadius: 10,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  hint: {
    margin: '18px 0 0',
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.5,
  },
  spinner: {
    width: 34,
    height: 34,
    margin: '0 auto 14px',
    borderRadius: '50%',
    border: '3px solid #e2e8f0',
    borderTopColor: '#f97316',
    animation: 'lz-gate-spin 720ms linear infinite',
  },
};
