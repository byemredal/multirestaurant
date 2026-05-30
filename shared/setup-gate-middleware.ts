/**
 * Request-level platform-initialization gate — shared by apps/web, apps/admin
 * and apps/tenant (path-mapped as `@shared/setup-gate-middleware`).
 *
 * Why this exists on top of the server-side {@link SystemStateGate}:
 * the React gate already blocks the app shell HTML, but it runs *inside* the
 * route render. This logic decides BEFORE the route renders at all, so an
 * un-initialized platform issues a plain HTTP redirect to the setup wizard and
 * the browser never receives a single byte of app-shell markup — eliminating
 * any chance of a "render shell → flip to setup notice" flicker.
 *
 * This module is intentionally framework-agnostic (no `next/server` import) so
 * it resolves cleanly from the path-mapped `shared/` folder, which has no local
 * `next` install. Each app's `middleware.ts` owns the thin `NextResponse`
 * wiring and feeds the pathname in.
 *
 * Safety model (defense-in-depth, never regress below the React gate):
 *   - initialized === true  → 'pass' (and cache so steady-state is free).
 *   - initialized === false → 'redirect' to the setup wizard (no shell HTML).
 *   - unknown / unreachable → 'pass' (FAIL OPEN). The server-side
 *     `SystemStateGate` then renders its controlled blocking notice
 *     (error/incomplete) instead of the shell. We never redirect on an
 *     uncertain read, so an initialized platform is never stranded and no
 *     redirect loop can form.
 *
 * The setup app itself ships NO middleware, so its own flow is never gated and
 * cannot loop.
 */

export type SetupGateDecision = 'pass' | 'redirect';

/** Absolute setup-wizard URL the app middleware redirects to when uninitialized. */
export const SETUP_REDIRECT_URL =
  process.env.NEXT_PUBLIC_SETUP_URL ?? 'http://localhost:3070/setup';

// How long to wait on the status probe before failing open. Kept short so a
// slow/unreachable API never blocks navigation — the React gate takes over.
const STATUS_TIMEOUT_MS = 1500;

const API_BASE_URL_FALLBACK = 'http://localhost:4000/api/v1';

/**
 * Resolve the API base URL for a server-side caller. Mirrors
 * `@shared/api-base-url`'s `resolveApiBaseUrl` but is inlined here so this
 * middleware module carries no relative import (it runs in the edge runtime and
 * is compiled from the path-mapped `shared/` folder). Server-side `localhost`
 * points at the container itself, so the Docker-internal service URL is
 * preferred when present.
 */
function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.INTERNAL_API_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      API_BASE_URL_FALLBACK
    );
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? API_BASE_URL_FALLBACK;
}

// Once the platform is initialized it cannot become un-initialized, so a single
// positive read lets every later request skip the probe for this process'
// lifetime. Negative/unknown reads are never cached, so completing setup is
// picked up on the very next request.
let platformInitialized = false;

/**
 * Pure path guard kept separate from Next's `matcher` config so it is unit
 * testable and acts as a second line of defense if the matcher regex ever
 * drifts. Returns false for assets / internals / API routes that must never be
 * redirected to setup.
 */
export function shouldEnforceSetupGate(pathname: string): boolean {
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/assets/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return false;
  }
  // Any request for a concrete file (has an extension) is a static asset.
  const lastSegment = pathname.split('/').pop() ?? '';
  if (lastSegment.includes('.')) {
    return false;
  }
  return true;
}

async function readPlatformInitialized(): Promise<boolean | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  try {
    const response = await fetch(`${resolveApiBaseUrl()}/setup/status`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { initialized?: unknown };
    return Boolean(body?.initialized);
  } catch {
    // Timeout / DNS / connection refused → unknown. Fail open upstream.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Decide whether a request for `pathname` should pass through or be redirected
 * to the setup wizard. Never throws — any uncertainty resolves to 'pass'.
 */
export async function resolveSetupGateDecision(pathname: string): Promise<SetupGateDecision> {
  if (platformInitialized || !shouldEnforceSetupGate(pathname)) {
    return 'pass';
  }

  const initialized = await readPlatformInitialized();

  if (initialized === true) {
    platformInitialized = true;
    return 'pass';
  }

  if (initialized === false) {
    // Definitively un-initialized: redirect before any shell HTML is produced.
    return 'redirect';
  }

  // Unknown/unreachable: fail open and let SystemStateGate render the blocking
  // notice server-side (still no app shell), avoiding false redirects + loops.
  return 'pass';
}

/**
 * Canonical `matcher` source of truth. NOTE: Next can only statically analyse a
 * `config.matcher` literal declared inline in each `middleware.ts`, so this is
 * mirrored there rather than imported. Prefix-only (no regex dot-escaping) for
 * robustness; files-with-extension are additionally handled by
 * {@link shouldEnforceSetupGate}.
 */
export const setupGateMatcher = [
  '/((?!api/|_next/|assets/|favicon.ico|robots.txt|sitemap.xml).*)',
];
