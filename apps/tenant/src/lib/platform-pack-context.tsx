'use client';

import { useEffect, useState } from 'react';
import { apiBaseUrl } from '@/lib/http/tenant-http';

/**
 * Subset of /platform/pack consumed by the tenant landing/onboarding pages.
 * Wider fields (tax, bank, invoicing) live on the server view but the
 * partner application form only needs country/locale/phone today.
 */
export type TenantPlatformPack = {
  country: string;
  locale: string;
  currency: string;
  phone: {
    e164Country: string;
    otpLength: number;
  };
};

type PackResponse = { initialized: boolean; pack: TenantPlatformPack | null };

const CACHE_KEY = 'lz.tenant.platformPack';

function readCache(): TenantPlatformPack | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as TenantPlatformPack) : null;
  } catch {
    return null;
  }
}

function writeCache(pack: TenantPlatformPack | null) {
  if (typeof window === 'undefined') return;
  try {
    if (pack) {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(pack));
    } else {
      window.localStorage.removeItem(CACHE_KEY);
    }
  } catch {
    /* ignore — falling back to in-memory only is acceptable */
  }
}

/**
 * Read the active CountryPack snapshot from /platform/pack. Renders the
 * cached value immediately, then revalidates in the background; setup
 * not-yet-run returns `null` (do NOT fall back to a hardcoded country).
 */
export function usePlatformPack(): TenantPlatformPack | null {
  const [pack, setPack] = useState<TenantPlatformPack | null>(() => readCache());

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiBaseUrl}/platform/pack`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: PackResponse | null) => {
        if (cancelled) return;
        if (payload?.pack) {
          setPack(payload.pack);
          writeCache(payload.pack);
        }
      })
      .catch(() => {
        /* keep cached value on network failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return pack;
}
