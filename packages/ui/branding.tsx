'use client';

import { useEffect, useState } from 'react';
import { defaultPlatformMarkDataUrl } from '@lieferzonen/assets';
import { Logo, type LogoProps } from './logo';

/**
 * Platform branding persisted by the one-time setup wizard and exposed via
 * `GET /config/branding` (NestJS `PlatformConfigController`).
 */
export type PlatformBranding = {
  platformName: string;
  logoUrl: string;
  supportEmail: string;
  defaultCountry: string;
  defaultLanguage: string;
  defaultCurrency: string;
  defaultTimezone: string;
};

const CACHE_KEY = 'lz.platform.branding';

function readCache(): PlatformBranding | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as PlatformBranding) : null;
  } catch {
    return null;
  }
}

function normalize(data: Record<string, unknown>): PlatformBranding {
  return {
    platformName: String(data.platformName ?? ''),
    logoUrl: String(data.logoUrl ?? ''),
    supportEmail: String(data.supportEmail ?? ''),
    defaultCountry: String(data.defaultCountry ?? ''),
    defaultLanguage: String(data.defaultLanguage ?? ''),
    defaultCurrency: String(data.defaultCurrency ?? ''),
    defaultTimezone: String(data.defaultTimezone ?? ''),
  };
}

// Module-level cache + in-flight dedup: the branding endpoint is hit once
// per page load no matter how many <PlatformLogo>s are mounted.
let snapshot: PlatformBranding | null = null;
let inflight: Promise<void> | null = null;
const subscribers = new Set<() => void>();

function loadBranding(apiBaseUrl: string): Promise<void> {
  if (inflight) return inflight;
  inflight = fetch(`${apiBaseUrl}/config/branding`, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: Record<string, unknown> | null) => {
      if (!data) return;
      snapshot = normalize(data);
      subscribers.forEach((fn) => fn());
      try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
      } catch {
        /* storage unavailable — keep the in-memory value */
      }
    })
    .catch(() => {
      /* network failure — keep whatever cached value we have */
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Reads the platform branding configured in the setup wizard. Renders
 * instantly from the cached value (localStorage), then revalidates. The
 * underlying fetch is shared across every caller on the page.
 */
export function usePlatformBranding(apiBaseUrl: string): PlatformBranding | null {
  const [branding, setBranding] = useState<PlatformBranding | null>(
    () => snapshot,
  );

  useEffect(() => {
    if (!snapshot) {
      const cached = readCache();
      if (cached) {
        snapshot = cached;
        setBranding(cached);
      }
    }
    const sync = () => setBranding(snapshot);
    subscribers.add(sync);
    void loadBranding(apiBaseUrl).then(sync);
    return () => {
      subscribers.delete(sync);
    };
  }, [apiBaseUrl]);

  return branding;
}

export type PlatformLogoProps = Omit<LogoProps, 'src'> & {
  /** API base URL, e.g. `http://localhost:4000/api/v1`. */
  apiBaseUrl: string;
};

/**
 * The platform logo uploaded during setup, ready to drop into any app
 * header. Self-fetches branding (no provider required) and falls back to the
 * bundled `/logo.svg` until branding loads or when no logo is configured.
 */
export function PlatformLogo({ apiBaseUrl, alt, ...rest }: PlatformLogoProps) {
  const branding = usePlatformBranding(apiBaseUrl);
  const platformName = branding?.platformName?.trim() || 'Platform';
  return (
    <Logo
      src={branding?.logoUrl || undefined}
      // Brand-neutral fallback: a wordless abstract mark shipped in
      // `@lieferzonen/assets`. `logo.svg` / `logo_.svg` in that package are
      // brand-baked (the SVG path itself spells "LIEFER ZONE") and CANNOT
      // be used as a platform-agnostic default — they would leak the old
      // brand on a "Yemekmarketi" install. The data-URL keeps this safe
      // for `packages/ui`, which has no Next.js SVG loader of its own.
      fallbackSrc={defaultPlatformMarkDataUrl}
      // `fallbackText` powers the final text-mark path inside <Logo> —
      // hit only when both the uploaded logoUrl AND the bundled mark fail
      // to load, e.g. an offline CSP-blocked render.
      fallbackText={platformName}
      alt={alt ?? platformName}
      {...rest}
    />
  );
}
