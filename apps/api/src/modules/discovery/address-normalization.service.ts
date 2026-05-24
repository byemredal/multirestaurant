import { BadRequestException, Injectable } from '@nestjs/common';
import { NormalizedAddress } from './entities/discovery.entity';

/** Raw address fields as they arrive from a session/customer address request. */
export interface RawAddressInput {
  countryCode?: string | null;
  canton?: string | null;
  city?: string | null;
  postalCode?: string | null;
  street?: string | null;
  houseNumber?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  formattedAddress?: string | null;
}

/**
 * Pluggable address → coordinates resolver. Phase 1 ships a null provider;
 * production swaps in Swisstopo / Google / Mapbox without touching the
 * discovery pipeline. See docs §12.
 */
export interface GeocodingProvider {
  geocode(address: NormalizedAddress): Promise<{ latitude: number; longitude: number } | null>;
}

/** Per-country postal-code shape. Extend this map to onboard new markets. */
const POSTAL_CODE_RULES: Record<string, RegExp> = {
  // Switzerland — 4 digits, 1000–9999.
  CH: /^[1-9]\d{3}$/,
  // Liechtenstein shares the Swiss postal range.
  LI: /^[1-9]\d{3}$/,
};

const DEFAULT_COUNTRY = 'CH';

@Injectable()
export class AddressNormalizationService {
  /**
   * Deterministic, network-free normalization. Trims and upper-cases the
   * country, validates the postal code against the per-country rule, and
   * derives a `formattedAddress` when the caller did not supply one.
   */
  normalize(input: RawAddressInput): NormalizedAddress {
    const countryCode = this.normalizeCountry(input.countryCode);
    const postalCode = this.normalizePostalCode(input.postalCode, countryCode);
    const city = this.clean(input.city);
    const street = this.clean(input.street);
    const houseNumber = this.clean(input.houseNumber);
    const canton = this.clean(input.canton);
    const latitude = this.normalizeCoordinate(input.latitude, -90, 90);
    const longitude = this.normalizeCoordinate(input.longitude, -180, 180);

    if (!postalCode && latitude === null) {
      throw new BadRequestException(
        'An address needs at least a postal code or a coordinate pair.',
      );
    }

    return {
      countryCode,
      canton,
      city,
      postalCode,
      street,
      houseNumber,
      latitude,
      longitude,
      formattedAddress:
        this.clean(input.formattedAddress) ??
        this.buildFormattedAddress({ street, houseNumber, postalCode, city, countryCode }),
    };
  }

  normalizeCountry(raw: string | null | undefined): string {
    const value = (raw ?? '').trim().toUpperCase();
    if (!value) return DEFAULT_COUNTRY;
    if (!/^[A-Z]{2}$/.test(value)) {
      throw new BadRequestException('countryCode must be an ISO-3166-1 alpha-2 code.');
    }
    return value;
  }

  /** Returns a validated postal code, or null when none was supplied. */
  normalizePostalCode(raw: string | null | undefined, countryCode: string): string | null {
    const value = (raw ?? '').trim().toUpperCase();
    if (!value) return null;

    const rule = POSTAL_CODE_RULES[countryCode];
    if (rule && !rule.test(value)) {
      throw new BadRequestException(
        `"${value}" is not a valid ${countryCode} postal code.`,
      );
    }
    return value;
  }

  private buildFormattedAddress(parts: {
    street: string | null;
    houseNumber: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: string;
  }): string {
    const line1 = [parts.street, parts.houseNumber].filter(Boolean).join(' ');
    const line2 = [parts.postalCode, parts.city].filter(Boolean).join(' ');
    const formatted = [line1, line2].filter(Boolean).join(', ');
    return formatted || parts.postalCode || parts.countryCode;
  }

  private clean(value: string | null | undefined): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeCoordinate(
    value: number | null | undefined,
    min: number,
    max: number,
  ): number | null {
    if (value === null || value === undefined) return null;
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new BadRequestException('Coordinates are out of range.');
    }
    return value;
  }
}
