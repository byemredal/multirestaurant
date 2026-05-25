import { Injectable } from '@nestjs/common';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { MenuService } from '../menu/menu.service';
import { TenantOnboardingService } from '../tenant-onboarding/tenant-onboarding.service';
import { TenantAccountsStore } from '../tenants/tenants.store';
import { StoreSettingsService } from '../store-settings/store-settings.service';
import { StoresService } from '../stores/stores.service';
import { SharedFileStorageService } from '../shared-file-storage/shared-file-storage.service';
import { CreateStoreSliderDto } from '../store-settings/dto/create-store-slider.dto';
import { CreateStoreSliderItemDto } from '../store-settings/dto/create-store-slider-item.dto';
import { UpdateStoreDeliveryFeeSettingDto } from '../store-settings/dto/update-store-delivery-fee-setting.dto';
import { UpdateStoreLegalDocumentDto } from '../store-settings/dto/update-store-legal-document.dto';
import { UpdateStoreProfileNoteDto } from '../store-settings/dto/update-store-profile-note.dto';
import { UpdateStoreReceiptSettingDto } from '../store-settings/dto/update-store-receipt-setting.dto';
import { UpdateStoreReservationSettingDto } from '../store-settings/dto/update-store-reservation-setting.dto';
import { UpdateStoreSliderDto } from '../store-settings/dto/update-store-slider.dto';
import { UpdateStoreSliderItemDto } from '../store-settings/dto/update-store-slider-item.dto';
import { UpdateStoreTaxSettingDto } from '../store-settings/dto/update-store-tax-setting.dto';
import { ListTenantApplicationsDto } from './dto/list-tenant-applications.dto';
import { ReviewTenantApplicationDto } from './dto/review-application.dto';
import { ReviewTenantDocumentDto } from './dto/review-document.dto';

@Injectable()
export class AdminTenantReviewsService {
  constructor(
    private readonly onboardingService: TenantOnboardingService,
    private readonly auditLogService: AdminAuditLogService,
    private readonly tenantAccountsStore: TenantAccountsStore,
    private readonly storesService: StoresService,
    private readonly menuService: MenuService,
    private readonly storeSettingsService: StoreSettingsService,
    private readonly fileStorageService: SharedFileStorageService,
  ) {}

  listApplications(query: ListTenantApplicationsDto) {
    return this.onboardingService.listApplicationsForAdmin(query);
  }

  listTenants(query: ListTenantApplicationsDto) {
    return this.onboardingService.listTenantsForAdmin(query);
  }

  async getTenantBusinessOverview(tenantId: string) {
    const [tenantView, application, stores] = await Promise.all([
      this.tenantAccountsStore.findById(tenantId),
      this.onboardingService.findApplicationForTenantAdmin(tenantId),
      this.storesService.listForTenant(tenantId),
    ]);

    // Flatten the {account, business} view into the legacy admin response
    // shape so the admin frontend does not need to change.
    const tenantAccount = tenantView
      ? {
          id: tenantView.account.id,
          email: tenantView.account.email,
          firstName: tenantView.account.firstName,
          lastName: tenantView.account.lastName,
          phoneNumber: tenantView.account.phoneNumber,
          companyName: tenantView.business.companyName,
          companyAddress: tenantView.business.companyAddress,
          tenantType: tenantView.business.tenantType,
          deliveryModel: tenantView.business.deliveryModel,
          verificationStatus: tenantView.business.verificationStatus,
          onboardingStatus: tenantView.business.onboardingStatus,
          isActive: tenantView.account.isActive,
          isVerified: tenantView.account.isVerified,
          lastLoginAt: tenantView.account.lastLoginAt,
          createdAt: tenantView.account.createdAt,
          updatedAt: tenantView.account.updatedAt,
        }
      : null;

    const storeOverviews = await Promise.all(
      stores.map(async (store) => {
        const [
          generalSettings,
          taxSettings,
          discountRulesResponse,
          deliveryFeeSettings,
          reservationSettings,
          receiptSettings,
          contentBundle,
          menuCategories,
          menuItems,
        ] = await Promise.all([
          this.storeSettingsService.getStoreSetting(store.id, tenantId),
          this.storeSettingsService.getStoreTaxSetting(store.id, tenantId),
          this.storeSettingsService.listDiscountRules(store.id, tenantId),
          this.storeSettingsService.getStoreDeliveryFeeSetting(store.id, tenantId),
          this.storeSettingsService.getStoreReservationSetting(store.id, tenantId),
          this.storeSettingsService.getStoreReceiptSetting(store.id, tenantId),
          this.storeSettingsService.getStoreContentBundle(store.id, tenantId),
          this.menuService.listCategories(store.id, tenantId),
          this.menuService.listItems(store.id, tenantId),
        ]);

        const sliders = await Promise.all(
          contentBundle.sliders.map(async (slider) => ({
            ...slider,
            items: await Promise.all(
              slider.items.map(async (item) => {
                const imageAsset = item.imageAssetId
                  ? await this.fileStorageService.getAsset(item.imageAssetId)
                  : null;

                return {
                  ...item,
                  imageAsset,
                  imageUrl: imageAsset?.publicUrl ?? null,
                };
              }),
            ),
          })),
        );

        return {
          store,
          generalSettings,
          taxSettings,
          discountRules: discountRulesResponse.discountRules,
          deliveryFeeSettings,
          reservationSettings,
          receiptSettings,
          contentSettings: contentBundle.contentSettings,
          legalDocuments: contentBundle.legalDocuments,
          profileNotes: contentBundle.profileNotes,
          sliders,
          menuCategories,
          menuItems,
        };
      }),
    );

    return {
      tenantAccount,
      application,
      stores: storeOverviews,
      unavailableSections: {
        termsAndConditions: false,
        profileNotes: false,
        sliderMedia: false,
        staff: true,
        kitchen: true,
        devices: true,
      },
    };
  }

  async updateTenantStoreTaxSettings(
    tenantId: string,
    storeId: string,
    adminId: string,
    dto: UpdateStoreTaxSettingDto,
  ) {
    const updated = await this.storeSettingsService.upsertStoreTaxSetting(
      storeId,
      tenantId,
      dto,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_tax_settings_updated',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { ...dto },
    });

    return updated;
  }

  async updateTenantStoreDeliveryFeeSettings(
    tenantId: string,
    storeId: string,
    adminId: string,
    dto: UpdateStoreDeliveryFeeSettingDto,
  ) {
    const updated = await this.storeSettingsService.upsertStoreDeliveryFeeSetting(
      storeId,
      tenantId,
      dto,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_delivery_fee_settings_updated',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { ...dto },
    });

    return updated;
  }

  async updateTenantStoreReservationSettings(
    tenantId: string,
    storeId: string,
    adminId: string,
    dto: UpdateStoreReservationSettingDto,
  ) {
    const updated = await this.storeSettingsService.upsertStoreReservationSetting(
      storeId,
      tenantId,
      dto,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_reservation_settings_updated',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { ...dto },
    });

    return updated;
  }

  async updateTenantStoreReceiptSettings(
    tenantId: string,
    storeId: string,
    adminId: string,
    dto: UpdateStoreReceiptSettingDto,
  ) {
    const updated = await this.storeSettingsService.upsertStoreReceiptSetting(
      storeId,
      tenantId,
      dto,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_receipt_settings_updated',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { ...dto },
    });

    return updated;
  }

  async updateTenantStoreLegalDocument(
    tenantId: string,
    storeId: string,
    documentType: 'terms_and_conditions' | 'privacy_notice' | 'distance_sales',
    adminId: string,
    dto: UpdateStoreLegalDocumentDto,
  ) {
    const updated = await this.storeSettingsService.upsertStoreLegalDocument(
      storeId,
      tenantId,
      documentType,
      dto,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_legal_document_updated',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { documentType, versionLabel: dto.versionLabel ?? null },
    });

    return updated;
  }

  async updateTenantStoreProfileNote(
    tenantId: string,
    storeId: string,
    noteType: 'profile' | 'story' | 'operational',
    adminId: string,
    dto: UpdateStoreProfileNoteDto,
  ) {
    const updated = await this.storeSettingsService.upsertStoreProfileNote(
      storeId,
      tenantId,
      noteType,
      dto,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_profile_note_updated',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { noteType },
    });

    return updated;
  }

  async createTenantStoreSlider(
    tenantId: string,
    storeId: string,
    adminId: string,
    dto: CreateStoreSliderDto,
  ) {
    const created = await this.storeSettingsService.createStoreSlider(
      storeId,
      tenantId,
      dto,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_slider_created',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { sliderType: dto.sliderType, name: dto.name },
    });

    return created;
  }

  async updateTenantStoreSlider(
    tenantId: string,
    storeId: string,
    sliderId: string,
    adminId: string,
    dto: UpdateStoreSliderDto,
  ) {
    const updated = await this.storeSettingsService.updateStoreSlider(
      storeId,
      sliderId,
      tenantId,
      dto,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_slider_updated',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { sliderId, ...dto },
    });

    return updated;
  }

  async deleteTenantStoreSlider(
    tenantId: string,
    storeId: string,
    sliderId: string,
    adminId: string,
  ) {
    const result = await this.storeSettingsService.deleteStoreSlider(
      storeId,
      sliderId,
      tenantId,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_slider_deleted',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { sliderId },
    });

    return result;
  }

  async createTenantStoreSliderItem(
    tenantId: string,
    storeId: string,
    sliderId: string,
    adminId: string,
    dto: CreateStoreSliderItemDto,
  ) {
    const created = await this.storeSettingsService.createStoreSliderItem(
      storeId,
      sliderId,
      tenantId,
      dto,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_slider_item_created',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { sliderId, itemId: created.id },
    });

    return created;
  }

  async updateTenantStoreSliderItem(
    tenantId: string,
    storeId: string,
    sliderId: string,
    itemId: string,
    adminId: string,
    dto: UpdateStoreSliderItemDto,
  ) {
    const updated = await this.storeSettingsService.updateStoreSliderItem(
      storeId,
      sliderId,
      itemId,
      tenantId,
      dto,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_slider_item_updated',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { sliderId, itemId, ...dto },
    });

    return updated;
  }

  async deleteTenantStoreSliderItem(
    tenantId: string,
    storeId: string,
    sliderId: string,
    itemId: string,
    adminId: string,
  ) {
    const result = await this.storeSettingsService.deleteStoreSliderItem(
      storeId,
      sliderId,
      itemId,
      tenantId,
    );

    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_store_slider_item_deleted',
      entityType: 'store',
      entityId: storeId,
      tenantAccountId: tenantId,
      metadata: { sliderId, itemId },
    });

    return result;
  }

  getApplication(applicationId: string) {
    return this.onboardingService.getApplicationForAdmin(applicationId);
  }

  listDocuments() {
    return this.onboardingService.listDocumentsForAdmin();
  }

  getDocument(documentId: string) {
    return this.onboardingService.getDocumentForAdmin(documentId);
  }

  getApplicationTimeline(applicationId: string) {
    return this.auditLogService.listApplicationTimeline(applicationId);
  }

  requestRevision(applicationId: string, adminId: string, dto: ReviewTenantApplicationDto) {
    return this.onboardingService.requestRevision(applicationId, adminId, dto);
  }

  approveApplication(applicationId: string, adminId: string, dto: ReviewTenantApplicationDto) {
    return this.onboardingService.approveApplication(applicationId, adminId, dto);
  }

  rejectApplication(applicationId: string, adminId: string, dto: ReviewTenantApplicationDto) {
    return this.onboardingService.rejectApplication(applicationId, adminId, dto);
  }

  approveDocument(documentId: string, adminId: string, dto: ReviewTenantDocumentDto) {
    return this.onboardingService.reviewDocument(documentId, adminId, 'approve', dto.note);
  }

  rejectDocument(documentId: string, adminId: string, dto: ReviewTenantDocumentDto) {
    return this.onboardingService.reviewDocument(documentId, adminId, 'reject', dto.note);
  }

  requestDocumentRevision(documentId: string, adminId: string, dto: ReviewTenantDocumentDto) {
    return this.onboardingService.reviewDocument(documentId, adminId, 'request_revision', dto.note);
  }

  activateTenant(tenantId: string, adminId: string) {
    return this.onboardingService.activateTenant(tenantId, adminId);
  }

  suspendTenant(tenantId: string, adminId: string, reason?: string) {
    return this.onboardingService.suspendTenant(tenantId, adminId, reason);
  }

  reopenReview(tenantId: string, adminId: string) {
    return this.onboardingService.reopenReview(tenantId, adminId);
  }
}
