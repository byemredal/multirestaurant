import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { InstallationProfileService } from '../setup/installation-profile.service';
import {
  StoreContentSetting,
  StoreDeliveryFeeSetting,
  StoreDiscountRule,
  StoreLegalDocument,
  StoreLegalDocumentTranslation,
  StoreReceiptSetting,
  StoreProfileNote,
  StoreProfileNoteTranslation,
  StoreReservationSetting,
  StoreSetting,
  StoreSlider,
  StoreSliderItem,
  StoreTaxSetting,
} from '../tenant-management/entities';
import {
  StoreDeliveryFeeTier,
  StoreOrderingPolicy,
  StorePaymentMethod,
  StorePaymentMethodView,
  StoreServiceType,
  StoreServiceTypeView,
} from './entities/commerce.entity';

@Injectable()
export class StoreSettingsStore {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly installationProfileService: InstallationProfileService,
  ) {}

  /**
   * Resolve the installation's currency code (fail-closed via getActive),
   * with a CHF defensive fallback for legacy dev DBs that pre-date the
   * InstallationProfile row.
   */
  private async resolveInstallCurrencyCode(): Promise<string> {
    const policy = await this.installationProfileService.findActiveCountryPolicy();
    return policy?.currencyCode ?? 'CHF';
  }

  /** Resolve the installation's default locale (e.g. de-CH / tr-TR). */
  private async resolveInstallLocale(): Promise<string> {
    const policy = await this.installationProfileService.findActiveCountryPolicy();
    return policy?.locale ?? 'tr-TR';
  }

  async getOrCreateStoreSetting(storeId: string) {
    const existing = await this.findStoreSetting(storeId);
    if (existing) {
      return existing;
    }

    const installCurrency = await this.resolveInstallCurrencyCode();
    const installLocale = await this.resolveInstallLocale();
    const defaults = await this.databaseService
      .prepare(
        `SELECT
           (SELECT "id" FROM "Currency" WHERE "code" = $currency) AS "defaultCurrencyId",
           (SELECT "id" FROM "Language" WHERE "code" = $locale)   AS "defaultLanguageId"`,
      )
      .get<{ defaultCurrencyId: string; defaultLanguageId: string }>({
        $currency: installCurrency,
        $locale: installLocale,
      });

    if (!defaults?.defaultCurrencyId || !defaults?.defaultLanguageId) {
      throw new Error('Currency/Language catalog must be seeded before creating settings.');
    }

    return this.upsertStoreSetting(storeId, {
      defaultCurrencyId: defaults.defaultCurrencyId,
      defaultLanguageId: defaults.defaultLanguageId,
      advancedOptionsJson: {},
    });
  }

  async upsertStoreSetting(
    storeId: string,
    input: Pick<
      StoreSetting,
      'defaultCurrencyId' | 'defaultLanguageId' | 'advancedOptionsJson'
    >,
  ) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row = await this.databaseService
      .prepare(
        `INSERT INTO "StoreSetting" (
          "id", "storeId", "defaultCurrencyId", "defaultLanguageId",
          "advancedOptionsJson", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $defaultCurrencyId, $defaultLanguageId,
          $advancedOptionsJson::jsonb, $createdAt, $updatedAt
        )
        ON CONFLICT ("storeId") DO UPDATE
        SET "defaultCurrencyId" = EXCLUDED."defaultCurrencyId",
            "defaultLanguageId" = EXCLUDED."defaultLanguageId",
            "advancedOptionsJson" = EXCLUDED."advancedOptionsJson",
            "updatedAt" = EXCLUDED."updatedAt"
        RETURNING *`,
      )
      .get<StoreSettingRow>({
        $id: id,
        $storeId: storeId,
        $defaultCurrencyId: input.defaultCurrencyId,
        $defaultLanguageId: input.defaultLanguageId,
        $advancedOptionsJson: JSON.stringify(input.advancedOptionsJson ?? {}),
        $createdAt: now,
        $updatedAt: now,
      });

    if (!row) {
      throw new Error('Failed to upsert store setting.');
    }

    return this.mapStoreSetting(row);
  }

  async getOrCreateStoreTaxSetting(storeId: string) {
    const existing = await this.findStoreTaxSetting(storeId);
    if (existing) {
      return existing;
    }

    return this.upsertStoreTaxSetting(storeId, {
      taxRegistrationNumber: null,
      priceIncludesTax: true,
      defaultVatRate: 0,
      serviceChargeRate: 0,
      invoiceFooterText: null,
    });
  }

  async upsertStoreTaxSetting(
    storeId: string,
    input: Pick<
      StoreTaxSetting,
      | 'taxRegistrationNumber'
      | 'priceIncludesTax'
      | 'defaultVatRate'
      | 'serviceChargeRate'
      | 'invoiceFooterText'
    >,
  ) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row = await this.databaseService
      .prepare(
        `INSERT INTO "StoreTaxSetting" (
          "id", "storeId", "taxRegistrationNumber", "priceIncludesTax",
          "defaultVatRate", "serviceChargeRate", "invoiceFooterText", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $taxRegistrationNumber, $priceIncludesTax,
          $defaultVatRate, $serviceChargeRate, $invoiceFooterText, $createdAt, $updatedAt
        )
        ON CONFLICT ("storeId") DO UPDATE
        SET "taxRegistrationNumber" = EXCLUDED."taxRegistrationNumber",
            "priceIncludesTax" = EXCLUDED."priceIncludesTax",
            "defaultVatRate" = EXCLUDED."defaultVatRate",
            "serviceChargeRate" = EXCLUDED."serviceChargeRate",
            "invoiceFooterText" = EXCLUDED."invoiceFooterText",
            "updatedAt" = EXCLUDED."updatedAt"
        RETURNING *`,
      )
      .get<StoreTaxSettingRow>({
        $id: id,
        $storeId: storeId,
        $taxRegistrationNumber: input.taxRegistrationNumber,
        $priceIncludesTax: input.priceIncludesTax,
        $defaultVatRate: input.defaultVatRate,
        $serviceChargeRate: input.serviceChargeRate,
        $invoiceFooterText: input.invoiceFooterText,
        $createdAt: now,
        $updatedAt: now,
      });

    if (!row) {
      throw new Error('Failed to upsert store tax setting.');
    }

    return this.mapStoreTaxSetting(row);
  }

  async listDiscountRules(storeId: string) {
    const rows = await this.databaseService
      .prepare(
        `SELECT * FROM "StoreDiscountRule"
         WHERE "storeId" = $storeId
         ORDER BY "createdAt" DESC`,
      )
      .all<StoreDiscountRuleRow>({ $storeId: storeId });

    return rows.map((row) => this.mapDiscountRule(row));
  }

  async findDiscountRuleById(storeId: string, ruleId: string) {
    const row = await this.databaseService
      .prepare(
        `SELECT * FROM "StoreDiscountRule"
         WHERE "id" = $ruleId
           AND "storeId" = $storeId`,
      )
      .get<StoreDiscountRuleRow>({
        $ruleId: ruleId,
        $storeId: storeId,
      });

    return row ? this.mapDiscountRule(row) : null;
  }

  async createDiscountRule(
    storeId: string,
    input: Pick<
      StoreDiscountRule,
      'name' | 'ruleType' | 'valueType' | 'valueAmount' | 'isActive' | 'startsAt' | 'endsAt'
    >,
  ) {
    const rule: StoreDiscountRule = {
      id: randomUUID(),
      storeId,
      name: input.name,
      ruleType: input.ruleType,
      valueType: input.valueType,
      valueAmount: input.valueAmount,
      isActive: input.isActive,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const row = await this.databaseService
      .prepare(
        `INSERT INTO "StoreDiscountRule" (
          "id", "storeId", "name", "ruleType", "valueType", "valueAmount",
          "isActive", "startsAt", "endsAt", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $name, $ruleType, $valueType, $valueAmount,
          $isActive, $startsAt, $endsAt, $createdAt, $updatedAt
        )
        RETURNING *`,
      )
      .get<StoreDiscountRuleRow>({
        $id: rule.id,
        $storeId: rule.storeId,
        $name: rule.name,
        $ruleType: rule.ruleType,
        $valueType: rule.valueType,
        $valueAmount: rule.valueAmount,
        $isActive: rule.isActive,
        $startsAt: rule.startsAt,
        $endsAt: rule.endsAt,
        $createdAt: rule.createdAt,
        $updatedAt: rule.updatedAt,
      });

    if (!row) {
      throw new Error('Failed to create discount rule.');
    }

    return this.mapDiscountRule(row);
  }

  async updateDiscountRule(
    storeId: string,
    ruleId: string,
    input: Pick<
      StoreDiscountRule,
      'name' | 'ruleType' | 'valueType' | 'valueAmount' | 'isActive' | 'startsAt' | 'endsAt'
    >,
  ) {
    const row = await this.databaseService
      .prepare(
        `UPDATE "StoreDiscountRule"
         SET "name" = $name,
             "ruleType" = $ruleType,
             "valueType" = $valueType,
             "valueAmount" = $valueAmount,
             "isActive" = $isActive,
             "startsAt" = $startsAt,
             "endsAt" = $endsAt,
             "updatedAt" = $updatedAt
         WHERE "id" = $ruleId
           AND "storeId" = $storeId
         RETURNING *`,
      )
      .get<StoreDiscountRuleRow>({
        $ruleId: ruleId,
        $storeId: storeId,
        $name: input.name,
        $ruleType: input.ruleType,
        $valueType: input.valueType,
        $valueAmount: input.valueAmount,
        $isActive: input.isActive,
        $startsAt: input.startsAt,
        $endsAt: input.endsAt,
        $updatedAt: new Date().toISOString(),
      });

    return row ? this.mapDiscountRule(row) : null;
  }

  async deleteDiscountRule(storeId: string, ruleId: string) {
    const result = await this.databaseService
      .prepare(
        `DELETE FROM "StoreDiscountRule"
         WHERE "id" = $ruleId
           AND "storeId" = $storeId`,
      )
      .run({
        $ruleId: ruleId,
        $storeId: storeId,
      });

    return (result.rowCount ?? 0) > 0;
  }

  async getOrCreateStoreDeliveryFeeSetting(storeId: string) {
    const existing = await this.findStoreDeliveryFeeSetting(storeId);
    if (existing) {
      return existing;
    }

    return this.upsertStoreDeliveryFeeSetting(storeId, {
      baseFee: 0,
      freeDeliveryThreshold: null,
      surgeFeeEnabled: false,
      smallOrderFee: 0,
    });
  }

  async upsertStoreDeliveryFeeSetting(
    storeId: string,
    input: Pick<
      StoreDeliveryFeeSetting,
      'baseFee' | 'freeDeliveryThreshold' | 'surgeFeeEnabled' | 'smallOrderFee'
    >,
  ) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row = await this.databaseService
      .prepare(
        `INSERT INTO "StoreDeliveryFeeSetting" (
          "id", "storeId", "baseFee", "freeDeliveryThreshold",
          "surgeFeeEnabled", "smallOrderFee", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $baseFee, $freeDeliveryThreshold,
          $surgeFeeEnabled, $smallOrderFee, $createdAt, $updatedAt
        )
        ON CONFLICT ("storeId") DO UPDATE
        SET "baseFee" = EXCLUDED."baseFee",
            "freeDeliveryThreshold" = EXCLUDED."freeDeliveryThreshold",
            "surgeFeeEnabled" = EXCLUDED."surgeFeeEnabled",
            "smallOrderFee" = EXCLUDED."smallOrderFee",
            "updatedAt" = EXCLUDED."updatedAt"
        RETURNING *`,
      )
      .get<StoreDeliveryFeeSettingRow>({
        $id: id,
        $storeId: storeId,
        $baseFee: input.baseFee,
        $freeDeliveryThreshold: input.freeDeliveryThreshold,
        $surgeFeeEnabled: input.surgeFeeEnabled,
        $smallOrderFee: input.smallOrderFee,
        $createdAt: now,
        $updatedAt: now,
      });

    if (!row) {
      throw new Error('Failed to upsert store delivery fee setting.');
    }

    return this.mapStoreDeliveryFeeSetting(row);
  }

  async getOrCreateStoreReservationSetting(storeId: string) {
    const existing = await this.findStoreReservationSetting(storeId);
    if (existing) {
      return existing;
    }

    return this.upsertStoreReservationSetting(storeId, {
      enabled: false,
      requiresApproval: true,
      maxPartySize: null,
      defaultSlotMinutes: 30,
      leadTimeMinutes: 0,
      notes: null,
    });
  }

  async upsertStoreReservationSetting(
    storeId: string,
    input: Pick<
      StoreReservationSetting,
      | 'enabled'
      | 'requiresApproval'
      | 'maxPartySize'
      | 'defaultSlotMinutes'
      | 'leadTimeMinutes'
      | 'notes'
    >,
  ) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row = await this.databaseService
      .prepare(
        `INSERT INTO "StoreReservationSetting" (
          "id", "storeId", "enabled", "requiresApproval", "maxPartySize",
          "defaultSlotMinutes", "leadTimeMinutes", "notes", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $enabled, $requiresApproval, $maxPartySize,
          $defaultSlotMinutes, $leadTimeMinutes, $notes, $createdAt, $updatedAt
        )
        ON CONFLICT ("storeId") DO UPDATE
        SET "enabled" = EXCLUDED."enabled",
            "requiresApproval" = EXCLUDED."requiresApproval",
            "maxPartySize" = EXCLUDED."maxPartySize",
            "defaultSlotMinutes" = EXCLUDED."defaultSlotMinutes",
            "leadTimeMinutes" = EXCLUDED."leadTimeMinutes",
            "notes" = EXCLUDED."notes",
            "updatedAt" = EXCLUDED."updatedAt"
        RETURNING *`,
      )
      .get<StoreReservationSettingRow>({
        $id: id,
        $storeId: storeId,
        $enabled: input.enabled,
        $requiresApproval: input.requiresApproval,
        $maxPartySize: input.maxPartySize,
        $defaultSlotMinutes: input.defaultSlotMinutes,
        $leadTimeMinutes: input.leadTimeMinutes,
        $notes: input.notes,
        $createdAt: now,
        $updatedAt: now,
      });

    if (!row) {
      throw new Error('Failed to upsert store reservation setting.');
    }

    return this.mapStoreReservationSetting(row);
  }

  async getOrCreateStoreReceiptSetting(storeId: string) {
    const existing = await this.findStoreReceiptSetting(storeId);
    if (existing) {
      return existing;
    }

    return this.upsertStoreReceiptSetting(storeId, {
      headerText: null,
      footerText: null,
      showTaxBreakdown: true,
      showQrCode: false,
      layoutConfigJson: {},
    });
  }

  async upsertStoreReceiptSetting(
    storeId: string,
    input: Pick<
      StoreReceiptSetting,
      'headerText' | 'footerText' | 'showTaxBreakdown' | 'showQrCode' | 'layoutConfigJson'
    >,
  ) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row = await this.databaseService
      .prepare(
        `INSERT INTO "StoreReceiptSetting" (
          "id", "storeId", "headerText", "footerText", "showTaxBreakdown",
          "showQrCode", "layoutConfigJson", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $headerText, $footerText, $showTaxBreakdown,
          $showQrCode, $layoutConfigJson::jsonb, $createdAt, $updatedAt
        )
        ON CONFLICT ("storeId") DO UPDATE
        SET "headerText" = EXCLUDED."headerText",
            "footerText" = EXCLUDED."footerText",
            "showTaxBreakdown" = EXCLUDED."showTaxBreakdown",
            "showQrCode" = EXCLUDED."showQrCode",
            "layoutConfigJson" = EXCLUDED."layoutConfigJson",
            "updatedAt" = EXCLUDED."updatedAt"
        RETURNING *`,
      )
      .get<StoreReceiptSettingRow>({
        $id: id,
        $storeId: storeId,
        $headerText: input.headerText,
        $footerText: input.footerText,
        $showTaxBreakdown: input.showTaxBreakdown,
        $showQrCode: input.showQrCode,
        $layoutConfigJson: JSON.stringify(input.layoutConfigJson ?? {}),
        $createdAt: now,
        $updatedAt: now,
      });

    if (!row) {
      throw new Error('Failed to upsert store receipt setting.');
    }

    return this.mapStoreReceiptSetting(row);
  }

  async getOrCreateStoreContentSetting(storeId: string) {
    const existing = await this.findStoreContentSetting(storeId);
    if (existing) {
      return existing;
    }

    return this.upsertStoreContentSetting(storeId, {
      defaultLocale: 'tr',
      socialLinksJson: {},
      marketingHeadline: null,
      marketingDescription: null,
    });
  }

  async upsertStoreContentSetting(
    storeId: string,
    input: Pick<
      StoreContentSetting,
      'defaultLocale' | 'socialLinksJson' | 'marketingHeadline' | 'marketingDescription'
    >,
  ) {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row = await this.databaseService
      .prepare(
        `INSERT INTO "StoreContentSetting" (
          "id", "storeId", "defaultLocale", "socialLinksJson", "marketingHeadline",
          "marketingDescription", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $defaultLocale, $socialLinksJson::jsonb, $marketingHeadline,
          $marketingDescription, $createdAt, $updatedAt
        )
        ON CONFLICT ("storeId") DO UPDATE
        SET "defaultLocale" = EXCLUDED."defaultLocale",
            "socialLinksJson" = EXCLUDED."socialLinksJson",
            "marketingHeadline" = EXCLUDED."marketingHeadline",
            "marketingDescription" = EXCLUDED."marketingDescription",
            "updatedAt" = EXCLUDED."updatedAt"
        RETURNING *`,
      )
      .get<StoreContentSettingRow>({
        $id: id,
        $storeId: storeId,
        $defaultLocale: input.defaultLocale,
        $socialLinksJson: JSON.stringify(input.socialLinksJson ?? {}),
        $marketingHeadline: input.marketingHeadline,
        $marketingDescription: input.marketingDescription,
        $createdAt: now,
        $updatedAt: now,
      });

    if (!row) {
      throw new Error('Failed to upsert store content setting.');
    }

    return this.mapStoreContentSetting(row);
  }

  async listLegalDocuments(storeId: string, documentType?: StoreLegalDocument['documentType']) {
    const rows = await this.databaseService
      .prepare(
        `SELECT * FROM "StoreLegalDocument"
         WHERE "storeId" = $storeId
           AND ($documentType::text IS NULL OR "documentType" = $documentType::text)
         ORDER BY "updatedAt" DESC`,
      )
      .all<StoreLegalDocumentRow>({
        $storeId: storeId,
        $documentType: documentType ?? null,
      });

    return Promise.all(
      rows.map(async (row) => ({
        ...this.mapStoreLegalDocument(row),
        translations: await this.listLegalDocumentTranslations(row.id),
      })),
    );
  }

  async upsertLegalDocument(
    storeId: string,
    documentType: StoreLegalDocument['documentType'],
    input: Pick<StoreLegalDocument, 'versionLabel' | 'isPublished' | 'effectiveFrom'> & {
      translations: Array<Pick<StoreLegalDocumentTranslation, 'locale' | 'title' | 'body'>>;
    },
  ) {
    const existing = await this.findLatestLegalDocument(storeId, documentType);
    const now = new Date().toISOString();
    const id = existing?.id ?? randomUUID();

    const row = existing
      ? await this.databaseService
          .prepare(
            `UPDATE "StoreLegalDocument"
             SET "versionLabel" = $versionLabel,
                 "isPublished" = $isPublished,
                 "effectiveFrom" = $effectiveFrom,
                 "updatedAt" = $updatedAt
             WHERE "id" = $id
             RETURNING *`,
          )
          .get<StoreLegalDocumentRow>({
            $id: id,
            $versionLabel: input.versionLabel,
            $isPublished: input.isPublished,
            $effectiveFrom: input.effectiveFrom,
            $updatedAt: now,
          })
      : await this.databaseService
          .prepare(
            `INSERT INTO "StoreLegalDocument" (
              "id", "storeId", "documentType", "versionLabel", "isPublished",
              "effectiveFrom", "createdAt", "updatedAt"
            ) VALUES (
              $id, $storeId, $documentType, $versionLabel, $isPublished,
              $effectiveFrom, $createdAt, $updatedAt
            )
            RETURNING *`,
          )
          .get<StoreLegalDocumentRow>({
            $id: id,
            $storeId: storeId,
            $documentType: documentType,
            $versionLabel: input.versionLabel,
            $isPublished: input.isPublished,
            $effectiveFrom: input.effectiveFrom,
            $createdAt: now,
            $updatedAt: now,
          });

    if (!row) {
      throw new Error('Failed to upsert legal document.');
    }

    await this.databaseService
      .prepare(`DELETE FROM "StoreLegalDocumentTranslation" WHERE "documentId" = $documentId`)
      .run({ $documentId: id });

    for (const translation of input.translations) {
      await this.databaseService
        .prepare(
          `INSERT INTO "StoreLegalDocumentTranslation" (
            "id", "documentId", "locale", "title", "body", "createdAt", "updatedAt"
          ) VALUES (
            $id, $documentId, $locale, $title, $body, $createdAt, $updatedAt
          )`,
        )
        .run({
          $id: randomUUID(),
          $documentId: id,
          $locale: translation.locale,
          $title: translation.title,
          $body: translation.body,
          $createdAt: now,
          $updatedAt: now,
        });
    }

    return {
      ...this.mapStoreLegalDocument(row),
      translations: await this.listLegalDocumentTranslations(id),
    };
  }

  async listProfileNotes(storeId: string, noteType?: StoreProfileNote['noteType']) {
    const rows = await this.databaseService
      .prepare(
        `SELECT * FROM "StoreProfileNote"
         WHERE "storeId" = $storeId
           AND ($noteType::text IS NULL OR "noteType" = $noteType::text)
         ORDER BY "updatedAt" DESC`,
      )
      .all<StoreProfileNoteRow>({
        $storeId: storeId,
        $noteType: noteType ?? null,
      });

    return Promise.all(
      rows.map(async (row) => ({
        ...this.mapStoreProfileNote(row),
        translations: await this.listProfileNoteTranslations(row.id),
      })),
    );
  }

  async upsertProfileNote(
    storeId: string,
    noteType: StoreProfileNote['noteType'],
    input: Pick<StoreProfileNote, 'isPublished'> & {
      translations: Array<Pick<StoreProfileNoteTranslation, 'locale' | 'title' | 'body'>>;
    },
  ) {
    const existing = await this.findLatestProfileNote(storeId, noteType);
    const now = new Date().toISOString();
    const id = existing?.id ?? randomUUID();

    const row = existing
      ? await this.databaseService
          .prepare(
            `UPDATE "StoreProfileNote"
             SET "isPublished" = $isPublished,
                 "updatedAt" = $updatedAt
             WHERE "id" = $id
             RETURNING *`,
          )
          .get<StoreProfileNoteRow>({
            $id: id,
            $isPublished: input.isPublished,
            $updatedAt: now,
          })
      : await this.databaseService
          .prepare(
            `INSERT INTO "StoreProfileNote" (
              "id", "storeId", "noteType", "isPublished", "createdAt", "updatedAt"
            ) VALUES (
              $id, $storeId, $noteType, $isPublished, $createdAt, $updatedAt
            )
            RETURNING *`,
          )
          .get<StoreProfileNoteRow>({
            $id: id,
            $storeId: storeId,
            $noteType: noteType,
            $isPublished: input.isPublished,
            $createdAt: now,
            $updatedAt: now,
          });

    if (!row) {
      throw new Error('Failed to upsert profile note.');
    }

    await this.databaseService
      .prepare(`DELETE FROM "StoreProfileNoteTranslation" WHERE "noteId" = $noteId`)
      .run({ $noteId: id });

    for (const translation of input.translations) {
      await this.databaseService
        .prepare(
          `INSERT INTO "StoreProfileNoteTranslation" (
            "id", "noteId", "locale", "title", "body", "createdAt", "updatedAt"
          ) VALUES (
            $id, $noteId, $locale, $title, $body, $createdAt, $updatedAt
          )`,
        )
        .run({
          $id: randomUUID(),
          $noteId: id,
          $locale: translation.locale,
          $title: translation.title ?? null,
          $body: translation.body,
          $createdAt: now,
          $updatedAt: now,
        });
    }

    return {
      ...this.mapStoreProfileNote(row),
      translations: await this.listProfileNoteTranslations(id),
    };
  }

  async listSliders(storeId: string) {
    const rows = await this.databaseService
      .prepare(
        `SELECT * FROM "StoreSlider"
         WHERE "storeId" = $storeId
         ORDER BY "updatedAt" DESC`,
      )
      .all<StoreSliderRow>({ $storeId: storeId });

    return Promise.all(
      rows.map(async (row) => ({
        ...this.mapStoreSlider(row),
        items: await this.listSliderItems(row.id),
      })),
    );
  }

  async createSlider(
    storeId: string,
    input: Pick<StoreSlider, 'name' | 'sliderType' | 'isActive'>,
  ) {
    const now = new Date().toISOString();
    const row = await this.databaseService
      .prepare(
        `INSERT INTO "StoreSlider" (
          "id", "storeId", "name", "sliderType", "isActive", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $name, $sliderType, $isActive, $createdAt, $updatedAt
        )
        RETURNING *`,
      )
      .get<StoreSliderRow>({
        $id: randomUUID(),
        $storeId: storeId,
        $name: input.name,
        $sliderType: input.sliderType,
        $isActive: input.isActive,
        $createdAt: now,
        $updatedAt: now,
      });

    if (!row) {
      throw new Error('Failed to create store slider.');
    }

    return {
      ...this.mapStoreSlider(row),
      items: [] as StoreSliderItem[],
    };
  }

  async updateSlider(
    storeId: string,
    sliderId: string,
    input: Partial<Pick<StoreSlider, 'name' | 'sliderType' | 'isActive'>>,
  ) {
    const existing = await this.findSlider(storeId, sliderId);
    if (!existing) {
      return null;
    }

    const row = await this.databaseService
      .prepare(
        `UPDATE "StoreSlider"
         SET "name" = $name,
             "sliderType" = $sliderType,
             "isActive" = $isActive,
             "updatedAt" = $updatedAt
         WHERE "id" = $sliderId
           AND "storeId" = $storeId
         RETURNING *`,
      )
      .get<StoreSliderRow>({
        $sliderId: sliderId,
        $storeId: storeId,
        $name: input.name ?? existing.name,
        $sliderType: input.sliderType ?? existing.sliderType,
        $isActive: input.isActive ?? existing.isActive,
        $updatedAt: new Date().toISOString(),
      });

    return row
      ? { ...this.mapStoreSlider(row), items: await this.listSliderItems(row.id) }
      : null;
  }

  async deleteSlider(storeId: string, sliderId: string) {
    await this.databaseService.prepare(`DELETE FROM "StoreSliderItem" WHERE "sliderId" = $sliderId`).run({ $sliderId: sliderId });
    const result = await this.databaseService
      .prepare(
        `DELETE FROM "StoreSlider"
         WHERE "id" = $sliderId
           AND "storeId" = $storeId`,
      )
      .run({
        $sliderId: sliderId,
        $storeId: storeId,
      });

    return (result.rowCount ?? 0) > 0;
  }

  async createSliderItem(
    sliderId: string,
    input: Pick<StoreSliderItem, 'imageAssetId' | 'title' | 'caption' | 'targetUrl' | 'sortOrder' | 'isActive'>,
  ) {
    const now = new Date().toISOString();
    const row = await this.databaseService
      .prepare(
        `INSERT INTO "StoreSliderItem" (
          "id", "sliderId", "imageAssetId", "title", "caption", "targetUrl",
          "sortOrder", "isActive", "createdAt", "updatedAt"
        ) VALUES (
          $id, $sliderId, $imageAssetId, $title, $caption, $targetUrl,
          $sortOrder, $isActive, $createdAt, $updatedAt
        )
        RETURNING *`,
      )
      .get<StoreSliderItemRow>({
        $id: randomUUID(),
        $sliderId: sliderId,
        $imageAssetId: input.imageAssetId,
        $title: input.title,
        $caption: input.caption,
        $targetUrl: input.targetUrl,
        $sortOrder: input.sortOrder,
        $isActive: input.isActive,
        $createdAt: now,
        $updatedAt: now,
      });

    if (!row) {
      throw new Error('Failed to create slider item.');
    }

    return this.mapStoreSliderItem(row);
  }

  async updateSliderItem(
    sliderId: string,
    itemId: string,
    input: Partial<Pick<StoreSliderItem, 'imageAssetId' | 'title' | 'caption' | 'targetUrl' | 'sortOrder' | 'isActive'>>,
  ) {
    const existing = await this.findSliderItem(sliderId, itemId);
    if (!existing) {
      return null;
    }

    const row = await this.databaseService
      .prepare(
        `UPDATE "StoreSliderItem"
         SET "imageAssetId" = $imageAssetId,
             "title" = $title,
             "caption" = $caption,
             "targetUrl" = $targetUrl,
             "sortOrder" = $sortOrder,
             "isActive" = $isActive,
             "updatedAt" = $updatedAt
         WHERE "id" = $itemId
           AND "sliderId" = $sliderId
         RETURNING *`,
      )
      .get<StoreSliderItemRow>({
        $itemId: itemId,
        $sliderId: sliderId,
        $imageAssetId: input.imageAssetId === undefined ? existing.imageAssetId : input.imageAssetId,
        $title: input.title === undefined ? existing.title : input.title,
        $caption: input.caption === undefined ? existing.caption : input.caption,
        $targetUrl: input.targetUrl === undefined ? existing.targetUrl : input.targetUrl,
        $sortOrder: input.sortOrder ?? existing.sortOrder,
        $isActive: input.isActive ?? existing.isActive,
        $updatedAt: new Date().toISOString(),
      });

    return row ? this.mapStoreSliderItem(row) : null;
  }

  async deleteSliderItem(sliderId: string, itemId: string) {
    const result = await this.databaseService
      .prepare(
        `DELETE FROM "StoreSliderItem"
         WHERE "id" = $itemId
           AND "sliderId" = $sliderId`,
      )
      .run({
        $itemId: itemId,
        $sliderId: sliderId,
      });

    return (result.rowCount ?? 0) > 0;
  }

  private findStoreSetting(storeId: string) {
    return this.databaseService
      .prepare(`SELECT * FROM "StoreSetting" WHERE "storeId" = $storeId`)
      .get<StoreSettingRow>({ $storeId: storeId })
      .then((row) => (row ? this.mapStoreSetting(row) : null));
  }

  private findStoreTaxSetting(storeId: string) {
    return this.databaseService
      .prepare(`SELECT * FROM "StoreTaxSetting" WHERE "storeId" = $storeId`)
      .get<StoreTaxSettingRow>({ $storeId: storeId })
      .then((row) => (row ? this.mapStoreTaxSetting(row) : null));
  }

  private findStoreDeliveryFeeSetting(storeId: string) {
    return this.databaseService
      .prepare(
        `SELECT * FROM "StoreDeliveryFeeSetting" WHERE "storeId" = $storeId`,
      )
      .get<StoreDeliveryFeeSettingRow>({ $storeId: storeId })
      .then((row) => (row ? this.mapStoreDeliveryFeeSetting(row) : null));
  }

  private findStoreReservationSetting(storeId: string) {
    return this.databaseService
      .prepare(
        `SELECT * FROM "StoreReservationSetting" WHERE "storeId" = $storeId`,
      )
      .get<StoreReservationSettingRow>({ $storeId: storeId })
      .then((row) => (row ? this.mapStoreReservationSetting(row) : null));
  }

  private findStoreReceiptSetting(storeId: string) {
    return this.databaseService
      .prepare(
        `SELECT * FROM "StoreReceiptSetting" WHERE "storeId" = $storeId`,
      )
      .get<StoreReceiptSettingRow>({ $storeId: storeId })
      .then((row) => (row ? this.mapStoreReceiptSetting(row) : null));
  }

  private findStoreContentSetting(storeId: string) {
    return this.databaseService
      .prepare(`SELECT * FROM "StoreContentSetting" WHERE "storeId" = $storeId`)
      .get<StoreContentSettingRow>({ $storeId: storeId })
      .then((row) => (row ? this.mapStoreContentSetting(row) : null));
  }

  private findLatestLegalDocument(storeId: string, documentType: StoreLegalDocument['documentType']) {
    return this.databaseService
      .prepare(
        `SELECT * FROM "StoreLegalDocument"
         WHERE "storeId" = $storeId
           AND "documentType" = $documentType
         ORDER BY "updatedAt" DESC
         LIMIT 1`,
      )
      .get<StoreLegalDocumentRow>({
        $storeId: storeId,
        $documentType: documentType,
      })
      .then((row) => (row ? this.mapStoreLegalDocument(row) : null));
  }

  private listLegalDocumentTranslations(documentId: string) {
    return this.databaseService
      .prepare(
        `SELECT * FROM "StoreLegalDocumentTranslation"
         WHERE "documentId" = $documentId
         ORDER BY "locale" ASC`,
      )
      .all<StoreLegalDocumentTranslationRow>({ $documentId: documentId })
      .then((rows) => rows.map((row) => this.mapStoreLegalDocumentTranslation(row)));
  }

  private findLatestProfileNote(storeId: string, noteType: StoreProfileNote['noteType']) {
    return this.databaseService
      .prepare(
        `SELECT * FROM "StoreProfileNote"
         WHERE "storeId" = $storeId
           AND "noteType" = $noteType
         ORDER BY "updatedAt" DESC
         LIMIT 1`,
      )
      .get<StoreProfileNoteRow>({
        $storeId: storeId,
        $noteType: noteType,
      })
      .then((row) => (row ? this.mapStoreProfileNote(row) : null));
  }

  private listProfileNoteTranslations(noteId: string) {
    return this.databaseService
      .prepare(
        `SELECT * FROM "StoreProfileNoteTranslation"
         WHERE "noteId" = $noteId
         ORDER BY "locale" ASC`,
      )
      .all<StoreProfileNoteTranslationRow>({ $noteId: noteId })
      .then((rows) => rows.map((row) => this.mapStoreProfileNoteTranslation(row)));
  }

  private findSlider(storeId: string, sliderId: string) {
    return this.databaseService
      .prepare(
        `SELECT * FROM "StoreSlider"
         WHERE "id" = $sliderId
           AND "storeId" = $storeId`,
      )
      .get<StoreSliderRow>({
        $sliderId: sliderId,
        $storeId: storeId,
      })
      .then((row) => (row ? this.mapStoreSlider(row) : null));
  }

  private listSliderItems(sliderId: string) {
    return this.databaseService
      .prepare(
        `SELECT * FROM "StoreSliderItem"
         WHERE "sliderId" = $sliderId
         ORDER BY "sortOrder" ASC, "createdAt" ASC`,
      )
      .all<StoreSliderItemRow>({ $sliderId: sliderId })
      .then((rows) => rows.map((row) => this.mapStoreSliderItem(row)));
  }

  private findSliderItem(sliderId: string, itemId: string) {
    return this.databaseService
      .prepare(
        `SELECT * FROM "StoreSliderItem"
         WHERE "id" = $itemId
           AND "sliderId" = $sliderId`,
      )
      .get<StoreSliderItemRow>({
        $itemId: itemId,
        $sliderId: sliderId,
      })
      .then((row) => (row ? this.mapStoreSliderItem(row) : null));
  }

  private mapStoreSetting(row: StoreSettingRow): StoreSetting {
    return {
      id: row.id,
      storeId: row.storeId,
      defaultCurrencyId: row.defaultCurrencyId,
      defaultLanguageId: row.defaultLanguageId,
      advancedOptionsJson: row.advancedOptionsJson ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreTaxSetting(row: StoreTaxSettingRow): StoreTaxSetting {
    return {
      id: row.id,
      storeId: row.storeId,
      taxRegistrationNumber: row.taxRegistrationNumber,
      priceIncludesTax: row.priceIncludesTax,
      defaultVatRate: Number(row.defaultVatRate),
      serviceChargeRate: Number(row.serviceChargeRate),
      invoiceFooterText: row.invoiceFooterText,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapDiscountRule(row: StoreDiscountRuleRow): StoreDiscountRule {
    return {
      id: row.id,
      storeId: row.storeId,
      name: row.name,
      ruleType: row.ruleType as StoreDiscountRule['ruleType'],
      valueType: row.valueType as StoreDiscountRule['valueType'],
      valueAmount: Number(row.valueAmount),
      isActive: row.isActive,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreDeliveryFeeSetting(
    row: StoreDeliveryFeeSettingRow,
  ): StoreDeliveryFeeSetting {
    return {
      id: row.id,
      storeId: row.storeId,
      baseFee: Number(row.baseFee),
      freeDeliveryThreshold:
        row.freeDeliveryThreshold === null ? null : Number(row.freeDeliveryThreshold),
      surgeFeeEnabled: row.surgeFeeEnabled,
      smallOrderFee: Number(row.smallOrderFee),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreReservationSetting(
    row: StoreReservationSettingRow,
  ): StoreReservationSetting {
    return {
      id: row.id,
      storeId: row.storeId,
      enabled: row.enabled,
      requiresApproval: row.requiresApproval,
      maxPartySize: row.maxPartySize === null ? null : Number(row.maxPartySize),
      defaultSlotMinutes: Number(row.defaultSlotMinutes),
      leadTimeMinutes: Number(row.leadTimeMinutes),
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreReceiptSetting(
    row: StoreReceiptSettingRow,
  ): StoreReceiptSetting {
    return {
      id: row.id,
      storeId: row.storeId,
      headerText: row.headerText,
      footerText: row.footerText,
      showTaxBreakdown: row.showTaxBreakdown,
      showQrCode: row.showQrCode,
      layoutConfigJson: row.layoutConfigJson ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreContentSetting(row: StoreContentSettingRow): StoreContentSetting {
    return {
      id: row.id,
      storeId: row.storeId,
      defaultLocale: row.defaultLocale,
      socialLinksJson: row.socialLinksJson ?? {},
      marketingHeadline: row.marketingHeadline,
      marketingDescription: row.marketingDescription,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreLegalDocument(row: StoreLegalDocumentRow): StoreLegalDocument {
    return {
      id: row.id,
      storeId: row.storeId,
      documentType: row.documentType as StoreLegalDocument['documentType'],
      versionLabel: row.versionLabel,
      isPublished: row.isPublished,
      effectiveFrom: row.effectiveFrom,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreLegalDocumentTranslation(
    row: StoreLegalDocumentTranslationRow,
  ): StoreLegalDocumentTranslation {
    return {
      id: row.id,
      documentId: row.documentId,
      locale: row.locale,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreProfileNote(row: StoreProfileNoteRow): StoreProfileNote {
    return {
      id: row.id,
      storeId: row.storeId,
      noteType: row.noteType as StoreProfileNote['noteType'],
      isPublished: row.isPublished,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreProfileNoteTranslation(
    row: StoreProfileNoteTranslationRow,
  ): StoreProfileNoteTranslation {
    return {
      id: row.id,
      noteId: row.noteId,
      locale: row.locale,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreSlider(row: StoreSliderRow): StoreSlider {
    return {
      id: row.id,
      storeId: row.storeId,
      name: row.name,
      sliderType: row.sliderType as StoreSlider['sliderType'],
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapStoreSliderItem(row: StoreSliderItemRow): StoreSliderItem {
    return {
      id: row.id,
      sliderId: row.sliderId,
      imageAssetId: row.imageAssetId,
      title: row.title,
      caption: row.caption,
      targetUrl: row.targetUrl,
      sortOrder: Number(row.sortOrder),
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // ── Payment methods (assignment table → joined view) ───────────────────────
  async listPaymentMethods(storeId: string): Promise<StorePaymentMethodView[]> {
    const rows = await this.databaseService
      .prepare(
        `SELECT rpm.*,
                pm."code" AS "code",
                pm."displayName" AS "displayName",
                pm."iconKey" AS "iconKey"
         FROM "StorePaymentMethod" rpm
         INNER JOIN "PaymentMethod" pm ON pm."id" = rpm."paymentMethodId"
         WHERE rpm."storeId" = $storeId
         ORDER BY rpm."sortOrder" ASC, pm."code" ASC`,
      )
      .all<StorePaymentMethodRow>({ $storeId: storeId });

    return rows.map((row) => this.mapPaymentMethodView(row));
  }

  async listActivePaymentMethods(
    storeId: string,
  ): Promise<StorePaymentMethodView[]> {
    const rows = await this.databaseService
      .prepare(
        `SELECT rpm.*,
                pm."code" AS "code",
                pm."displayName" AS "displayName",
                pm."iconKey" AS "iconKey"
         FROM "StorePaymentMethod" rpm
         INNER JOIN "PaymentMethod" pm ON pm."id" = rpm."paymentMethodId"
         WHERE rpm."storeId" = $storeId
           AND rpm."isActive" = TRUE
           AND pm."isActive" = TRUE
         ORDER BY rpm."sortOrder" ASC, pm."code" ASC`,
      )
      .all<StorePaymentMethodRow>({ $storeId: storeId });

    return rows.map((row) => this.mapPaymentMethodView(row));
  }

  async findActivePaymentMethodAssignment(
    storeId: string,
    paymentMethodId: string,
  ): Promise<StorePaymentMethodView | null> {
    const row = await this.databaseService
      .prepare(
        `SELECT rpm.*,
                pm."code" AS "code",
                pm."displayName" AS "displayName",
                pm."iconKey" AS "iconKey"
         FROM "StorePaymentMethod" rpm
         INNER JOIN "PaymentMethod" pm ON pm."id" = rpm."paymentMethodId"
         WHERE rpm."storeId" = $storeId
           AND rpm."paymentMethodId" = $paymentMethodId
           AND rpm."isActive" = TRUE
           AND pm."isActive" = TRUE
         LIMIT 1`,
      )
      .get<StorePaymentMethodRow>({
        $storeId: storeId,
        $paymentMethodId: paymentMethodId,
      });

    return row ? this.mapPaymentMethodView(row) : null;
  }

  async replacePaymentMethods(
    storeId: string,
    entries: Array<{
      paymentMethodId: string;
      customLabel: string | null;
      isActive: boolean;
      sortOrder: number;
    }>,
  ): Promise<StorePaymentMethodView[]> {
    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(`DELETE FROM "StorePaymentMethod" WHERE "storeId" = $storeId`)
        .run({ $storeId: storeId });

      const now = new Date().toISOString();
      for (const entry of entries) {
        await this.databaseService
          .prepare(
            `INSERT INTO "StorePaymentMethod" (
              "id", "storeId", "paymentMethodId", "customLabel", "isActive", "sortOrder",
              "createdAt", "updatedAt"
            ) VALUES (
              $id, $storeId, $paymentMethodId, $customLabel, $isActive, $sortOrder,
              $createdAt, $updatedAt
            )`,
          )
          .run({
            $id: randomUUID(),
            $storeId: storeId,
            $paymentMethodId: entry.paymentMethodId,
            $customLabel: entry.customLabel,
            $isActive: entry.isActive,
            $sortOrder: entry.sortOrder,
            $createdAt: now,
            $updatedAt: now,
          });
      }
    });

    return this.listPaymentMethods(storeId);
  }

  // ── Service types (assignment table → joined view) ─────────────────────────
  async listServiceTypes(storeId: string): Promise<StoreServiceTypeView[]> {
    const rows = await this.databaseService
      .prepare(
        `SELECT rst.*,
                st."code" AS "code",
                st."displayName" AS "displayName",
                st."iconKey" AS "iconKey"
         FROM "StoreServiceType" rst
         INNER JOIN "ServiceType" st ON st."id" = rst."serviceTypeId"
         WHERE rst."storeId" = $storeId
         ORDER BY rst."sortOrder" ASC, st."code" ASC`,
      )
      .all<StoreServiceTypeRow>({ $storeId: storeId });

    return rows.map((row) => this.mapServiceTypeView(row));
  }

  async listActiveServiceTypes(
    storeId: string,
  ): Promise<StoreServiceTypeView[]> {
    const rows = await this.databaseService
      .prepare(
        `SELECT rst.*,
                st."code" AS "code",
                st."displayName" AS "displayName",
                st."iconKey" AS "iconKey"
         FROM "StoreServiceType" rst
         INNER JOIN "ServiceType" st ON st."id" = rst."serviceTypeId"
         WHERE rst."storeId" = $storeId
           AND rst."isActive" = TRUE
           AND st."isActive" = TRUE
         ORDER BY rst."sortOrder" ASC, st."code" ASC`,
      )
      .all<StoreServiceTypeRow>({ $storeId: storeId });

    return rows.map((row) => this.mapServiceTypeView(row));
  }

  async findActiveServiceTypeAssignment(
    storeId: string,
    serviceTypeId: string,
  ): Promise<StoreServiceTypeView | null> {
    const row = await this.databaseService
      .prepare(
        `SELECT rst.*,
                st."code" AS "code",
                st."displayName" AS "displayName",
                st."iconKey" AS "iconKey"
         FROM "StoreServiceType" rst
         INNER JOIN "ServiceType" st ON st."id" = rst."serviceTypeId"
         WHERE rst."storeId" = $storeId
           AND rst."serviceTypeId" = $serviceTypeId
           AND rst."isActive" = TRUE
           AND st."isActive" = TRUE
         LIMIT 1`,
      )
      .get<StoreServiceTypeRow>({
        $storeId: storeId,
        $serviceTypeId: serviceTypeId,
      });

    return row ? this.mapServiceTypeView(row) : null;
  }

  async replaceServiceTypes(
    storeId: string,
    entries: Array<{
      serviceTypeId: string;
      customLabel: string | null;
      isActive: boolean;
      sortOrder: number;
    }>,
  ): Promise<StoreServiceTypeView[]> {
    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(`DELETE FROM "StoreServiceType" WHERE "storeId" = $storeId`)
        .run({ $storeId: storeId });

      const now = new Date().toISOString();
      for (const entry of entries) {
        await this.databaseService
          .prepare(
            `INSERT INTO "StoreServiceType" (
              "id", "storeId", "serviceTypeId", "customLabel", "isActive", "sortOrder",
              "createdAt", "updatedAt"
            ) VALUES (
              $id, $storeId, $serviceTypeId, $customLabel, $isActive, $sortOrder,
              $createdAt, $updatedAt
            )`,
          )
          .run({
            $id: randomUUID(),
            $storeId: storeId,
            $serviceTypeId: entry.serviceTypeId,
            $customLabel: entry.customLabel,
            $isActive: entry.isActive,
            $sortOrder: entry.sortOrder,
            $createdAt: now,
            $updatedAt: now,
          });
      }
    });

    return this.listServiceTypes(storeId);
  }

  // ── Ordering policy ────────────────────────────────────────────────────────
  async getOrCreateOrderingPolicy(storeId: string): Promise<StoreOrderingPolicy> {
    const existing = await this.findOrderingPolicy(storeId);
    if (existing) {
      return existing;
    }

    return this.upsertOrderingPolicy(storeId, {
      minOrderAmount: 0,
      acceptsDelivery: true,
      acceptsPickup: true,
      currencyCode: await this.resolveInstallCurrencyCode(),
    });
  }

  async upsertOrderingPolicy(
    storeId: string,
    input: Pick<
      StoreOrderingPolicy,
      'minOrderAmount' | 'acceptsDelivery' | 'acceptsPickup' | 'currencyCode'
    >,
  ): Promise<StoreOrderingPolicy> {
    const now = new Date().toISOString();
    const id = randomUUID();
    const row = await this.databaseService
      .prepare(
        `INSERT INTO "StoreOrderingPolicy" (
          "id", "storeId", "minOrderAmount", "acceptsDelivery",
          "acceptsPickup", "currencyCode", "createdAt", "updatedAt"
        ) VALUES (
          $id, $storeId, $minOrderAmount, $acceptsDelivery,
          $acceptsPickup, $currencyCode, $createdAt, $updatedAt
        )
        ON CONFLICT ("storeId") DO UPDATE
        SET "minOrderAmount" = EXCLUDED."minOrderAmount",
            "acceptsDelivery" = EXCLUDED."acceptsDelivery",
            "acceptsPickup" = EXCLUDED."acceptsPickup",
            "currencyCode" = EXCLUDED."currencyCode",
            "updatedAt" = EXCLUDED."updatedAt"
        RETURNING *`,
      )
      .get<StoreOrderingPolicyRow>({
        $id: id,
        $storeId: storeId,
        $minOrderAmount: input.minOrderAmount,
        $acceptsDelivery: input.acceptsDelivery,
        $acceptsPickup: input.acceptsPickup,
        $currencyCode: input.currencyCode,
        $createdAt: now,
        $updatedAt: now,
      });

    if (!row) {
      throw new Error('Failed to upsert store ordering policy.');
    }

    return this.mapOrderingPolicy(row);
  }

  // ── Delivery fee tiers ─────────────────────────────────────────────────────
  async listDeliveryFeeTiers(storeId: string): Promise<StoreDeliveryFeeTier[]> {
    const rows = await this.databaseService
      .prepare(
        `SELECT * FROM "StoreDeliveryFeeTier"
         WHERE "storeId" = $storeId
         ORDER BY "minDistanceKm" ASC, "sortOrder" ASC`,
      )
      .all<StoreDeliveryFeeTierRow>({ $storeId: storeId });

    return rows.map((row) => this.mapDeliveryFeeTier(row));
  }

  async replaceDeliveryFeeTiers(
    storeId: string,
    tiers: Array<
      Pick<
        StoreDeliveryFeeTier,
        'minDistanceKm' | 'maxDistanceKm' | 'feeAmount' | 'sortOrder' | 'isActive'
      >
    >,
  ): Promise<StoreDeliveryFeeTier[]> {
    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(`DELETE FROM "StoreDeliveryFeeTier" WHERE "storeId" = $storeId`)
        .run({ $storeId: storeId });

      const now = new Date().toISOString();
      for (const tier of tiers) {
        await this.databaseService
          .prepare(
            `INSERT INTO "StoreDeliveryFeeTier" (
              "id", "storeId", "minDistanceKm", "maxDistanceKm",
              "feeAmount", "sortOrder", "isActive", "createdAt", "updatedAt"
            ) VALUES (
              $id, $storeId, $minDistanceKm, $maxDistanceKm,
              $feeAmount, $sortOrder, $isActive, $createdAt, $updatedAt
            )`,
          )
          .run({
            $id: randomUUID(),
            $storeId: storeId,
            $minDistanceKm: tier.minDistanceKm,
            $maxDistanceKm: tier.maxDistanceKm,
            $feeAmount: tier.feeAmount,
            $sortOrder: tier.sortOrder,
            $isActive: tier.isActive,
            $createdAt: now,
            $updatedAt: now,
          });
      }
    });

    return this.listDeliveryFeeTiers(storeId);
  }

  private async findOrderingPolicy(storeId: string) {
    const row = await this.databaseService
      .prepare(
        `SELECT * FROM "StoreOrderingPolicy" WHERE "storeId" = $storeId`,
      )
      .get<StoreOrderingPolicyRow>({ $storeId: storeId });

    return row ? this.mapOrderingPolicy(row) : null;
  }

  private mapPaymentMethodView(row: StorePaymentMethodRow): StorePaymentMethodView {
    return {
      id: row.id,
      storeId: row.storeId,
      paymentMethodId: row.paymentMethodId,
      isActive: Boolean(row.isActive),
      sortOrder: Number(row.sortOrder),
      customLabel: row.customLabel,
      code: row.code,
      displayName: row.displayName,
      iconKey: row.iconKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapServiceTypeView(row: StoreServiceTypeRow): StoreServiceTypeView {
    return {
      id: row.id,
      storeId: row.storeId,
      serviceTypeId: row.serviceTypeId,
      isActive: Boolean(row.isActive),
      sortOrder: Number(row.sortOrder),
      customLabel: row.customLabel,
      code: row.code,
      displayName: row.displayName,
      iconKey: row.iconKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapOrderingPolicy(row: StoreOrderingPolicyRow): StoreOrderingPolicy {
    return {
      id: row.id,
      storeId: row.storeId,
      minOrderAmount: Number(row.minOrderAmount),
      acceptsDelivery: row.acceptsDelivery,
      acceptsPickup: row.acceptsPickup,
      currencyCode: row.currencyCode,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapDeliveryFeeTier(row: StoreDeliveryFeeTierRow): StoreDeliveryFeeTier {
    return {
      id: row.id,
      storeId: row.storeId,
      minDistanceKm: Number(row.minDistanceKm),
      maxDistanceKm: Number(row.maxDistanceKm),
      feeAmount: Number(row.feeAmount),
      sortOrder: Number(row.sortOrder),
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

interface StorePaymentMethodRow {
  id: string;
  storeId: string;
  paymentMethodId: string;
  customLabel: string | null;
  isActive: boolean;
  sortOrder: number | string;
  code: string;
  displayName: string;
  iconKey: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreServiceTypeRow {
  id: string;
  storeId: string;
  serviceTypeId: string;
  customLabel: string | null;
  isActive: boolean;
  sortOrder: number | string;
  code: string;
  displayName: string;
  iconKey: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreOrderingPolicyRow {
  id: string;
  storeId: string;
  minOrderAmount: number | string;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreDeliveryFeeTierRow {
  id: string;
  storeId: string;
  minDistanceKm: number | string;
  maxDistanceKm: number | string;
  feeAmount: number | string;
  sortOrder: number | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoreSettingRow {
  id: string;
  storeId: string;
  defaultCurrencyId: string;
  defaultLanguageId: string;
  advancedOptionsJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreTaxSettingRow {
  id: string;
  storeId: string;
  taxRegistrationNumber: string | null;
  priceIncludesTax: boolean;
  defaultVatRate: string | number;
  serviceChargeRate: string | number;
  invoiceFooterText: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreDiscountRuleRow {
  id: string;
  storeId: string;
  name: string;
  ruleType: string;
  valueType: string;
  valueAmount: string | number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreDeliveryFeeSettingRow {
  id: string;
  storeId: string;
  baseFee: string | number;
  freeDeliveryThreshold: string | number | null;
  surgeFeeEnabled: boolean;
  smallOrderFee: string | number;
  createdAt: string;
  updatedAt: string;
}

interface StoreReservationSettingRow {
  id: string;
  storeId: string;
  enabled: boolean;
  requiresApproval: boolean;
  maxPartySize: number | null;
  defaultSlotMinutes: number;
  leadTimeMinutes: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreReceiptSettingRow {
  id: string;
  storeId: string;
  headerText: string | null;
  footerText: string | null;
  showTaxBreakdown: boolean;
  showQrCode: boolean;
  layoutConfigJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreContentSettingRow {
  id: string;
  storeId: string;
  defaultLocale: string;
  socialLinksJson: Record<string, unknown> | null;
  marketingHeadline: string | null;
  marketingDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreLegalDocumentRow {
  id: string;
  storeId: string;
  documentType: string;
  versionLabel: string;
  isPublished: boolean;
  effectiveFrom: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreLegalDocumentTranslationRow {
  id: string;
  documentId: string;
  locale: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreProfileNoteRow {
  id: string;
  storeId: string;
  noteType: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoreProfileNoteTranslationRow {
  id: string;
  noteId: string;
  locale: string;
  title: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface StoreSliderRow {
  id: string;
  storeId: string;
  name: string;
  sliderType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StoreSliderItemRow {
  id: string;
  sliderId: string;
  imageAssetId: string | null;
  title: string | null;
  caption: string | null;
  targetUrl: string | null;
  sortOrder: string | number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
