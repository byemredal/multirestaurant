import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';

export interface GeoAddressSuggestion {
  id: string;
  label: string;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface LocationIqItem {
  place_id?: string | number;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
    country_code?: string;
  };
}

/**
 * Provider-agnostic address suggestion service. Today only LocationIQ is
 * implemented; the contract stays narrow so other providers (Mapbox, Google,
 * Nominatim) can be slotted in by extending `PlatformSettingsService` +
 * adding a new branch here, without changing the public endpoint shape.
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly settings: PlatformSettingsService) {}

  async suggest(query: string, options?: { countryCode?: string }): Promise<GeoAddressSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      return [];
    }

    const config = await this.settings.getActiveProvider();
    if (!config.active) {
      throw new ServiceUnavailableException({
        message:
          'Adres arama servisi şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin veya destek ekibimizle iletişime geçin.',
        code: 'geo_provider_unavailable',
      });
    }

    if (config.provider === 'locationiq') {
      return this.locationIqSuggest(trimmed, options?.countryCode);
    }

    return [];
  }

  private async locationIqSuggest(
    query: string,
    countryCode?: string,
  ): Promise<GeoAddressSuggestion[]> {
    const apiKey = this.settings.resolveApiKey('locationiq');
    if (!apiKey) {
      throw new ServiceUnavailableException({
        message: 'Adres arama servisi şu an kullanılamıyor.',
        code: 'geo_provider_unavailable',
      });
    }

    const upstream = new URL('https://us1.locationiq.com/v1/autocomplete');
    upstream.searchParams.set('key', apiKey);
    upstream.searchParams.set('q', query);
    upstream.searchParams.set('format', 'json');
    upstream.searchParams.set('addressdetails', '1');
    upstream.searchParams.set('limit', '6');
    if (countryCode) {
      upstream.searchParams.set('countrycodes', countryCode.toLowerCase());
    }

    let response: Response;
    try {
      response = await fetch(upstream.toString(), {
        headers: { Accept: 'application/json' },
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'geo_suggest_unreachable',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw new ServiceUnavailableException({
        message: 'Adres arama servisi şu an cevap vermiyor. Lütfen tekrar deneyin.',
        code: 'geo_provider_unreachable',
      });
    }

    if (!response.ok) {
      this.logger.warn(
        JSON.stringify({
          event: 'geo_suggest_upstream_failed',
          status: response.status,
        }),
      );
      // 404 from LocationIQ for "no results" is benign — return empty.
      if (response.status === 404) {
        return [];
      }
      throw new ServiceUnavailableException({
        message: 'Adres arama servisi şu an cevap vermiyor.',
        code: 'geo_provider_failed',
      });
    }

    const payload = (await response.json()) as LocationIqItem[];
    return payload.map((item) => this.mapLocationIqItem(item)).filter((s): s is GeoAddressSuggestion => s !== null);
  }

  private mapLocationIqItem(item: LocationIqItem): GeoAddressSuggestion | null {
    const id = item.place_id != null ? String(item.place_id) : null;
    const label = item.display_name?.trim();
    if (!id || !label) {
      return null;
    }
    const city =
      item.address?.city?.trim() ||
      item.address?.town?.trim() ||
      item.address?.village?.trim() ||
      item.address?.municipality?.trim() ||
      null;
    const postalCode = item.address?.postcode?.trim() || null;
    const country = item.address?.country_code?.trim().toUpperCase() || null;
    const lat = item.lat ? Number.parseFloat(item.lat) : null;
    const lon = item.lon ? Number.parseFloat(item.lon) : null;
    return {
      id,
      label,
      city,
      postalCode,
      country,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lon) ? lon : null,
    };
  }
}
