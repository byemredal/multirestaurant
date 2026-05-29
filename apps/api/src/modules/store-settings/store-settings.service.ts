import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InstallationProfileService } from '../setup/installation-profile.service';
import {
  StoreLegalDocument,
  StoreProfileNote,
  StoreDeliveryFeeSetting,
  StoreDiscountRule,
  StoreReceiptSetting,
  StoreReservationSetting,
  StoreSetting,
  StoreSlider,
  StoreSliderItem,
  StoreTaxSetting,
} from '../tenant-management/entities';
import { StoresService } from '../stores/stores.service';
import { ReplaceDeliveryFeeTiersDto } from './dto/replace-delivery-fee-tiers.dto';
import { UpdateOrderingPolicyDto } from './dto/update-ordering-policy.dto';
import { UpdatePaymentMethodsDto } from './dto/update-payment-methods.dto';
import { CreateStoreSliderDto } from './dto/create-store-slider.dto';
import { CreateStoreSliderItemDto } from './dto/create-store-slider-item.dto';
import { CreateDiscountRuleDto } from './dto/create-discount-rule.dto';
import { UpdateDiscountRuleDto } from './dto/update-discount-rule.dto';
import { UpdateStoreDeliveryFeeSettingDto } from './dto/update-store-delivery-fee-setting.dto';
import { UpdateStoreLegalDocumentDto } from './dto/update-store-legal-document.dto';
import { UpdateStoreProfileNoteDto } from './dto/update-store-profile-note.dto';
import { UpdateStoreReceiptSettingDto } from './dto/update-store-receipt-setting.dto';
import { UpdateStoreReservationSettingDto } from './dto/update-store-reservation-setting.dto';
import { UpdateStoreSettingDto } from './dto/update-store-setting.dto';
import { UpdateStoreSliderDto } from './dto/update-store-slider.dto';
import { UpdateStoreSliderItemDto } from './dto/update-store-slider-item.dto';
import { UpdateStoreTaxSettingDto } from './dto/update-store-tax-setting.dto';
import { SystemTaxonomyService } from '../system-taxonomy/system-taxonomy.service';
import {
  ReplaceStorePaymentMethodsDto,
  ReplaceStoreServiceTypesDto,
} from '../system-taxonomy/dto/replace-store-assignments.dto';
import { StoreSettingsStore } from './store-settings.store';

@Injectable()
export class StoreSettingsService {
  constructor(
    private readonly store: StoreSettingsStore,
    private readonly storesService: StoresService,
    private readonly systemTaxonomyService: SystemTaxonomyService,
    private readonly installationProfile: InstallationProfileService,
  ) {}

  /**
   * The platform is single-country, so a store's currency must equal the active
   * platform currency. Rejects mismatches with a stable `store_currency_mismatch`
   * code the UI can branch on.
   */
  private async assertCurrencyMatchesPlatform(currencyCode: string) {
    const policy = await this.installationProfile.findActiveCountryPolicy();
    if (!policy) {
      return;
    }
    if (currencyCode.trim().toUpperCase() !== policy.currencyCode.toUpperCase()) {
      throw new ConflictException({
        code: 'store_currency_mismatch',
        message: `Store currency must match the platform currency (${policy.currencyCode}).`,
      });
    }
  }

  async getStoreSetting(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    return this.store.getOrCreateStoreSetting(storeId);
  }

  async upsertStoreSetting(
    storeId: string,
    tenantId: string,
    dto: UpdateStoreSettingDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const existing = await this.store.getOrCreateStoreSetting(storeId);

    return this.store.upsertStoreSetting(storeId, {
      defaultCurrencyId: existing.defaultCurrencyId,
      defaultLanguageId: existing.defaultLanguageId,
      advancedOptionsJson: dto.advancedOptionsJson ?? existing.advancedOptionsJson,
    });
  }

  async upsertStoreLocalization(
    storeId: string,
    tenantId: string,
    input: { defaultCurrencyId?: string; defaultLanguageId?: string },
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const existing = await this.store.getOrCreateStoreSetting(storeId);

    if (input.defaultCurrencyId) {
      const currency = await this.systemTaxonomyService.getCurrencyByIdOrThrow(
        input.defaultCurrencyId,
      );
      await this.assertCurrencyMatchesPlatform(currency.code);
    }
    if (input.defaultLanguageId) {
      await this.systemTaxonomyService.getLanguageByIdOrThrow(input.defaultLanguageId);
    }

    return this.store.upsertStoreSetting(storeId, {
      defaultCurrencyId: input.defaultCurrencyId ?? existing.defaultCurrencyId,
      defaultLanguageId: input.defaultLanguageId ?? existing.defaultLanguageId,
      advancedOptionsJson: existing.advancedOptionsJson,
    });
  }

  async getStoreTaxSetting(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    return this.store.getOrCreateStoreTaxSetting(storeId);
  }

  async upsertStoreTaxSetting(
    storeId: string,
    tenantId: string,
    dto: UpdateStoreTaxSettingDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const existing = await this.store.getOrCreateStoreTaxSetting(storeId);

    return this.store.upsertStoreTaxSetting(storeId, {
      taxRegistrationNumber:
        dto.taxRegistrationNumber === undefined
          ? existing.taxRegistrationNumber
          : dto.taxRegistrationNumber.trim() || null,
      priceIncludesTax: dto.priceIncludesTax ?? existing.priceIncludesTax,
      defaultVatRate: dto.defaultVatRate ?? existing.defaultVatRate,
      serviceChargeRate: dto.serviceChargeRate ?? existing.serviceChargeRate,
      invoiceFooterText:
        dto.invoiceFooterText === undefined ? existing.invoiceFooterText : dto.invoiceFooterText.trim() || null,
    });
  }

  async listDiscountRules(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    return {
      discountRules: await this.store.listDiscountRules(storeId),
    };
  }

  async createDiscountRule(
    storeId: string,
    tenantId: string,
    dto: CreateDiscountRuleDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const payload = this.normalizeDiscountRuleInput({
      name: dto.name,
      ruleType: dto.ruleType,
      valueType: dto.valueType,
      valueAmount: dto.valueAmount,
      isActive: dto.isActive ?? true,
      startsAt: dto.startsAt ?? null,
      endsAt: dto.endsAt ?? null,
    });
    return {
      discountRule: await this.store.createDiscountRule(storeId, payload),
    };
  }

  async updateDiscountRule(
    storeId: string,
    ruleId: string,
    tenantId: string,
    dto: UpdateDiscountRuleDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const existing = await this.store.findDiscountRuleById(storeId, ruleId);
    if (!existing) {
      throw new NotFoundException('Discount rule could not be found for this store.');
    }

    const payload = this.normalizeDiscountRuleInput({
      name: dto.name ?? existing.name,
      ruleType: dto.ruleType ?? existing.ruleType,
      valueType: dto.valueType ?? existing.valueType,
      valueAmount: dto.valueAmount ?? existing.valueAmount,
      isActive: dto.isActive ?? existing.isActive,
      startsAt: dto.startsAt === undefined ? existing.startsAt : dto.startsAt,
      endsAt: dto.endsAt === undefined ? existing.endsAt : dto.endsAt,
    });

    const updated = await this.store.updateDiscountRule(storeId, ruleId, payload);
    if (!updated) {
      throw new NotFoundException('Discount rule could not be found for this store.');
    }

    return {
      discountRule: updated,
    };
  }

  async deleteDiscountRule(storeId: string, ruleId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    const deleted = await this.store.deleteDiscountRule(storeId, ruleId);
    if (!deleted) {
      throw new NotFoundException('Discount rule could not be found for this store.');
    }

    return {
      success: true,
    };
  }

  async getStoreDeliveryFeeSetting(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    return this.store.getOrCreateStoreDeliveryFeeSetting(storeId);
  }

  async upsertStoreDeliveryFeeSetting(
    storeId: string,
    tenantId: string,
    dto: UpdateStoreDeliveryFeeSettingDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const existing = await this.store.getOrCreateStoreDeliveryFeeSetting(storeId);

    return this.store.upsertStoreDeliveryFeeSetting(storeId, {
      baseFee: dto.baseFee ?? existing.baseFee,
      freeDeliveryThreshold:
        dto.freeDeliveryThreshold === undefined
          ? existing.freeDeliveryThreshold
          : dto.freeDeliveryThreshold,
      surgeFeeEnabled: dto.surgeFeeEnabled ?? existing.surgeFeeEnabled,
      smallOrderFee: dto.smallOrderFee ?? existing.smallOrderFee,
    });
  }

  async getStoreReservationSetting(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    return this.store.getOrCreateStoreReservationSetting(storeId);
  }

  async upsertStoreReservationSetting(
    storeId: string,
    tenantId: string,
    dto: UpdateStoreReservationSettingDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const existing = await this.store.getOrCreateStoreReservationSetting(storeId);

    return this.store.upsertStoreReservationSetting(storeId, {
      enabled: dto.enabled ?? existing.enabled,
      requiresApproval: dto.requiresApproval ?? existing.requiresApproval,
      maxPartySize:
        dto.maxPartySize === undefined ? existing.maxPartySize : dto.maxPartySize,
      defaultSlotMinutes: dto.defaultSlotMinutes ?? existing.defaultSlotMinutes,
      leadTimeMinutes: dto.leadTimeMinutes ?? existing.leadTimeMinutes,
      notes: dto.notes === undefined ? existing.notes : dto.notes.trim() || null,
    });
  }

  async getStoreReceiptSetting(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    return this.store.getOrCreateStoreReceiptSetting(storeId);
  }

  async upsertStoreReceiptSetting(
    storeId: string,
    tenantId: string,
    dto: UpdateStoreReceiptSettingDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const existing = await this.store.getOrCreateStoreReceiptSetting(storeId);

    return this.store.upsertStoreReceiptSetting(storeId, {
      headerText: dto.headerText === undefined ? existing.headerText : dto.headerText.trim() || null,
      footerText: dto.footerText === undefined ? existing.footerText : dto.footerText.trim() || null,
      showTaxBreakdown: dto.showTaxBreakdown ?? existing.showTaxBreakdown,
      showQrCode: dto.showQrCode ?? existing.showQrCode,
      layoutConfigJson: dto.layoutConfigJson ?? existing.layoutConfigJson,
    });
  }

  async getStoreContentBundle(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    const [contentSettings, legalDocuments, profileNotes, sliders] = await Promise.all([
      this.store.getOrCreateStoreContentSetting(storeId),
      this.store.listLegalDocuments(storeId),
      this.store.listProfileNotes(storeId),
      this.store.listSliders(storeId),
    ]);

    return {
      contentSettings,
      legalDocuments,
      profileNotes,
      sliders,
    };
  }

  async upsertStoreLegalDocument(
    storeId: string,
    tenantId: string,
    documentType: StoreLegalDocument['documentType'],
    dto: UpdateStoreLegalDocumentDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const trimmedTranslations = dto.translations
      .map((entry) => ({
        locale: entry.locale.trim(),
        title: entry.title.trim(),
        body: entry.body.trim(),
      }))
      .filter((entry) => entry.locale && entry.title && entry.body);

    if (trimmedTranslations.length === 0) {
      throw new BadRequestException('At least one valid legal document translation is required.');
    }

    return this.store.upsertLegalDocument(storeId, documentType, {
      versionLabel: dto.versionLabel?.trim() || 'v1',
      isPublished: dto.isPublished ?? true,
      effectiveFrom: dto.effectiveFrom ?? null,
      translations: trimmedTranslations,
    });
  }

  async upsertStoreProfileNote(
    storeId: string,
    tenantId: string,
    noteType: StoreProfileNote['noteType'],
    dto: UpdateStoreProfileNoteDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const trimmedTranslations = dto.translations
      .map((entry) => ({
        locale: entry.locale.trim(),
        title: entry.title?.trim() || null,
        body: entry.body.trim(),
      }))
      .filter((entry) => entry.locale && entry.body);

    if (trimmedTranslations.length === 0) {
      throw new BadRequestException('At least one valid profile note translation is required.');
    }

    return this.store.upsertProfileNote(storeId, noteType, {
      isPublished: dto.isPublished ?? true,
      translations: trimmedTranslations,
    });
  }

  async createStoreSlider(
    storeId: string,
    tenantId: string,
    dto: CreateStoreSliderDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    return this.store.createSlider(storeId, {
      name: dto.name.trim(),
      sliderType: dto.sliderType,
      isActive: dto.isActive ?? true,
    });
  }

  async updateStoreSlider(
    storeId: string,
    sliderId: string,
    tenantId: string,
    dto: UpdateStoreSliderDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const updated = await this.store.updateSlider(storeId, sliderId, {
      name: dto.name?.trim(),
      sliderType: dto.sliderType,
      isActive: dto.isActive,
    });
    if (!updated) {
      throw new NotFoundException('Slider could not be found for this store.');
    }
    return updated;
  }

  async deleteStoreSlider(storeId: string, sliderId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    const deleted = await this.store.deleteSlider(storeId, sliderId);
    if (!deleted) {
      throw new NotFoundException('Slider could not be found for this store.');
    }
    return { success: true };
  }

  async createStoreSliderItem(
    storeId: string,
    sliderId: string,
    tenantId: string,
    dto: CreateStoreSliderItemDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    return this.store.createSliderItem(sliderId, {
      imageAssetId: dto.imageAssetId ?? null,
      title: dto.title?.trim() || null,
      caption: dto.caption?.trim() || null,
      targetUrl: dto.targetUrl?.trim() || null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
  }

  async updateStoreSliderItem(
    storeId: string,
    sliderId: string,
    itemId: string,
    tenantId: string,
    dto: UpdateStoreSliderItemDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const updated = await this.store.updateSliderItem(sliderId, itemId, {
      imageAssetId: dto.imageAssetId,
      title: dto.title === undefined ? undefined : dto.title === null ? null : dto.title.trim() || null,
      caption: dto.caption === undefined ? undefined : dto.caption === null ? null : dto.caption.trim() || null,
      targetUrl: dto.targetUrl === undefined ? undefined : dto.targetUrl === null ? null : dto.targetUrl.trim() || null,
      sortOrder: dto.sortOrder,
      isActive: dto.isActive,
    });
    if (!updated) {
      throw new NotFoundException('Slider item could not be found for this store.');
    }
    return updated;
  }

  async deleteStoreSliderItem(
    storeId: string,
    sliderId: string,
    itemId: string,
    tenantId: string,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const deleted = await this.store.deleteSliderItem(sliderId, itemId);
    if (!deleted) {
      throw new NotFoundException('Slider item could not be found for this store.');
    }
    return { success: true };
  }

  // ── Commerce: payment methods (FK assignment) ──────────────────────────────
  async listPaymentMethods(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    return {
      paymentMethods: await this.store.listPaymentMethods(storeId),
    };
  }

  async replacePaymentMethods(
    storeId: string,
    tenantId: string,
    dto: ReplaceStorePaymentMethodsDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);

    // Accept either a paymentMethodId (UUID) or a canonical paymentMethod code.
    // The tenant dashboard sends codes; resolve them to ids here so the save
    // works without forcing the frontend to know catalog UUIDs.
    const codeToId = await this.store.getCanonicalPaymentMethodIdMap();

    const seen = new Set<string>();
    const normalized: Array<{
      paymentMethodId: string;
      customLabel: string | null;
      isActive: boolean;
      sortOrder: number;
    }> = [];

    for (const [index, entry] of dto.paymentMethods.entries()) {
      let paymentMethodId = entry.paymentMethodId;
      if (!paymentMethodId && entry.paymentMethod) {
        paymentMethodId = codeToId[entry.paymentMethod];
        if (!paymentMethodId) {
          throw new BadRequestException({
            code: 'payment_method_unavailable',
            message: 'Seçilen ödeme yöntemi geçersiz veya kullanılamıyor.',
          });
        }
      }
      if (!paymentMethodId) {
        throw new BadRequestException({
          code: 'invalid_payment_method',
          message: 'Her ödeme yöntemi için paymentMethodId veya paymentMethod kodu gerekli.',
        });
      }
      if (seen.has(paymentMethodId)) {
        throw new BadRequestException(
          `Duplicate payment method "${entry.paymentMethod ?? paymentMethodId}" in payload.`,
        );
      }
      seen.add(paymentMethodId);
      await this.systemTaxonomyService.getPaymentMethodByIdOrThrow(paymentMethodId);

      normalized.push({
        paymentMethodId,
        customLabel: entry.customLabel?.trim() || null,
        isActive: entry.isActive ?? true,
        sortOrder: entry.sortOrder ?? index,
      });
    }

    if (normalized.filter((entry) => entry.isActive).length === 0) {
      throw new BadRequestException({
        code: 'at_least_one_payment_method_required',
        message: 'En az bir ödeme yöntemi aktif olmalıdır.',
      });
    }

    return {
      paymentMethods: await this.store.replacePaymentMethods(storeId, normalized),
    };
  }

  // ── Commerce: service types (FK assignment) ────────────────────────────────
  async listServiceTypes(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    return {
      serviceTypes: await this.store.listServiceTypes(storeId),
    };
  }

  async replaceServiceTypes(
    storeId: string,
    tenantId: string,
    dto: ReplaceStoreServiceTypesDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);

    const seen = new Set<string>();
    for (const entry of dto.serviceTypes) {
      if (seen.has(entry.serviceTypeId)) {
        throw new BadRequestException(
          `Duplicate serviceTypeId "${entry.serviceTypeId}" in payload.`,
        );
      }
      seen.add(entry.serviceTypeId);
      await this.systemTaxonomyService.getServiceTypeByIdOrThrow(entry.serviceTypeId);
    }

    const normalized = dto.serviceTypes.map((entry, index) => ({
      serviceTypeId: entry.serviceTypeId,
      customLabel: entry.customLabel?.trim() || null,
      isActive: entry.isActive ?? true,
      sortOrder: entry.sortOrder ?? index,
    }));

    if (normalized.filter((entry) => entry.isActive).length === 0) {
      throw new BadRequestException(
        'At least one active service type is required for the store.',
      );
    }

    return {
      serviceTypes: await this.store.replaceServiceTypes(storeId, normalized),
    };
  }

  // ── Commerce: ordering policy ──────────────────────────────────────────────
  async getOrderingPolicy(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    return this.store.getOrCreateOrderingPolicy(storeId);
  }

  async upsertOrderingPolicy(
    storeId: string,
    tenantId: string,
    dto: UpdateOrderingPolicyDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);
    const existing = await this.store.getOrCreateOrderingPolicy(storeId);

    const acceptsDelivery = dto.acceptsDelivery ?? existing.acceptsDelivery;
    const acceptsPickup = dto.acceptsPickup ?? existing.acceptsPickup;

    if (!acceptsDelivery && !acceptsPickup) {
      throw new BadRequestException(
        'At least one of delivery or pickup must be enabled for the store.',
      );
    }

    const currencyCode = dto.currencyCode?.trim() || existing.currencyCode;
    await this.assertCurrencyMatchesPlatform(currencyCode);

    const policy = await this.store.upsertOrderingPolicy(storeId, {
      minOrderAmount: dto.minOrderAmount ?? existing.minOrderAmount,
      acceptsDelivery,
      acceptsPickup,
      currencyCode,
    });

    // Keep the canonical StoreServiceType assignments in sync with the policy
    // booleans so the cart (which reads StoreServiceType) reflects the tenant's
    // delivery/pickup choices immediately.
    await this.store.syncServiceTypesFromOrderingPolicy(storeId, {
      acceptsDelivery,
      acceptsPickup,
    });

    return policy;
  }

  // ── Commerce: delivery fee tiers ───────────────────────────────────────────
  async listDeliveryFeeTiers(storeId: string, tenantId: string) {
    await this.ensureOwnedStore(storeId, tenantId);
    return {
      deliveryFeeTiers: await this.store.listDeliveryFeeTiers(storeId),
    };
  }

  async replaceDeliveryFeeTiers(
    storeId: string,
    tenantId: string,
    dto: ReplaceDeliveryFeeTiersDto,
  ) {
    await this.ensureOwnedStore(storeId, tenantId);

    const sorted = [...dto.tiers].sort(
      (left, right) => left.minDistanceKm - right.minDistanceKm,
    );

    for (let index = 0; index < sorted.length; index += 1) {
      const tier = sorted[index];
      if (tier.minDistanceKm >= tier.maxDistanceKm) {
        throw new BadRequestException(
          'Each delivery fee tier must have minDistanceKm < maxDistanceKm.',
        );
      }
      if (index > 0 && tier.minDistanceKm < sorted[index - 1].maxDistanceKm) {
        throw new BadRequestException(
          'Delivery fee tiers cannot overlap on distance ranges.',
        );
      }
    }

    const normalized = sorted.map((tier, index) => ({
      minDistanceKm: tier.minDistanceKm,
      maxDistanceKm: tier.maxDistanceKm,
      feeAmount: tier.feeAmount,
      sortOrder: tier.sortOrder ?? index,
      isActive: tier.isActive ?? true,
    }));

    return {
      deliveryFeeTiers: await this.store.replaceDeliveryFeeTiers(storeId, normalized),
    };
  }

  // ── Commerce: aggregate bundle (tenant + public reuse) ────────────────────
  async getCommerceSettingsBundle(storeId: string) {
    const [orderingPolicy, deliveryFeeTiers, paymentMethods, deliveryFeeSetting] =
      await Promise.all([
        this.store.getOrCreateOrderingPolicy(storeId),
        this.store.listDeliveryFeeTiers(storeId),
        this.store.listPaymentMethods(storeId),
        this.store.getOrCreateStoreDeliveryFeeSetting(storeId),
      ]);

    return {
      orderingPolicy,
      deliveryFeeTiers,
      paymentMethods,
      deliveryFeeSetting,
    };
  }

  async getPublicCommerceSettings(storeId: string) {
    const [orderingPolicy, deliveryFeeTiers, paymentMethods, deliveryFeeSetting] =
      await Promise.all([
        this.store.getOrCreateOrderingPolicy(storeId),
        this.store.listDeliveryFeeTiers(storeId),
        this.store.listActivePaymentMethods(storeId),
        this.store.getOrCreateStoreDeliveryFeeSetting(storeId),
      ]);

    return {
      orderingPolicy,
      deliveryFeeTiers: deliveryFeeTiers.filter((tier) => tier.isActive),
      paymentMethods,
      deliveryFeeSetting,
    };
  }

  private async ensureOwnedStore(storeId: string, tenantId: string) {
    const store = await this.storesService.findOwnedStore(storeId, tenantId);
    if (!store) {
      throw new NotFoundException('Store could not be found for this tenant.');
    }

    return store;
  }

  private normalizeDiscountRuleInput(
    input: Pick<
      StoreDiscountRule,
      'name' | 'ruleType' | 'valueType' | 'valueAmount' | 'isActive' | 'startsAt' | 'endsAt'
    >,
  ): Pick<
    StoreDiscountRule,
    'name' | 'ruleType' | 'valueType' | 'valueAmount' | 'isActive' | 'startsAt' | 'endsAt'
  > {
    const normalized = {
      name: input.name.trim(),
      ruleType: input.ruleType,
      valueType: input.valueType,
      valueAmount: input.valueAmount,
      isActive: input.isActive,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    };

    if (normalized.valueType === 'percentage' && normalized.valueAmount > 100) {
      throw new BadRequestException('Percentage discount rules cannot exceed 100.');
    }

    if (
      normalized.startsAt &&
      normalized.endsAt &&
      new Date(normalized.startsAt).getTime() > new Date(normalized.endsAt).getTime()
    ) {
      throw new BadRequestException('Discount rule start date must be before end date.');
    }

    return normalized;
  }
}
