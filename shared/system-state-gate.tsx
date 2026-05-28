import type { ReactNode } from 'react';
import { SetupGateNotice, type SetupGatePhase } from './setup-gate-notice';

/**
 * Platform initialization gate — shared by apps/web, apps/admin and
 * apps/tenant (path-mapped as `@shared/system-state-gate`).
 *
 * SERVER-SIDE: this is an async Server Component. It calls the public
 * `GET /config/branding` endpoint on the server BEFORE any HTML is sent, so an
 * un-initialized platform never paints the real app shell first and then flips
 * to a setup notice (no flicker). The app only renders when every required
 * field is present; otherwise a blocking notice (pointing to the setup wizard)
 * is sent instead.
 *
 * The fetch is `no-store` so the decision always reflects the live platform
 * state — once setup completes, the next full load renders the app.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/** Branding fields that must exist before the platform counts as ready. */
const REQUIRED_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'platformName', label: 'Proje adı' },
  { key: 'supportEmail', label: 'Destek e-postası' },
  { key: 'defaultCountry', label: 'Ülke' },
  { key: 'defaultLanguage', label: 'Sistem dili' },
  { key: 'defaultCurrency', label: 'Para birimi' },
  { key: 'defaultTimezone', label: 'Saat dilimi' },
];

type GateResult =
  | { phase: 'pass' }
  | { phase: SetupGatePhase; missing: string[] };

async function resolveGate(): Promise<GateResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/config/branding`, {
      cache: 'no-store',
    });

    // 404 → no PlatformSetup row: the platform was never initialized.
    if (response.status === 404) {
      return { phase: 'not-configured', missing: [] };
    }
    if (!response.ok) {
      return { phase: 'error', missing: [] };
    }

    const branding = (await response.json()) as Record<string, unknown>;
    const missing = REQUIRED_FIELDS.filter((field) => {
      const value = branding[field.key];
      return typeof value !== 'string' || value.trim() === '';
    }).map((field) => field.label);

    if (missing.length > 0) {
      return { phase: 'incomplete', missing };
    }
    return { phase: 'pass' };
  } catch {
    return { phase: 'error', missing: [] };
  }
}

export async function SystemStateGate({ children }: { children: ReactNode }) {
  const result = await resolveGate();

  if (result.phase === 'pass') {
    return <>{children}</>;
  }

  return <SetupGateNotice phase={result.phase} missing={result.missing} />;
}
