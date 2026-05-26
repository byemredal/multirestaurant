import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface PlatformSetupRow {
  id: string;
  platformName: string;
  supportEmail: string;
  logoUrl: string | null;
  primaryCountry: string;
  defaultLanguage: string | null;
  defaultCurrency: string | null;
  defaultTimezone: string | null;
  initializedByAdminId: string | null;
  initializedAt: string;
}

export interface InitializeLegalDocument {
  type: string;
  version: string;
  countryCode: string;
  content: string;
}

export interface InitializeInput {
  adminId: string;
  adminEmail: string;
  passwordHash: string;
  adminFirstName: string;
  adminLastName: string;
  platformName: string;
  supportEmail: string;
  logoUrl: string | null;
  primaryCountry: string;
  defaultLanguage: string;
  defaultCurrency: string;
  defaultTimezone: string;
  /** CountryPack version pinned into InstallationProfile at setup time. */
  packVersion: string;
  legalDocuments: InitializeLegalDocument[];
}

const SUPER_ADMIN_ROLE = 'super_admin';

@Injectable()
export class SetupStore {
  constructor(private readonly databaseService: DatabaseService) {}

  async getPlatformSetup(): Promise<PlatformSetupRow | null> {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "PlatformSetup" WHERE "id" = 'platform'`)
      .get()) as PlatformSetupRow | undefined;

    return row ?? null;
  }

  async hasSuperAdmin(): Promise<boolean> {
    const row = await this.databaseService
      .prepare(
        `SELECT 1 AS "found" FROM "AdminAccount" WHERE "role" = $role LIMIT 1`,
      )
      .get({ $role: SUPER_ADMIN_ROLE });

    return Boolean(row);
  }

  /**
   * Creates the super admin account, the single PlatformSetup row and the
   * baseline legal documents in one transaction. If any step fails the whole
   * bootstrap is rolled back, so the platform never enters a partial state.
   */
  async initialize(input: InitializeInput): Promise<void> {
    const now = new Date().toISOString();

    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `INSERT INTO "AdminAccount" (
             "id", "email", "passwordHash", "firstName", "lastName",
             "role", "isActive", "createdAt", "updatedAt"
           ) VALUES (
             $id, $email, $passwordHash, $firstName, $lastName,
             $role, TRUE, $createdAt, $updatedAt
           )`,
        )
        .run({
          $id: input.adminId,
          $email: input.adminEmail,
          $passwordHash: input.passwordHash,
          $firstName: input.adminFirstName,
          $lastName: input.adminLastName,
          $role: SUPER_ADMIN_ROLE,
          $createdAt: now,
          $updatedAt: now,
        });

      await this.databaseService
        .prepare(
          `INSERT INTO "PlatformSetup" (
             "id", "platformName", "supportEmail", "logoUrl",
             "primaryCountry", "defaultLanguage", "defaultCurrency",
             "defaultTimezone", "initializedByAdminId", "initializedAt"
           ) VALUES (
             'platform', $platformName, $supportEmail, $logoUrl,
             $primaryCountry, $defaultLanguage, $defaultCurrency,
             $defaultTimezone, $initializedByAdminId, $initializedAt
           )`,
        )
        .run({
          $platformName: input.platformName,
          $supportEmail: input.supportEmail,
          $logoUrl: input.logoUrl,
          $primaryCountry: input.primaryCountry,
          $defaultLanguage: input.defaultLanguage,
          $defaultCurrency: input.defaultCurrency,
          $defaultTimezone: input.defaultTimezone,
          $initializedByAdminId: input.adminId,
          $initializedAt: now,
        });

      const legalStatement = this.databaseService.prepare(
        `INSERT INTO "LegalDocument" (
           "type", "version", "countryCode", "content", "createdAt"
         ) VALUES (
           $type, $version, $countryCode, $content, $createdAt
         )`,
      );

      for (const document of input.legalDocuments) {
        await legalStatement.run({
          $type: document.type,
          $version: document.version,
          $countryCode: document.countryCode,
          $content: document.content,
          $createdAt: now,
        });
      }

      // InstallationProfile pins which CountryPack this deployment runs.
      // Written in the same transaction as PlatformSetup so the two views
      // can never disagree about the active country/locale/currency.
      await this.databaseService
        .prepare(
          `INSERT INTO "InstallationProfile" (
             "id", "countryCode", "locale", "currencyCode",
             "timezone", "packVersion",
             "initializedAt", "initializedByAdminId"
           ) VALUES (
             'install', $countryCode, $locale, $currencyCode,
             $timezone, $packVersion,
             $initializedAt, $initializedByAdminId
           )`,
        )
        .run({
          $countryCode: input.primaryCountry,
          $locale: input.defaultLanguage,
          $currencyCode: input.defaultCurrency,
          $timezone: input.defaultTimezone,
          $packVersion: input.packVersion,
          $initializedAt: now,
          $initializedByAdminId: input.adminId,
        });
    });
  }
}
