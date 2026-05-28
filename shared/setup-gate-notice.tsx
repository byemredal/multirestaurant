'use client';

import type { CSSProperties } from 'react';

/**
 * Blocking notice shown by the server-side {@link SystemStateGate} when the
 * platform is not usable yet. It is a presentational client component so the
 * "retry" affordance can reload the page; the gate decision itself is made on
 * the server, so the real app shell is never sent to the browser first (no
 * flicker).
 */

const SETUP_URL =
  process.env.NEXT_PUBLIC_SETUP_URL ?? 'http://localhost:3070/setup';

export type SetupGatePhase = 'not-configured' | 'incomplete' | 'error';

const TITLES: Record<SetupGatePhase, string> = {
  'not-configured': 'Platform henüz kurulmadı',
  incomplete: 'Platform kurulumu eksik',
  error: 'API’ye ulaşılamıyor',
};

const MESSAGES: Record<SetupGatePhase, string> = {
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

export function SetupGateNotice({
  phase,
  missing = [],
}: {
  phase: SetupGatePhase;
  missing?: string[];
}) {
  return (
    <div style={styles.backdrop}>
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
            onClick={() => window.location.reload()}
            style={
              phase === 'error' ? styles.primaryButton : styles.secondaryButton
            }
          >
            Yeniden dene
          </button>
        </div>

        <p style={styles.hint}>
          Bu uygulama, platform kurulumu tamamlanana kadar kullanıma kapalıdır.
        </p>
      </div>
    </div>
  );
}

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
  message: { margin: 0, fontSize: 14, lineHeight: 1.6, color: '#475569' },
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
};
