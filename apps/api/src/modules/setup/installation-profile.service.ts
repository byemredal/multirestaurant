import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  getCountryPack,
  isSupportedCountry,
  toCountryPackClientView,
  type CountryPack,
  type CountryPackClientView,
} from '@lieferzonen/config';
import {
  InstallationProfileRow,
  InstallationProfileStore,
} from './installation-profile.store';

/**
 * Small, immutable snapshot of the active CountryPack — enough for typical
 * consumers (currency fallback, default locale, IBAN/phone validation)
 * without dragging the whole `ActiveInstallationProfile` shape through.
 *
 * Returned by `getActiveCountryPolicy()` and ALWAYS resolved from
 * `getActive()` so it inherits the same cache and fail-closed behavior.
 */
export interface ActiveCountryPolicy {
  countryCode: string;
  locale: string;
  currencyCode: string;
  timezone: string;
  pack: CountryPack;
}

/**
 * Merged view: the DB-pinned profile (what was activated at setup time)
 * combined with the code-driven `CountryPack` it refers to.
 *
 * Anything that needs a country default reads from this service — never by
 * resolving `packages/config` directly inside a request handler. That gives
 * us one cached source of truth and makes pack-version drift observable.
 */
export interface ActiveInstallationProfile {
  countryCode: string;
  locale: string;
  currencyCode: string;
  timezone: string;
  /** Pack version pinned in the DB at setup time. */
  packVersion: string;
  /** Pack version currently shipped in code (may differ from the pinned value). */
  codePackVersion: string;
  /** True when code and DB pack versions match. */
  packVersionMatches: boolean;
  initializedAt: string;
  initializedByAdminId: string | null;
  /** Full code-driven pack — for server-side validation, not for client views. */
  pack: CountryPack;
}

@Injectable()
export class InstallationProfileService {
  private readonly logger = new Logger(InstallationProfileService.name);
  private cached: ActiveInstallationProfile | null = null;

  constructor(private readonly store: InstallationProfileStore) {}

  /** Returns the active profile, or `null` when setup has not run yet. */
  async findActive(): Promise<ActiveInstallationProfile | null> {
    if (this.cached) {
      return this.cached;
    }

    const row = await this.store.find();
    if (!row) {
      return null;
    }

    const merged = this.merge(row);
    this.cached = merged;
    return merged;
  }

  /** Returns the active profile or throws — for endpoints that require setup. */
  async getActive(): Promise<ActiveInstallationProfile> {
    const profile = await this.findActive();
    if (!profile) {
      throw new NotFoundException(
        'Installation profile is not initialized yet.',
      );
    }
    return profile;
  }

  /** Returns the client-safe pack snapshot, or `null` if not initialized. */
  async findClientPack(): Promise<CountryPackClientView | null> {
    const profile = await this.findActive();
    if (!profile) {
      return null;
    }
    return toCountryPackClientView(profile.pack);
  }

  /**
   * Small policy snapshot for runtime consumers (onboarding, payments,
   * store-settings). Throws when setup has not run — fail-closed default;
   * callers with a safe fallback path should use `findActiveCountryPolicy`.
   */
  async getActiveCountryPolicy(): Promise<ActiveCountryPolicy> {
    const profile = await this.getActive();
    return this.toPolicy(profile);
  }

  /** Null-safe variant for code that can run in a pre-setup state. */
  async findActiveCountryPolicy(): Promise<ActiveCountryPolicy | null> {
    const profile = await this.findActive();
    return profile ? this.toPolicy(profile) : null;
  }

  private toPolicy(profile: ActiveInstallationProfile): ActiveCountryPolicy {
    return {
      countryCode: profile.countryCode,
      locale: profile.locale,
      currencyCode: profile.currencyCode,
      timezone: profile.timezone,
      pack: profile.pack,
    };
  }

  /** Invalidates the cache — called by SetupService after a successful init. */
  invalidate(): void {
    this.cached = null;
  }

  private merge(row: InstallationProfileRow): ActiveInstallationProfile {
    if (!isSupportedCountry(row.countryCode)) {
      // Hard failure: the DB references a country the code does not ship.
      // Fail loudly rather than silently swap to a "default" pack — this
      // would mean the operator deployed an older codebase than the DB.
      throw new Error(
        `InstallationProfile.countryCode '${row.countryCode}' is not a supported CountryPack — ` +
          'the deployed code is older than the DB. Update the deployed image.',
      );
    }

    const pack = getCountryPack(row.countryCode);

    const packVersionMatches = pack.packVersion === row.packVersion;
    if (!packVersionMatches) {
      this.logger.warn(
        `CountryPack version drift detected: DB pinned '${row.packVersion}', code ships '${pack.packVersion}'.`,
      );
    }

    return {
      countryCode: row.countryCode,
      locale: row.locale,
      currencyCode: row.currencyCode,
      timezone: row.timezone,
      packVersion: row.packVersion,
      codePackVersion: pack.packVersion,
      packVersionMatches,
      initializedAt: row.initializedAt,
      initializedByAdminId: row.initializedByAdminId,
      pack,
    };
  }
}
