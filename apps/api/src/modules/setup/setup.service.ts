import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { getCountryPack, resolveCountryDefaults } from '@lieferzonen/config';
import { PasswordService } from '../../common/security/password.service';
import { InitializePlatformDto } from './dto/initialize-platform.dto';
import { InstallationProfileService } from './installation-profile.service';
import { DEFAULT_LEGAL_DOCUMENTS } from './setup.constants';
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
  ) {}

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

      // Baseline legal documents — pack-provided placeholders take precedence
      // over the generic constants so the seeded text is at least in the
      // pack's primary locale. Both bodies are explicitly marked placeholder.
      const packLegalDocs = pack.legalDocuments.map((document) => ({
        type: document.typeCode,
        version: document.versionLabel,
        countryCode: primaryCountry,
        content: `${document.placeholderTitle}\n\n${document.placeholderBody}`,
      }));
      const legalDocuments =
        packLegalDocs.length > 0
          ? packLegalDocs
          : DEFAULT_LEGAL_DOCUMENTS.map((document) => ({
              type: document.type,
              version: document.version,
              countryCode: primaryCountry,
              content: document.content,
            }));

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
        legalDocuments,
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
