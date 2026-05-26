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
