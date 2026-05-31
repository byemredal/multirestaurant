import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getCountryPack, resolveCountryDefaults } from '@lieferzonen/config';
import { PasswordService } from '../../common/security/password.service';
import { InitializePlatformDto } from './dto/initialize-platform.dto';
import { InstallationProfileService } from './installation-profile.service';
import { SUPPORTED_SETUP_COUNTRIES, SystemState } from './setup.constants';
import { SetupStore } from './setup.store';
import { SystemStateService } from './system-state.service';

export interface PlatformSummary {
  platformName: string;
  supportEmail: string;
  logoUrl: string | null;
  primaryCountry: string;
  initializedAt: string;
}

export interface SetupStatus {
  initialized: boolean;
  platform: PlatformSummary | null;
}

/**
 * Machine-readable setup preconditions, so the wizard can surface the real
 * blocker (e.g. a seeded super admin) instead of misreporting it as a
 * bootstrap-key error at the final step.
 */
export interface SetupPreflight {
  /** True when initialization can be attempted (no conflicts). */
  ready: boolean;
  /** A PlatformSetup row already exists. */
  initialized: boolean;
  systemState: SystemState;
  /** A super_admin already exists (e.g. created by a seed). */
  hasSuperAdmin: boolean;
  /** The server has a BOOTSTRAP_KEY configured (value never exposed). */
  bootstrapKeyConfigured: boolean;
  /** At least one supported CountryPack loads. */
  countryPacksAvailable: boolean;
  /** Stable conflict codes the UI can branch on. */
  conflicts: string[];
}

function hasUsableCountryPacks(): boolean {
  if (SUPPORTED_SETUP_COUNTRIES.length === 0) {
    return false;
  }
  try {
    for (const code of SUPPORTED_SETUP_COUNTRIES) {
      getCountryPack(code);
    }
    return true;
  } catch {
    return false;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

@Injectable()
export class SetupService {
  constructor(
    private readonly setupStore: SetupStore,
    private readonly systemStateService: SystemStateService,
    private readonly passwordService: PasswordService,
    private readonly installationProfileService: InstallationProfileService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Reports the setup preconditions so the wizard can show the precise blocker
   * before the user reaches the bootstrap-key step.
   */
  async getPreflight(): Promise<SetupPreflight> {
    const [setup, hasSuperAdmin, { state }] = await Promise.all([
      this.setupStore.getPlatformSetup(),
      this.setupStore.hasSuperAdmin(),
      this.systemStateService.getState(),
    ]);

    const initialized = Boolean(setup);
    const bootstrapKeyConfigured = Boolean(
      this.configService.get<string>('app.bootstrapKey', ''),
    );
    const countryPacksAvailable = hasUsableCountryPacks();

    const conflicts: string[] = [];
    if (initialized || state === SystemState.READY) {
      conflicts.push('already_initialized');
    } else if (state === SystemState.INITIALIZING) {
      conflicts.push('initialization_in_progress');
    }
    // A super admin without a PlatformSetup row means a seed/demo run created
    // it — the wizard would otherwise fail at the final step looking like a
    // bootstrap-key error.
    if (!initialized && hasSuperAdmin) {
      conflicts.push('super_admin_exists');
    }
    if (!bootstrapKeyConfigured) {
      conflicts.push('bootstrap_key_missing');
    }
    if (!countryPacksAvailable) {
      conflicts.push('no_country_packs');
    }

    return {
      ready: conflicts.length === 0,
      initialized,
      systemState: state,
      hasSuperAdmin,
      bootstrapKeyConfigured,
      countryPacksAvailable,
      conflicts,
    };
  }

  /** Reports whether the platform has already been bootstrapped. */
  async getStatus(): Promise<SetupStatus> {
    const setup = await this.setupStore.getPlatformSetup();
    if (!setup) {
      return { initialized: false, platform: null };
    }

    return {
      initialized: true,
      platform: {
        platformName: setup.platformName,
        supportEmail: setup.supportEmail,
        logoUrl: setup.logoUrl,
        primaryCountry: setup.primaryCountry,
        initializedAt: setup.initializedAt,
      },
    };
  }

  /** Performs the one-time platform bootstrap under the system-state guard. */
  async initialize(dto: InitializePlatformDto): Promise<SetupStatus> {
    const existing = await this.setupStore.getPlatformSetup();
    if (existing) {
      throw new ConflictException('Platform has already been initialized.');
    }

    // Atomically move the system into INITIALIZING. This is the duplicate
    // initialization guard — a second concurrent request fails to claim it.
    await this.systemStateService.beginInitialization();

    try {
      if (await this.setupStore.hasSuperAdmin()) {
        throw new ConflictException('A super admin account already exists.');
      }

      const passwordHash = await this.passwordService.hash(dto.adminPassword);

      // Localization defaults come from the code-driven CountryPack so the
      // wizard input cannot silently set inconsistent values.
      const primaryCountry = dto.primaryCountry.toUpperCase();
      const pack = getCountryPack(primaryCountry);
      const countryDefaults = resolveCountryDefaults(primaryCountry);
      if (
        process.env.NODE_ENV === 'production' &&
        pack.legalDocuments.some((document) =>
          /placeholder|taslak|non-production|production de/i.test(
            `${document.placeholderTitle} ${document.placeholderBody}`,
          ),
        )
      ) {
        throw new ServiceUnavailableException({
          message: 'Production setup is blocked until reviewed legal documents replace placeholders.',
          code: 'placeholder_legal_content',
        });
      }

      // NOTE (MR-DB-HARDENING-01 Slice 7B): the legacy "LegalDocument" seed was
      // removed — it was a dead write with no runtime reader. The CountryPack
      // legalDocuments config is still used above as the production
      // placeholder-content guard and for onboarding/UI defaults. Canonical
      // platform legal docs are managed via the admin legal-document API.
      await this.setupStore.initialize({
        adminId: randomUUID(),
        adminEmail: dto.adminEmail.trim().toLowerCase(),
        passwordHash,
        adminFirstName: dto.adminFirstName?.trim() || 'Platform',
        adminLastName: dto.adminLastName?.trim() || 'Owner',
        platformName: dto.platformName.trim(),
        supportEmail: dto.supportEmail.trim().toLowerCase(),
        logoUrl: dto.logoUrl?.trim() || null,
        primaryCountry,
        defaultLanguage: countryDefaults.defaultLanguage,
        defaultCurrency: countryDefaults.defaultCurrency,
        defaultTimezone: countryDefaults.defaultTimezone,
        packVersion: pack.packVersion,
      });
    } catch (error) {
      // Safe fallback: never leave the system stuck in INITIALIZING.
      await this.systemStateService
        .failInitialization()
        .catch(() => undefined);

      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email already exists.',
        );
      }
      throw error;
    }

    await this.systemStateService.completeInitialization();
    this.installationProfileService.invalidate();
    return this.getStatus();
  }
}
