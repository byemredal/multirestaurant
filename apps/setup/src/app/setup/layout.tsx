'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { SetupShell } from '@/components/SetupShell';
import { setupButtonClass } from '@/components/SetupButton';
import { adminLoginUrl } from '@/lib/config';
import { getSystemState } from '@/lib/setup-api';
import { SetupProvider } from '@/lib/setup-context';

type GatePhase = 'checking' | 'open' | 'redirecting' | 'initializing' | 'error';

/**
 * Gate for the whole setup wizard. It runs once when the setup app is opened
 * (and on every full refresh) and decides whether the wizard may be used:
 *
 *  - READY         → setup is already done; hand off to the admin sign-in.
 *  - INITIALIZING  → a run is in progress; show a wait screen.
 *  - UNINITIALIZED → render the wizard (steps live as children).
 *
 * This is what makes the wizard fully passive after setup: refreshing any
 * step once the platform is READY no longer shows an editable, empty form.
 */
export default function SetupLayout({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<GatePhase>('checking');

  const check = useCallback(async () => {
    setPhase('checking');
    try {
      const { state } = await getSystemState();
      if (state === 'READY') {
        setPhase('redirecting');
        window.location.replace(adminLoginUrl);
      } else if (state === 'INITIALIZING') {
        setPhase('initializing');
      } else {
        setPhase('open');
      }
    } catch {
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  if (phase === 'open') {
    return (
      <SetupProvider>
        <SetupShell>{children}</SetupShell>
      </SetupProvider>
    );
  }

  return <SetupGateNotice phase={phase} onRetry={() => void check()} />;
}

function SetupGateNotice({
  phase,
  onRetry,
}: {
  phase: Exclude<GatePhase, 'open'>;
  onRetry: () => void;
}) {
  return (
    <div className="flex min-h-screen items-stretch justify-center p-6 max-[880px]:p-0">
      <div className="w-full max-w-[460px] rounded-xl border border-line bg-white shadow">
        <div className="flex flex-col items-center gap-3 px-2 py-9 text-center">
          {phase === 'checking' || phase === 'redirecting' ? (
            <span
              className="h-8 w-8 animate-spin rounded-full border-[3px] border-surface-muted border-t-accent"
              aria-hidden
            />
          ) : null}

          {phase === 'checking' ? (
            <>
              <span className="text-[15px] font-semibold text-ink">
                Checking setup status…
              </span>
              <p className="max-w-[340px] text-[13px] leading-[1.55] text-ink-muted">
                Reading the platform state before opening the wizard.
              </p>
            </>
          ) : null}

          {phase === 'redirecting' ? (
            <>
              <span className="text-[15px] font-semibold text-ink">
                Setup already complete
              </span>
              <p className="max-w-[340px] text-[13px] leading-[1.55] text-ink-muted">
                This platform is already initialized. Redirecting you to the
                admin panel sign-in…
              </p>
              <a
                className={setupButtonClass({ variant: 'primary' })}
                href={adminLoginUrl}
              >
                Go to admin sign-in
              </a>
            </>
          ) : null}

          {phase === 'initializing' ? (
            <>
              <span className="text-[15px] font-semibold text-ink">
                Setup is in progress
              </span>
              <p className="max-w-[340px] text-[13px] leading-[1.55] text-ink-muted">
                The platform is currently being initialized. Wait a moment,
                then refresh.
              </p>
              <button
                type="button"
                className={setupButtonClass({ variant: 'primary' })}
                onClick={onRetry}
              >
                Refresh
              </button>
            </>
          ) : null}

          {phase === 'error' ? (
            <>
              <span className="text-[15px] font-semibold text-ink">
                Cannot reach the API
              </span>
              <p className="max-w-[340px] text-[13px] leading-[1.55] text-ink-muted">
                The setup service could not connect to the backend API. Make
                sure the API is running, then try again.
              </p>
              <button
                type="button"
                className={setupButtonClass({ variant: 'primary' })}
                onClick={onRetry}
              >
                Retry
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
