'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiBaseUrl } from '@/lib/config';

/**
 * Platform branding sourced from the one-time setup wizard (PlatformSetup
 * row, exposed via `GET /config/branding`). The admin panel reads its
 * display name and locale defaults from here instead of hard-coded values.
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

const CACHE_KEY = 'lz.admin.branding';

const BrandingContext = createContext<PlatformBranding | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<PlatformBranding | null>(null);

  useEffect(() => {
    // Render instantly from the last known value, then revalidate.
    try {
      const cached = window.localStorage.getItem(CACHE_KEY);
      if (cached) setBranding(JSON.parse(cached) as PlatformBranding);
    } catch {
      /* ignore unavailable storage */
    }

    let active = true;
    fetch(`${apiBaseUrl}/config/branding`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Record<string, unknown> | null) => {
        if (!active || !data) return;
        const next: PlatformBranding = {
          platformName: String(data.platformName ?? ''),
          logoUrl: String(data.logoUrl ?? ''),
          supportEmail: String(data.supportEmail ?? ''),
          defaultCountry: String(data.defaultCountry ?? ''),
          defaultLanguage: String(data.defaultLanguage ?? ''),
          defaultCurrency: String(data.defaultCurrency ?? ''),
          defaultTimezone: String(data.defaultTimezone ?? ''),
        };
        setBranding(next);
        try {
          window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          /* ignore unavailable storage */
        }
      })
      .catch(() => {
        /* keep cached value on network failure */
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): PlatformBranding | null {
  return useContext(BrandingContext);
}
