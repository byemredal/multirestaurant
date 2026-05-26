import { apiBaseUrl } from '@/lib/http/tenant-http';

export type PlatformBrandingResponse = {
  platformName?: string | null;
  supportEmail?: string | null;
  logoUrl?: string | null;
  defaultCountry?: string | null;
  defaultLanguage?: string | null;
  defaultCurrency?: string | null;
  defaultTimezone?: string | null;
};

/**
 * Server-side fetch of the public `/config/branding` snapshot, suitable for
 * Next.js `generateMetadata`. Returns `null` when the platform is not yet
 * initialized or the API is unreachable — callers MUST treat the brand name
 * as missing in that case, NEVER fall back to a hardcoded "Lieferzonen".
 */
export async function fetchPlatformBranding(): Promise<PlatformBrandingResponse | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/config/branding`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as PlatformBrandingResponse;
  } catch {
    return null;
  }
}
