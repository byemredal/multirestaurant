import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { InstallationProfileService } from '../setup/installation-profile.service';
import { SetupStore } from '../setup/setup.store';
import { TenantAccountsStore } from '../tenants/tenants.store';
import { TenantPasswordSetupService } from '../tenant-password-setup/tenant-password-setup.service';
import { SharedFileStorageService } from '../shared-file-storage/shared-file-storage.service';
import { EmailService } from '../notification/email.service';
import * as Dto from './dto';
import {
  tenantOnboardingStepKeys,
  TenantDocument,
  TenantOnboardingApplicationStatus,
  TenantOnboardingStepKey,
} from './entities/tenant-onboarding.entity';
import { FileAsset } from '../shared-file-storage/entities/file-asset.entity';
import { TenantOnboardingStore } from './tenant-onboarding.store';
import { getTenantOnboardingComplianceCatalog } from './tenant-onboarding-compliance-catalog';
import { getTenantOnboardingPlanCatalog } from './tenant-onboarding-plan-catalog';
import { CryptoUtil } from '../../common/utility/crypto-util';
import {
  ONBOARDING_STATUS_TRANSITIONS,
  assertOnboardingTransition,
} from './tenant-onboarding.state';
import {
  buildStateToken,
  currentStepFromSteps,
  nextStepAfter,
  validateStateTokenPayload,
  workflowSlugFromBackendStep,
} from './tenant-onboarding.tokens';

// Re-export the status-transition map so existing importers (and any
// future onboarding-adjacent module) keep working without changing their
// import path. The definition lives in tenant-onboarding.state.ts.
export { ONBOARDING_STATUS_TRANSITIONS };

type EditableStepKey = Exclude<TenantOnboardingStepKey, 'final_review'>;
type TenantFacingStepStatus = 'not_started' | 'in_progress' | 'completed' | 'needs_revision';
type UploadedTenantFile = {
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
};
type BufferedTenantFile = Omit<UploadedTenantFile, 'path'> & { buffer: Buffer };

const ALLOWED_DOCUMENT_FILE_TYPES: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

type OnboardingSessionStepKey =
  | 'phone-verification'
  | 'otp'
  | 'welcome'
  | 'location'
  | 'address'
  | 'business-details'
  | 'authorized-person'
  | 'bank-details'
  | 'billing-address'
  | 'plan-selection'
  | 'operations'
  | 'verification'
  | 'review'
  | 'submitted';

const ONBOARDING_SESSION_STEP_ORDER: OnboardingSessionStepKey[] = [
  'phone-verification',
  'otp',
  'welcome',
  'location',
  'address',
  'business-details',
  'authorized-person',
  'bank-details',
  'billing-address',
  'plan-selection',
  'operations',
  'verification',
  'review',
  'submitted',
];

const ONBOARDING_SESSION_STEP_ALIASES: Record<string, OnboardingSessionStepKey> = {
  'phone-verification': 'phone-verification',
  otp: 'otp',
  welcome: 'welcome',
  location: 'location',
  address: 'address',
  'business-details': 'business-details',
  'authorized-person': 'authorized-person',
  'bank-details': 'bank-details',
  'billing-address': 'billing-address',
  'plan-selection': 'plan-selection',
  operations: 'operations',
  verification: 'verification',
  review: 'review',
  submitted: 'submitted',
  waiting: 'submitted',
  'business-info': 'location',
  'legal-tax-info': 'business-details',
  'owner-contact-info': 'authorized-person',
  'operations-info': 'operations',
  documents: 'verification',
  'final-review': 'review',
};

const TERMINAL_WAITING_STATUSES = new Set<TenantOnboardingApplicationStatus>([
  'submitted',
  'under_review',
  'rejected',
  'suspended',
]);

// Statuses where the application has reached a closed lifecycle and the
// `tokenSalt` is intentionally wiped (see crypto-util.isTerminalStatus).
// Read-only resolvers must still let the tenant view the closed screen
// instead of leaking a raw 403 after admin approval/activation.
const TERMINAL_CLOSED_STATUSES = new Set<TenantOnboardingApplicationStatus>([
  'approved',
  'active',
  'rejected',
  'suspended',
]);

@Injectable()
export class TenantOnboardingService {
  private readonly logger = new Logger(TenantOnboardingService.name);

  constructor(
    private readonly store: TenantOnboardingStore,
    private readonly tenantAccountsStore: TenantAccountsStore,
    private readonly fileStorageService: SharedFileStorageService,
    private readonly auditLogService: AdminAuditLogService,
    private readonly emailService: EmailService,
    private readonly installationProfileService: InstallationProfileService,
    private readonly setupStore: SetupStore,
    private readonly passwordSetupService: TenantPasswordSetupService,
  ) { }

  /**
   * Resolve the platform-facing display name set during one-time setup. We
   * read it on the email send path so subjects/templates surface the operator's
   * chosen brand instead of a stale "Lieferzonen" placeholder.
   */
  private async resolvePlatformDisplayName(): Promise<string> {
    const setup = await this.setupStore.getPlatformSetup();
    return setup?.platformName?.trim() || 'Platform';
  }

  /**
   * Resolve the country/locale/currency triple that drives onboarding
   * compliance + plan defaults. Reads the active InstallationProfile so a
   * TR installation runs through TR compliance instead of falling back to
   * de-CH. The partner's `business_info.country` is informational — the
   * authoritative installation country comes from the install profile.
   *
   * Falls back to `business_info.country` (or hardcoded CH/de-CH/CHF) only
   * when the install profile is missing, which should never happen on a
   * READY system but is kept as a defensive belt for legacy dev DBs.
   */
  private async resolveActiveCountryPack(
    workspace?: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ): Promise<{ country: string; language: string; currency: string }> {
    const profile = await this.installationProfileService.findActiveCountryPolicy();
    if (profile) {
      return {
        country: profile.countryCode,
        language: profile.locale,
        currency: profile.currencyCode,
      };
    }

    // Defensive fallback for legacy pre-MR-ARCH-03 dev DBs — production
    // installs always have the profile (setup writes it transactionally).
    const businessInfo = workspace?.steps.find((step) => step.stepKey === 'business_info')
      ?.data as { country?: string | null } | null | undefined;
    const candidate = businessInfo?.country?.trim().toUpperCase();
    const country = candidate && /^[A-Z]{2}$/.test(candidate) ? candidate : 'CH';
    return {
      country,
      language: 'de-CH',
      currency: 'CHF',
    };
  }

  async start(
    dto: Dto.StartTenantOnboardingDto,
    context?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.tenantAccountsStore.findByEmail(email);

    // Backend enforces the phone country prefix against the active CountryPack
    // so a manipulated client (the locked-prefix UI is just visual) can't
    // sneak a foreign country code through the start contract.
    const enforcedPhoneNumber = await this.enforceActiveCountryPhoneNumber(dto.phoneNumber);

    if (existing) {
      const resumable =
        existing.account.passwordHash === '' &&
        ['draft', 'revision_required'].includes(existing.business.onboardingStatus);

      if (!resumable) {
        throw new ConflictException('Tenant account already exists for this email.');
      }

      const workspace = await this.getWorkspace(existing.account.id);
      const currentStepKey = currentStepFromSteps(
        workspace.steps as Array<{ stepKey: TenantOnboardingStepKey; status: string }>,
      );

      return {
        stateToken: workspace.stateToken,
        status: workspace.application.status,
        currentStepKey,
        nextStepKey: nextStepAfter(currentStepKey),
      };
    }

    const tenant = await this.tenantAccountsStore.create({
      email,
      passwordHash: '',
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: enforcedPhoneNumber,
      companyName: dto.companyName,
      companyAddress: dto.companyAddress,
      tenantType: dto.tenantType,
      deliveryModel: dto.deliveryModel,
      verificationStatus: 'pending',
      onboardingStatus: 'draft',
      isActive: true,
      isVerified: false,
      lastLoginAt: null,
    });

    const application = await this.getOrCreateApplication(tenant.account.id);
    await this.seedApplicationFromStart(application.id, dto);
    await this.persistInitialApplicationLocationSelection(application.id, dto);
    await this.persistInitialApplicationConsents(application.id, dto, context);

    const workspace = await this.getWorkspace(tenant.account.id);
    const currentStepKey = currentStepFromSteps(
      workspace.steps as Array<{ stepKey: TenantOnboardingStepKey; status: string }>,
    );

    return {
      stateToken: workspace.stateToken,
      status: workspace.application.status,
      currentStepKey,
      nextStepKey: nextStepAfter(currentStepKey),
    };
  }

  /**
   * Server-side phone normalization. The partner application form ships a
   * locked dial-code badge in the UI, but the badge is presentational only —
   * any HTTP client could submit a different prefix. Refuse and rewrite here:
   *   * strip non-digits and the country prefix (`+41`, `0041`, `0`, etc.)
   *   * re-attach the active CountryPack's `e164Country`
   *   * reject when the digit count is implausible
   *
   * Setup not yet run (no active profile) → trust whatever the caller sent.
   * Production setups always have a profile, so this is a defensive belt.
   */
  private async enforceActiveCountryPhoneNumber(input: string): Promise<string> {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new BadRequestException('Telefon numarası gereklidir.');
    }

    const policy = await this.installationProfileService.findActiveCountryPolicy();
    if (!policy) {
      return trimmed;
    }

    const e164 = policy.pack.phone.e164Country;
    const expectedPrefixDigits = e164.replace(/[^\d]/g, '');
    if (!expectedPrefixDigits) {
      return trimmed;
    }

    // When the user TYPED an explicit country prefix ('+CC' or '00CC'), it
    // MUST match the active CountryPack. Silent re-attachment of the active
    // prefix (the previous behavior) hid mismatches behind a plausible-looking
    // number — see SMOKE-01 BUG-03. Reject loudly instead.
    const hasExplicitPrefix = /^(?:\+|00)\d/.test(trimmed);
    const allDigits = trimmed.replace(/[^\d]/g, '');

    if (hasExplicitPrefix) {
      const declaredDigits = trimmed.startsWith('+')
        ? allDigits
        : allDigits.replace(/^00/, '');
      if (!declaredDigits.startsWith(expectedPrefixDigits)) {
        throw new BadRequestException({
          message: `Telefon numarasının ülke kodu platformun aktif ülkesiyle eşleşmiyor (${e164} bekleniyor). Lütfen ulusal numaranızı ülke kodu olmadan girin.`,
          code: 'phone_country_mismatch',
        });
      }
    }

    let national = allDigits;
    if (national.startsWith('00' + expectedPrefixDigits)) {
      national = national.slice(2 + expectedPrefixDigits.length);
    } else if (national.startsWith(expectedPrefixDigits)) {
      national = national.slice(expectedPrefixDigits.length);
    }
    // Local "0" prefix (e.g. CH "079 …") is dropped: the e164 canonical form
    // has no leading zero after the country code.
    if (national.startsWith('0')) {
      national = national.replace(/^0+/, '');
    }

    if (national.length < 6 || national.length > 14) {
      throw new BadRequestException(
        'Telefon numarası geçerli görünmüyor. Lütfen ülke kodu olmadan ulusal telefon numaranızı girin.',
      );
    }

    return `+${expectedPrefixDigits}${national}`;
  }

  /**
   * If the partner application form submitted a normalized address from the
   * autocomplete provider, mirror it into the TenantOnboardingLocationSelection
   * row up front. This lets the later location/address step prefill the
   * picker AND gives audit a single canonical row of "what was first
   * captured" with provider attribution.
   */
  private async persistInitialApplicationLocationSelection(
    applicationId: string,
    dto: Dto.StartTenantOnboardingDto,
  ): Promise<void> {
    if (!dto.addressMeta) {
      return;
    }
    const meta = dto.addressMeta;
    const policy = await this.installationProfileService.findActiveCountryPolicy();
    const country =
      meta.countryCode?.trim().toUpperCase() ||
      policy?.countryCode ||
      'CH';
    await this.store.upsertLocationSelection(applicationId, {
      locationLabel: meta.label.trim(),
      rawInput: dto.companyAddress.trim(),
      country,
      city: meta.city?.trim() || null,
      postalCode: meta.postalCode?.trim() || null,
      street: meta.street?.trim() || null,
      latitude: meta.latitude ?? null,
      longitude: meta.longitude ?? null,
      provider: meta.provider,
      providerPlaceId: meta.providerPlaceId?.trim() || null,
    });
  }

  /**
   * Persist the partner application form's initial Terms + Privacy checkbox
   * acceptance into the TenantOnboardingConsentSnapshot table so a later
   * legal/audit review can prove WHAT was accepted, WHEN, and against WHICH
   * document version. Reuses the same table the final review consent step
   * writes to — the `consentKey` namespace keeps them distinguishable.
   */
  private async persistInitialApplicationConsents(
    applicationId: string,
    dto: Dto.StartTenantOnboardingDto,
    context?: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const pack = await this.resolveActiveCountryPack();
    const language = (dto.acceptedLocale?.trim() || pack.language || 'de-CH');
    const acceptedAt = new Date();

    // Pull legal-document versions from the active CountryPack so the
    // snapshot pins the exact version-string the user saw on this device.
    const profile = await this.installationProfileService.findActive();
    const legalDocs = profile?.pack.legalDocuments ?? [];
    const findVersion = (typeCode: string) =>
      legalDocs.find((doc) => doc.typeCode === typeCode)?.versionLabel ?? 'unversioned';

    // IP + user agent are captured for audit. We trim to the table's
    // expected TEXT bounds defensively — no max length in schema but a
    // pathological UA shouldn't be persisted untouched.
    const ipAddress = context?.ipAddress?.trim().slice(0, 64) || null;
    const userAgent = context?.userAgent?.trim().slice(0, 512) || null;

    await Promise.all([
      this.store.upsertConsentSnapshot(applicationId, {
        consentKey: 'application_terms_of_service',
        consentLabelSnapshot:
          'Devam ederek Kullanım Şartlarını kabul ettim (partner başvuru formu).',
        documentCode: 'terms_of_service',
        documentVersion: findVersion('terms_of_service'),
        language,
        accepted: dto.acceptedTerms === true,
        acceptedAt,
        ipAddress,
        userAgent,
      }),
      this.store.upsertConsentSnapshot(applicationId, {
        consentKey: 'application_privacy_policy',
        consentLabelSnapshot:
          'Devam ederek Gizlilik Politikasını kabul ettim (partner başvuru formu).',
        documentCode: 'privacy_policy',
        documentVersion: findVersion('privacy_policy'),
        language,
        accepted: dto.acceptedTerms === true,
        acceptedAt,
        ipAddress,
        userAgent,
      }),
    ]);
  }

  private async seedApplicationFromStart(applicationId: string, dto: Dto.StartTenantOnboardingDto) {
    await Promise.all([
      this.store.upsertBusinessDetail(applicationId, {
        businessName: dto.companyName,
        businessType: dto.tenantType,
        registrationNumber: null,
        taxNumber: null,
        addressLine1: dto.companyAddress,
        addressLine2: null,
        city: '',
        postalCode: '',
        country: '',
      }),
      this.store.upsertLegalDetail(applicationId, {
        legalEntityName: dto.companyName,
        taxId: null,
        vatId: null,
        registrationCountry: '',
        registeredAddress: dto.companyAddress,
      }),
      this.store.upsertOwnerContact(applicationId, {
        fullName: `${dto.firstName} ${dto.lastName}`.trim(),
        email: dto.email.trim().toLowerCase(),
        phoneNumber: dto.phoneNumber,
        roleTitle: null,
        ownershipPercentage: null,
      }),
      this.store.upsertOperationsProfile(applicationId, {
        primaryCity: '',
        primaryPostalCode: '',
        deliveryModel: dto.deliveryModel,
        supportsPickup: false,
        openingHoursSummary: null,
        estimatedGoLiveDate: null,
      }),
    ]);

    await Promise.all([
      this.store.upsertStepProgress(applicationId, 'business_info', 'in_progress'),
      this.store.upsertStepProgress(applicationId, 'legal_tax_info', 'in_progress'),
      this.store.upsertStepProgress(applicationId, 'owner_contact_info', 'in_progress'),
      this.store.upsertStepProgress(applicationId, 'operations_info', 'in_progress'),
    ]);
  }

  async getOrCreateApplication(tenantAccountId: string) {
    const tenant = await this.tenantAccountsStore.findById(tenantAccountId);
    if (!tenant) {
      throw new NotFoundException('Tenant account could not be found.');
    }

    const existing = await this.store.findApplicationByTenantId(tenantAccountId);
    if (existing) {
      return existing;
    }

    const application = await this.store.createApplication(tenantAccountId, 'draft');
    await this.auditLogService.log({
      actorType: 'tenant',
      actorId: tenantAccountId,
      action: 'onboarding_application_created',
      entityType: 'tenant_onboarding_application',
      entityId: application.id,
      applicationId: application.id,
      tenantAccountId,
    });
    return application;
  }

  async getStateToken(tenantAccountId: string, stateToken: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    if (application.tenantAccountId !== tenantAccountId) {
      throw new ForbiddenException('Invalid state token.');
    }

    return this.getWorkspace(tenantAccountId);
  }

  async resolveStateToken(stateToken: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken, {
      allowTerminal: true,
    });
    return this.getWorkspace(application.tenantAccountId);
  }

  async resolveSessionByStateToken(stateToken: string, requestedStep?: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken, {
      allowTerminal: true,
    });
    const workspace = await this.getWorkspace(application.tenantAccountId);
    const normalizedRequestedStep = this.normalizeSessionStep(requestedStep);
    const currentStep = this.getCurrentSessionStep(workspace);
    const allowedSteps = this.getAllowedSessionSteps(workspace);
    const completedSteps = this.getCompletedSessionSteps(workspace);
    const requestedIsAllowed =
      Boolean(normalizedRequestedStep) &&
      allowedSteps.includes(normalizedRequestedStep as OnboardingSessionStepKey);
    const redirectStep = requestedIsAllowed
      ? null
      : currentStep;

    return {
      stateToken: workspace.stateToken,
      applicationId: workspace.application.id,
      status: workspace.application.status,
      requestedStep: normalizedRequestedStep ?? requestedStep ?? null,
      currentStep,
      redirectStep,
      allowedSteps,
      completedSteps,
      countryPack: await this.getCountryPackSnapshot(workspace),
      stepData: this.getSessionStepData(workspace, normalizedRequestedStep ?? currentStep),
      workspace,
    };
  }

  async sendPhoneVerificationCodeByStateToken(stateToken: string, phoneNumber: string) {
    return this.sendPhoneVerificationCode(stateToken, phoneNumber, false);
  }

  async resendPhoneVerificationCodeByStateToken(stateToken: string, phoneNumber?: string) {
    return this.sendPhoneVerificationCode(stateToken, phoneNumber, true);
  }

  private async sendPhoneVerificationCode(
    stateToken: string,
    phoneNumber: string | undefined,
    isResend: boolean,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const tenant = await this.tenantAccountsStore.findById(application.tenantAccountId);
    if (!tenant) {
      throw new NotFoundException('Tenant account could not be found.');
    }

    const existingVerification = await this.store.getPhoneVerification(application.id);
    if (existingVerification?.verifiedAt) {
      const workspace = await this.getWorkspace(application.tenantAccountId);
      return {
        verified: true,
        redirectStep: this.getCurrentSessionStep(workspace),
        session: await this.resolveSessionByStateToken(workspace.stateToken, 'welcome'),
      };
    }

    const ownerContact = await this.store.getOwnerContact(application.id);
    const normalizedPhoneNumber = this.normalizePhoneNumber(
      phoneNumber ?? existingVerification?.phoneNumber ?? ownerContact?.phoneNumber ?? tenant.account.phoneNumber,
    );
    if (normalizedPhoneNumber.length < 7) {
      throw new BadRequestException('Doğrulama kodu gönderilmeden önce telefon numarası gereklidir.');
    }

    // Refuse to advance the UI when there is no real delivery channel in
    // production. Otherwise the OTP is hashed into the DB but never reaches
    // the user — the smoke test path that surfaced this fix.
    const allowsStubDelivery = this.shouldExposeDebugVerificationCode();
    if (this.emailService.isStubTransport() && !allowsStubDelivery) {
      this.logger.error(
        JSON.stringify({
          event: 'phone_verification_blocked_no_provider',
          applicationId: application.id,
          isResend,
          transport: this.emailService.resolveTransport(),
        }),
      );
      throw new ServiceUnavailableException({
        message:
          'Doğrulama kodu gönderilemedi. Lütfen birkaç dakika içinde tekrar deneyin veya destek ekibimizle iletişime geçin.',
        code: 'otp_provider_unavailable',
      });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.store.upsertPhoneVerificationChallenge(application.id, {
      phoneNumber: normalizedPhoneNumber,
      otpCodeHash: this.hashPhoneVerificationCode(application.id, code),
      expiresAt,
      incrementResendCount: isResend,
    });

    const platformName = await this.resolvePlatformDisplayName();
    let deliveryResult: { delivered: boolean; transport: string; stub: boolean };
    try {
      deliveryResult = await this.emailService.send({
        to: tenant.account.email,
        subject: `${platformName} telefon doğrulama kodunuz`,
        text: `Telefon doğrulama kodunuz: ${code}. Bu kod 10 dakika geçerlidir.`,
      });
    } catch (deliveryError) {
      this.logger.error(
        JSON.stringify({
          event: 'phone_verification_delivery_failed',
          applicationId: application.id,
          isResend,
          error: deliveryError instanceof Error ? deliveryError.message : String(deliveryError),
        }),
      );
      throw new ServiceUnavailableException({
        message:
          'Doğrulama kodu gönderilemedi. Lütfen birkaç dakika içinde tekrar deneyin.',
        code: 'otp_delivery_failed',
      });
    }

    if (!deliveryResult.delivered && !allowsStubDelivery) {
      this.logger.error(
        JSON.stringify({
          event: 'phone_verification_delivery_not_acknowledged',
          applicationId: application.id,
          isResend,
          transport: deliveryResult.transport,
        }),
      );
      throw new ServiceUnavailableException({
        message:
          'Doğrulama kodu gönderilemedi. Lütfen birkaç dakika içinde tekrar deneyin.',
        code: 'otp_delivery_not_acknowledged',
      });
    }

    this.logger.log(
      JSON.stringify({
        event: 'phone_verification_code_dispatched',
        applicationId: application.id,
        isResend,
        delivered: deliveryResult.delivered,
        transport: deliveryResult.transport,
        stub: deliveryResult.stub,
      }),
    );

    const workspace = await this.getWorkspace(application.tenantAccountId);
    return {
      maskedPhoneNumber: this.maskPhoneNumber(normalizedPhoneNumber),
      expiresAt: expiresAt.toISOString(),
      delivery: deliveryResult.stub ? 'email_fallback' : deliveryResult.transport,
      nextStep: 'otp',
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'otp'),
      debugCode: allowsStubDelivery ? code : undefined,
    };
  }

  async verifyPhoneByStateToken(stateToken: string, code: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const challenge = await this.store.getPhoneVerification(application.id);
    if (!challenge || !challenge.otpCodeHash || !challenge.expiresAt || challenge.expiresAt < new Date()) {
      throw new BadRequestException('Telefon doğrulama kodunun süresi doldu.');
    }

    if (challenge.attemptCount >= 5) {
      throw new BadRequestException('Telefon doğrulaması için deneme sınırı aşıldı.');
    }

    if (challenge.otpCodeHash !== this.hashPhoneVerificationCode(application.id, code)) {
      await this.store.incrementPhoneVerificationAttempt(application.id);
      throw new BadRequestException('Telefon doğrulama kodu geçersiz.');
    }

    await this.store.markPhoneVerificationVerified(application.id);
    const workspace = await this.getWorkspace(application.tenantAccountId);
    return {
      verified: true,
      nextStep: 'welcome',
      redirectStep: null,
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'welcome'),
      workspace,
    };
  }

  async completeWelcomeByStateToken(stateToken: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    const workspace = await this.getWorkspace(application.tenantAccountId);

    if (!workspace.phoneVerification?.verified) {
      return {
        stateToken: workspace.stateToken,
        nextStep: this.getCurrentSessionStep(workspace),
        redirectStep: this.getCurrentSessionStep(workspace),
        session: await this.resolveSessionByStateToken(workspace.stateToken, 'welcome'),
        workspace,
      };
    }

    return {
      stateToken: workspace.stateToken,
      nextStep: 'location',
      redirectStep: null,
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'location'),
      workspace,
    };
  }

  async saveLocationSelectionByStateToken(
    stateToken: string,
    input: Dto.SaveTenantOnboardingLocationSelectionDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const workspaceBefore = await this.getWorkspace(application.tenantAccountId);
    if (!workspaceBefore.phoneVerification?.verified) {
      throw new ForbiddenException('Konum kaydedilmeden önce telefon doğrulaması tamamlanmalıdır.');
    }

    const dto = this.validateDto(Dto.SaveTenantOnboardingLocationSelectionDto, input);
    const normalizedLocation = {
      locationLabel: dto.locationLabel.trim(),
      rawInput: dto.rawInput.trim(),
      country: dto.country?.trim().toUpperCase() || 'CH',
      city: dto.city?.trim() || null,
      postalCode: dto.postalCode?.trim() || null,
      street: null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      provider: 'manual' as const,
      providerPlaceId: null,
    };
    const locationSelection = await this.store.upsertLocationSelection(application.id, normalizedLocation);

    const currentBusiness = await this.store.getBusinessDetail(application.id);
    if (currentBusiness) {
      await this.store.upsertBusinessDetail(application.id, {
        businessName: currentBusiness.businessName,
        businessType: currentBusiness.businessType,
        registrationNumber: currentBusiness.registrationNumber,
        taxNumber: currentBusiness.taxNumber,
        addressLine1: currentBusiness.addressLine1?.trim() || normalizedLocation.rawInput,
        addressLine2: currentBusiness.addressLine2,
        city: normalizedLocation.city ?? currentBusiness.city,
        postalCode: normalizedLocation.postalCode ?? currentBusiness.postalCode,
        country: normalizedLocation.country,
      });
    }

    const workspace = await this.getWorkspace(application.tenantAccountId);
    return {
      stateToken: workspace.stateToken,
      nextStep: 'address',
      redirectStep: null,
      locationSelection,
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'address'),
      workspace,
    };
  }

  async saveAddressByStateToken(
    stateToken: string,
    input: Dto.SaveTenantOnboardingAddressDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const workspaceBefore = await this.getWorkspace(application.tenantAccountId);
    if (!workspaceBefore.phoneVerification?.verified) {
      throw new ForbiddenException('Adres kaydedilmeden önce telefon doğrulaması tamamlanmalıdır.');
    }
    if (!this.hasLocationSelection(workspaceBefore)) {
      return {
        stateToken: workspaceBefore.stateToken,
        nextStep: 'location',
        redirectStep: 'location',
        session: await this.resolveSessionByStateToken(workspaceBefore.stateToken, 'address'),
        workspace: workspaceBefore,
      };
    }

    const dto = this.validateDto(Dto.SaveTenantOnboardingAddressDto, input);
    const currentBusiness = await this.store.getBusinessDetail(application.id);
    const addressLine2 = this.composeAddressLine2({
      addressLine2: dto.addressLine2,
      building: dto.building,
      floor: dto.floor,
      door: dto.door,
      addressNote: dto.addressNote,
    });

    await this.store.upsertBusinessDetail(application.id, {
      businessName: currentBusiness?.businessName ?? workspaceBefore.locationSelection?.locationLabel ?? '',
      businessType: currentBusiness?.businessType ?? 'food_service',
      registrationNumber: currentBusiness?.registrationNumber ?? null,
      taxNumber: currentBusiness?.taxNumber ?? null,
      addressLine1: dto.addressLine1.trim(),
      addressLine2,
      city: dto.city.trim(),
      postalCode: dto.postalCode.trim(),
      country: dto.country.trim().toUpperCase(),
    });

    await this.assertStepReadyForCompletion(application.id, 'business_info');
    await this.store.upsertStepProgress(application.id, 'business_info', 'completed');

    const workspace = await this.getWorkspace(application.tenantAccountId);
    return {
      stateToken: workspace.stateToken,
      nextStep: 'business-details',
      redirectStep: null,
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'business-details'),
      workspace,
    };
  }

  async verifyBusinessRegistrationByStateToken(
    stateToken: string,
    input: Dto.VerifyTenantOnboardingBusinessRegistrationDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    const workspace = await this.getWorkspace(application.tenantAccountId);
    if (!workspace.phoneVerification?.verified) {
      throw new ForbiddenException('İşletme bilgilerine geçmeden önce telefon doğrulaması tamamlanmalıdır.');
    }
    if (!this.isWorkspaceStepCompleted(workspace, 'business_info')) {
      return {
        accepted: false,
        redirectStep: this.hasLocationSelection(workspace) ? 'address' : 'location',
        session: await this.resolveSessionByStateToken(workspace.stateToken, 'business-details'),
        workspace,
      };
    }

    const dto = this.validateDto(Dto.VerifyTenantOnboardingBusinessRegistrationDto, input);
    const registrationNumber = dto.registrationNumber.trim();
    if (!/[A-Za-z0-9]/.test(registrationNumber)) {
      throw new BadRequestException('Kayıt numarası harf veya sayı içermelidir.');
    }

    return {
      accepted: true,
      registrationNumber,
      country:
        dto.country?.trim().toUpperCase() ||
        (await this.getCountryPackSnapshot(workspace)).country,
      verificationMode: 'mock',
      message: 'Kayıt numarası başvuru taslağı kontrolü için kabul edildi.',
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'business-details'),
      workspace,
    };
  }

  async saveBusinessDetailsByStateToken(
    stateToken: string,
    input: Dto.SaveTenantOnboardingBusinessDetailsDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const workspaceBefore = await this.getWorkspace(application.tenantAccountId);
    if (!workspaceBefore.phoneVerification?.verified) {
      throw new ForbiddenException('İşletme bilgileri kaydedilmeden önce telefon doğrulaması tamamlanmalıdır.');
    }
    if (!this.isWorkspaceStepCompleted(workspaceBefore, 'business_info')) {
      return {
        stateToken: workspaceBefore.stateToken,
        nextStep: this.hasLocationSelection(workspaceBefore) ? 'address' : 'location',
        redirectStep: this.hasLocationSelection(workspaceBefore) ? 'address' : 'location',
        session: await this.resolveSessionByStateToken(workspaceBefore.stateToken, 'business-details'),
        workspace: workspaceBefore,
      };
    }

    const dto = this.validateDto(Dto.SaveTenantOnboardingBusinessDetailsDto, input);
    const taxId = (dto.taxNumber?.trim() || dto.registrationNumber.trim());
    const vatId = dto.vatRegistered ? dto.vatNumber?.trim() || null : null;
    await this.store.upsertLegalDetail(application.id, {
      legalEntityName: dto.registeredBusinessName.trim(),
      taxId,
      vatId,
      registrationCountry: dto.registrationCountry.trim().toUpperCase(),
      registeredAddress: dto.registeredAddress.trim(),
    });

    await this.assertStepReadyForCompletion(application.id, 'legal_tax_info');
    await this.store.upsertStepProgress(application.id, 'legal_tax_info', 'completed');

    const workspace = await this.getWorkspace(application.tenantAccountId);
    return {
      stateToken: workspace.stateToken,
      nextStep: 'authorized-person',
      redirectStep: null,
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'authorized-person'),
      workspace,
    };
  }

  async saveAuthorizedPersonByStateToken(
    stateToken: string,
    input: Dto.SaveTenantOnboardingAuthorizedPersonDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const workspaceBefore = await this.getWorkspace(application.tenantAccountId);
    if (!workspaceBefore.phoneVerification?.verified) {
      throw new ForbiddenException('Yetkili kişi kaydedilmeden önce telefon doğrulaması tamamlanmalıdır.');
    }
    if (!this.isWorkspaceStepCompleted(workspaceBefore, 'business_info')) {
      const redirectStep = this.hasLocationSelection(workspaceBefore) ? 'address' : 'location';
      return {
        stateToken: workspaceBefore.stateToken,
        nextStep: redirectStep,
        redirectStep,
        session: await this.resolveSessionByStateToken(workspaceBefore.stateToken, 'authorized-person'),
        workspace: workspaceBefore,
      };
    }
    if (!this.isWorkspaceStepCompleted(workspaceBefore, 'legal_tax_info')) {
      return {
        stateToken: workspaceBefore.stateToken,
        nextStep: 'business-details',
        redirectStep: 'business-details',
        session: await this.resolveSessionByStateToken(workspaceBefore.stateToken, 'authorized-person'),
        workspace: workspaceBefore,
      };
    }

    const dto = this.validateDto(Dto.SaveTenantOnboardingAuthorizedPersonDto, input);
    await this.store.upsertOwnerContact(application.id, {
      fullName: dto.fullName.trim(),
      email: dto.email.trim().toLowerCase(),
      phoneNumber: dto.phoneNumber.trim(),
      roleTitle: dto.roleTitle?.trim() || null,
      ownershipPercentage: dto.ownershipPercentage ?? null,
    });

    await this.assertStepReadyForCompletion(application.id, 'owner_contact_info');
    await this.store.upsertStepProgress(application.id, 'owner_contact_info', 'completed');

    const workspace = await this.getWorkspace(application.tenantAccountId);
    return {
      stateToken: workspace.stateToken,
      nextStep: 'bank-details',
      redirectStep: null,
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'bank-details'),
      workspace,
    };
  }

  async saveBankDetailsByStateToken(
    stateToken: string,
    input: Dto.SaveTenantOnboardingBankDetailsDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const workspaceBefore = await this.getWorkspace(application.tenantAccountId);
    const redirectStep = this.getPrerequisiteRedirectForBankBilling(workspaceBefore);
    if (redirectStep) {
      return {
        stateToken: workspaceBefore.stateToken,
        nextStep: redirectStep,
        redirectStep,
        session: await this.resolveSessionByStateToken(workspaceBefore.stateToken, 'bank-details'),
        workspace: workspaceBefore,
      };
    }

    const dto = this.validateDto(Dto.SaveTenantOnboardingBankDetailsDto, input);
    await this.store.upsertBankDetail(application.id, {
      bankName: dto.bankName.trim(),
      accountHolderName: dto.accountHolderName.trim(),
      iban: this.normalizeIban(dto.iban),
      currency:
        dto.currency?.trim().toUpperCase() ||
        (await this.getCountryPackSnapshot(workspaceBefore)).currency,
    });

    await this.assertStepReadyForCompletion(application.id, 'bank_details');
    await this.store.upsertStepProgress(application.id, 'bank_details', 'completed');

    const workspace = await this.getWorkspace(application.tenantAccountId);
    return {
      stateToken: workspace.stateToken,
      nextStep: 'billing-address',
      redirectStep: null,
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'billing-address'),
      workspace,
    };
  }

  async saveBillingAddressByStateToken(
    stateToken: string,
    input: Dto.SaveTenantOnboardingBillingAddressDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const workspaceBefore = await this.getWorkspace(application.tenantAccountId);
    const prerequisiteRedirect = this.getPrerequisiteRedirectForBankBilling(workspaceBefore);
    if (prerequisiteRedirect) {
      return {
        stateToken: workspaceBefore.stateToken,
        nextStep: prerequisiteRedirect,
        redirectStep: prerequisiteRedirect,
        session: await this.resolveSessionByStateToken(workspaceBefore.stateToken, 'billing-address'),
        workspace: workspaceBefore,
      };
    }
    if (!this.isWorkspaceStepCompleted(workspaceBefore, 'bank_details')) {
      return {
        stateToken: workspaceBefore.stateToken,
        nextStep: 'bank-details',
        redirectStep: 'bank-details',
        session: await this.resolveSessionByStateToken(workspaceBefore.stateToken, 'billing-address'),
        workspace: workspaceBefore,
      };
    }

    const dto = this.validateDto(Dto.SaveTenantOnboardingBillingAddressDto, input);
    await this.store.upsertBillingAddress(application.id, {
      useBusinessAddress: Boolean(dto.useBusinessAddress),
      billingName: dto.billingName.trim(),
      country: dto.country.trim().toUpperCase(),
      city: dto.city.trim(),
      postalCode: dto.postalCode.trim(),
      addressLine1: dto.addressLine1.trim(),
      addressLine2: dto.addressLine2?.trim() || null,
    });

    await this.assertStepReadyForCompletion(application.id, 'billing_address');
    await this.store.upsertStepProgress(application.id, 'billing_address', 'completed');

    const workspace = await this.getWorkspace(application.tenantAccountId);
    return {
      stateToken: workspace.stateToken,
      nextStep: 'plan-selection',
      redirectStep: null,
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'plan-selection'),
      workspace,
    };
  }

  async getPlansByStateToken(stateToken: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    const workspace = await this.getWorkspace(application.tenantAccountId);
    const countryPack = await this.getCountryPackSnapshot(workspace);
    const accessible = this.isWorkspaceStepCompleted(workspace, 'billing_address');
    const redirectStep = accessible ? null : this.getCurrentSessionStep(workspace);

    return {
      stateToken: workspace.stateToken,
      redirectStep,
      countryPack,
      plans: accessible
        ? getTenantOnboardingPlanCatalog(countryPack.country, countryPack.currency)
        : [],
      selectedPlan: await this.store.getPlanSelection(application.id),
    };
  }

  async savePlanSelectionByStateToken(
    stateToken: string,
    input: Dto.SaveTenantOnboardingPlanSelectionDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const workspaceBefore = await this.getWorkspace(application.tenantAccountId);
    if (!this.isWorkspaceStepCompleted(workspaceBefore, 'billing_address')) {
      const redirectStep = this.getCurrentSessionStep(workspaceBefore);
      return {
        stateToken: workspaceBefore.stateToken,
        nextStep: redirectStep,
        redirectStep,
        session: await this.resolveSessionByStateToken(workspaceBefore.stateToken, 'plan-selection'),
        workspace: workspaceBefore,
      };
    }

    const dto = this.validateDto(Dto.SaveTenantOnboardingPlanSelectionDto, input);
    const countryPack = await this.getCountryPackSnapshot(workspaceBefore);
    const selectedPlan = getTenantOnboardingPlanCatalog(countryPack.country, countryPack.currency)
      .find((plan) => plan.active && plan.planKey === dto.planKey.trim());
    if (!selectedPlan) {
      throw new BadRequestException('Seçilen başvuru planı kullanılamıyor.');
    }

    await this.store.upsertPlanSelection(application.id, {
      planKey: selectedPlan.planKey,
      planNameSnapshot: selectedPlan.title,
      commissionSummarySnapshot: selectedPlan.commissionSummary,
      currency: selectedPlan.currency,
      selectedAt: new Date(),
    });
    await this.assertStepReadyForCompletion(application.id, 'membership_plan');
    await this.store.upsertStepProgress(application.id, 'membership_plan', 'completed');

    const workspace = await this.getWorkspace(application.tenantAccountId);
    return {
      stateToken: workspace.stateToken,
      nextStep: 'operations',
      redirectStep: null,
      session: await this.resolveSessionByStateToken(workspace.stateToken, 'operations'),
      workspace,
    };
  }

  async saveOperationsByStateToken(
    stateToken: string,
    input: Dto.UpdateTenantOperationsInfoDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const workspaceBefore = await this.getWorkspace(application.tenantAccountId);
    if (!this.isWorkspaceStepCompleted(workspaceBefore, 'membership_plan')) {
      const redirectStep = this.getCurrentSessionStep(workspaceBefore);
      return {
        stateToken: workspaceBefore.stateToken,
        nextStep: redirectStep,
        redirectStep,
        session: await this.resolveSessionByStateToken(workspaceBefore.stateToken, 'operations'),
        workspace: workspaceBefore,
      };
    }

    const dto = this.validateDto(Dto.UpdateTenantOperationsInfoDto, input);
    await this.store.upsertOperationsProfile(application.id, {
      primaryCity: dto.primaryCity.trim(),
      primaryPostalCode: dto.primaryPostalCode.trim(),
      deliveryModel: dto.deliveryModel.trim(),
      supportsPickup: dto.supportsPickup,
      openingHoursSummary: dto.openingHoursSummary?.trim() || null,
      estimatedGoLiveDate: dto.estimatedGoLiveDate ? new Date(dto.estimatedGoLiveDate) : null,
    });
    await this.assertStepReadyForCompletion(application.id, 'operations_info');
    await this.store.upsertStepProgress(application.id, 'operations_info', 'completed');

    const workspace = await this.getWorkspace(application.tenantAccountId);
    const nextStep = this.isWorkspaceStepCompleted(workspace, 'documents') ? 'review' : 'verification';
    return {
      stateToken: workspace.stateToken,
      nextStep,
      redirectStep: null,
      session: await this.resolveSessionByStateToken(workspace.stateToken, nextStep),
      workspace,
    };
  }

  async getConsentsByStateToken(stateToken: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    const workspace = await this.getWorkspace(application.tenantAccountId);
    const accessible = this.isWorkspaceStepCompleted(workspace, 'membership_plan');

    if (!accessible) {
      return {
        stateToken: workspace.stateToken,
        status: workspace.application.status,
        redirectStep: this.getCurrentSessionStep(workspace),
        countryPack: await this.getCountryPackSnapshot(workspace),
        documentRequirements: null,
        consentDefinitions: [],
        acceptedConsents: [],
        missingRequiredConsentKeys: [],
      };
    }

    return {
      stateToken: workspace.stateToken,
      status: workspace.application.status,
      redirectStep: null,
      countryPack: await this.getCountryPackSnapshot(workspace),
      ...(await this.buildComplianceSnapshot(workspace)),
    };
  }

  async saveConsentsByStateToken(
    stateToken: string,
    input: Dto.SaveTenantOnboardingConsentsDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    this.assertPhoneVerificationEditable(application.status);
    const workspace = await this.getWorkspace(application.tenantAccountId);
    if (!this.isWorkspaceStepCompleted(workspace, 'membership_plan')) {
      return {
        ...(await this.getConsentsByStateToken(workspace.stateToken)),
        redirectStep: this.getCurrentSessionStep(workspace),
      };
    }

    const dto = this.validateDto(Dto.SaveTenantOnboardingConsentsDto, input);
    const countryPack = await this.getCountryPackSnapshot(workspace);
    const catalog = await this.resolveComplianceCatalog(countryPack.country, countryPack.language);
    const knownDefinitions = new Map(catalog.consents.map((definition) => [definition.consentKey, definition]));
    const unknownKeys = dto.acceptedConsentKeys.filter((key) => !knownDefinitions.has(key));
    if (unknownKeys.length > 0) {
      throw new BadRequestException(`Desteklenmeyen başvuru onayı: ${unknownKeys.join(', ')}.`);
    }

    await Promise.all(
      dto.acceptedConsentKeys.map((key) => {
        const definition = knownDefinitions.get(key)!;
        return this.store.upsertConsentSnapshot(application.id, {
          consentKey: definition.consentKey,
          consentLabelSnapshot: definition.label,
          documentCode: definition.documentCode,
          documentVersion: definition.documentVersion,
          language: definition.language,
          accepted: true,
          acceptedAt: new Date(),
          ipAddress: null,
          userAgent: null,
        });
      }),
    );

    return this.getConsentsByStateToken(workspace.stateToken);
  }

  async getReviewByStateToken(stateToken: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    const workspace = await this.getWorkspace(application.tenantAccountId);
    const countryPack = await this.getCountryPackSnapshot(workspace);
    const accessible = this.isWorkspaceStepCompleted(workspace, 'membership_plan');
    const redirectStep = accessible ? null : this.getCurrentSessionStep(workspace);

    if (!accessible) {
      return {
        stateToken: workspace.stateToken,
        status: workspace.application.status,
        redirectStep,
        countryPack,
        canSubmitForReview: false,
        missingRequiredBlocks: ['plan-selection'],
        editSteps: {},
        summary: null,
      };
    }

    const businessInfo = this.getWorkspaceStepData(workspace, 'business_info');
    const legalTaxInfo = this.getWorkspaceStepData(workspace, 'legal_tax_info');
    const ownerContactInfo = this.getWorkspaceStepData(workspace, 'owner_contact_info');
    const bankDetails = this.getWorkspaceStepData(workspace, 'bank_details');
    const billingAddress = this.getWorkspaceStepData(workspace, 'billing_address');
    const planSelection = this.getWorkspaceStepData(workspace, 'membership_plan');
    const operationsInfo = this.getWorkspaceStepData(workspace, 'operations_info');
    const documents = (workspace.steps.find((step) => step.stepKey === 'documents')?.data ?? []) as Array<{
      type?: string;
      status?: string;
      isRequired?: boolean;
      isCurrent?: boolean;
      version?: number;
    }>;
    const requiredDocuments = documents.filter((document) => document.isCurrent && document.isRequired);
    const operationComplete = this.isWorkspaceStepCompleted(workspace, 'operations_info');
    const documentsComplete =
      this.isWorkspaceStepCompleted(workspace, 'documents') && requiredDocuments.length > 0;
    const compliance = await this.buildComplianceSnapshot(workspace);
    const consentsComplete = compliance.missingRequiredConsentKeys.length === 0;
    const missingRequiredBlocks: string[] = [];
    const requireBlock = (ready: boolean, block: string) => {
      if (!ready) {
        missingRequiredBlocks.push(block);
      }
    };

    requireBlock(Boolean(workspace.phoneVerification?.verified), 'phone-verification');
    requireBlock(Boolean(workspace.locationSelection?.locationLabel?.trim()), 'location');
    requireBlock(this.isWorkspaceStepCompleted(workspace, 'business_info'), 'address');
    requireBlock(this.isWorkspaceStepCompleted(workspace, 'legal_tax_info'), 'business-details');
    requireBlock(this.isWorkspaceStepCompleted(workspace, 'owner_contact_info'), 'authorized-person');
    requireBlock(this.isWorkspaceStepCompleted(workspace, 'bank_details'), 'bank-details');
    requireBlock(this.isWorkspaceStepCompleted(workspace, 'billing_address'), 'billing-address');
    requireBlock(this.isWorkspaceStepCompleted(workspace, 'membership_plan'), 'plan-selection');
    requireBlock(operationComplete, 'operations-info');
    requireBlock(documentsComplete, 'documents');
    requireBlock(consentsComplete, 'consents');

    return {
      stateToken: workspace.stateToken,
      status: workspace.application.status,
      redirectStep: null,
      countryPack,
      canSubmitForReview: workspace.canSubmitForReview,
      missingRequiredBlocks,
      editSteps: {
        phone: 'phone-verification',
        location: 'location',
        address: 'address',
        businessDetails: 'business-details',
        authorizedPerson: 'authorized-person',
        bankDetails: 'bank-details',
        billingAddress: 'billing-address',
        planSelection: 'plan-selection',
        operations: 'operations',
        documents: 'verification',
      },
      summary: {
        phoneVerification: {
          verified: Boolean(workspace.phoneVerification?.verified),
          maskedPhoneNumber: workspace.phoneVerification?.maskedPhoneNumber ?? null,
          verifiedAt: workspace.phoneVerification?.verifiedAt ?? null,
        },
        locationSelection: workspace.locationSelection ?? null,
        businessInfo,
        legalTaxInfo,
        ownerContactInfo,
        bankDetails: bankDetails
          ? {
              bankName: bankDetails.bankName ?? null,
              accountHolderName: bankDetails.accountHolderName ?? null,
              maskedIban: this.maskIbanForReview(String(bankDetails.iban ?? '')),
              currency: bankDetails.currency ?? null,
            }
          : null,
        billingAddress,
        planSelection,
        legacyRequirements: {
          operationsComplete: operationComplete,
          operationsInfo,
          documentsComplete,
          requiredDocuments: requiredDocuments.map((document) => ({
            type: document.type ?? null,
            status: document.status ?? null,
            version: document.version ?? null,
          })),
        },
        compliance,
      },
    };
  }

  async sendContinueLinkByStateToken(stateToken: string) {
    const workspace = await this.resolveStateToken(stateToken);
    const tenant = await this.tenantAccountsStore.findById(workspace.application.tenantAccountId);
    if (!tenant) {
      throw new NotFoundException('Tenant account could not be found.');
    }

    const nextStep =
      workspace.steps.find((step) => step.status === 'needs_revision') ??
      workspace.steps.find((step) => step.status !== 'completed');
    const appBaseUrl = process.env.TENANT_APP_URL ?? 'http://localhost:3001';
    const continueUrl = `${appBaseUrl}/onboarding/${encodeURIComponent(workspace.stateToken)}/${workflowSlugFromBackendStep(nextStep?.stepKey ?? 'final_review')}`;
    const platformName = await this.resolvePlatformDisplayName();
    await this.emailService.send({
      to: tenant.account.email,
      subject: `${platformName} başvurunuza devam edin`,
      text: `Başvurunuza buradan devam edebilirsiniz: ${continueUrl}`,
      html: `<p>Başvurunuza devam etmek için <a href="${continueUrl}">bu bağlantıyı</a> kullanın.</p>`,
    });

    return { sent: true };
  }

  async saveStepDraftByStateToken(
    stateToken: string,
    step: string,
    input: object,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    const result = await this.saveStepDraft(application.tenantAccountId, step, input);

    return {
      stepKey: result.stepKey,
      status: result.status,
      nextStepKey: result.nextStepKey,
      stateToken: result.stateToken,
      data: result.data,
    };
  }

  async completeStepByStateToken(stateToken: string, step: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    const result = await this.completeStep(application.tenantAccountId, step);
    const nextStateToken = result.workspace.stateToken;

    return {
      stepKey: result.stepKey,
      status: result.status,
      nextStepKey: nextStepAfter(result.stepKey),
      stateToken: nextStateToken,
      workspace: result.workspace,
    };
  }

  // Public state-token endpoints must never leak a raw `Forbidden` /
  // `Invalid state token.` string to the partner UI. We classify every
  // resolve failure (malformed / unknown / stale-salt / wiped-salt) under a
  // single structured code so the frontend can render a user-friendly
  // "this link is no longer valid" copy without learning which check failed
  // (sensitive-info disclosure stays closed).
  private invalidStateTokenError() {
    return new ForbiddenException({
      message: 'Bu başvuru bağlantısı artık geçerli değil.',
      code: 'onboarding_session_invalid',
    });
  }

  private async resolveApplicationFromStateToken(
    stateToken: string,
    options?: { allowTerminal?: boolean },
  ) {
    let payload: ReturnType<typeof validateStateTokenPayload>;

    try {
      payload = validateStateTokenPayload(CryptoUtil.decryptStateToken(stateToken));
    } catch {
      throw this.invalidStateTokenError();
    }

    const application = await this.store.findApplicationById(payload.applicationId);
    if (!application || application.tenantAccountId !== payload.tenantAccountId) {
      throw this.invalidStateTokenError();
    }

    // Closed-status applications intentionally wipe `tokenSalt` so further
    // writes are rejected. Reads (workspace/session GETs) still need to
    // succeed so the tenant sees an "approved/closed" screen instead of a
    // raw 403 after admin approval/activation.
    if (!application.tokenSalt) {
      if (options?.allowTerminal && TERMINAL_CLOSED_STATUSES.has(application.status)) {
        return application;
      }
      throw this.invalidStateTokenError();
    }

    if (application.tokenSalt !== payload.tokenSalt) {
      throw this.invalidStateTokenError();
    }

    return application;
  }

  private normalizeSessionStep(step?: string | null): OnboardingSessionStepKey | null {
    if (!step?.trim()) {
      return 'phone-verification';
    }

    return ONBOARDING_SESSION_STEP_ALIASES[step.trim()] ?? null;
  }

  private getCurrentSessionStep(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ): OnboardingSessionStepKey {
    if (
      TERMINAL_WAITING_STATUSES.has(workspace.application.status) ||
      TERMINAL_CLOSED_STATUSES.has(workspace.application.status)
    ) {
      return 'submitted';
    }

    // When admin requests revision, drop the tenant onto the verification
    // step if documents are flagged, otherwise back to the final review.
    if (workspace.application.status === 'revision_required') {
      const documentsNeedRevision = workspace.steps.some(
        (step) => step.stepKey === 'documents' && step.status === 'needs_revision',
      );
      if (documentsNeedRevision) {
        return 'verification';
      }
      const otherRevisionStep = workspace.steps.find(
        (step) => step.stepKey !== 'final_review' && step.status === 'needs_revision',
      );
      if (otherRevisionStep) {
        const slug = ONBOARDING_SESSION_STEP_ALIASES[
          workflowSlugFromBackendStep(otherRevisionStep.stepKey)
        ];
        if (slug) {
          return slug;
        }
      }
      return 'review';
    }

    if (!workspace.phoneVerification?.verified) {
      return this.isPhoneOtpPending(workspace) ? 'otp' : 'phone-verification';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'business_info')) {
      return this.hasLocationSelection(workspace) ? 'address' : 'location';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'legal_tax_info')) {
      return 'business-details';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'owner_contact_info')) {
      return 'authorized-person';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'bank_details')) {
      return 'bank-details';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'billing_address')) {
      return 'billing-address';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'membership_plan')) {
      return 'plan-selection';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'operations_info')) {
      return 'operations';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'documents')) {
      return 'verification';
    }

    return 'review';
  }

  private getAllowedSessionSteps(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ): OnboardingSessionStepKey[] {
    if (
      TERMINAL_WAITING_STATUSES.has(workspace.application.status) ||
      TERMINAL_CLOSED_STATUSES.has(workspace.application.status)
    ) {
      return ['submitted'];
    }

    const allowed = new Set<OnboardingSessionStepKey>(['phone-verification']);

    if (!workspace.phoneVerification?.verified) {
      if (this.isPhoneOtpPending(workspace)) {
        allowed.add('otp');
      }
      return ONBOARDING_SESSION_STEP_ORDER.filter((step) => allowed.has(step));
    }

    allowed.delete('phone-verification');
    allowed.add('welcome');

    allowed.add('location');
    if (this.hasLocationSelection(workspace)) {
      allowed.add('address');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'business_info')) {
      allowed.add('business-details');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'legal_tax_info')) {
      allowed.add('authorized-person');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'owner_contact_info')) {
      allowed.add('bank-details');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'bank_details')) {
      allowed.add('billing-address');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'billing_address')) {
      allowed.add('plan-selection');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'membership_plan')) {
      allowed.add('operations');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'operations_info')) {
      allowed.add('verification');
    }

    if (
      this.isWorkspaceStepCompleted(workspace, 'operations_info') &&
      this.isWorkspaceStepCompleted(workspace, 'documents')
    ) {
      allowed.add('review');
    }

    return ONBOARDING_SESSION_STEP_ORDER.filter((step) => allowed.has(step));
  }

  private getCompletedSessionSteps(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ): OnboardingSessionStepKey[] {
    const completed = new Set<OnboardingSessionStepKey>();

    if (workspace.phoneVerification?.verified) {
      completed.add('phone-verification');
      completed.add('otp');
      completed.add('welcome');
    }

    if (this.hasLocationSelection(workspace)) {
      completed.add('location');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'business_info')) {
      completed.add('location');
      completed.add('address');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'legal_tax_info')) {
      completed.add('business-details');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'owner_contact_info')) {
      completed.add('authorized-person');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'bank_details')) {
      completed.add('bank-details');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'billing_address')) {
      completed.add('billing-address');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'membership_plan')) {
      completed.add('plan-selection');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'operations_info')) {
      completed.add('operations');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'documents')) {
      completed.add('verification');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'final_review')) {
      completed.add('review');
    }

    return ONBOARDING_SESSION_STEP_ORDER.filter((step) => completed.has(step));
  }

  private isWorkspaceStepCompleted(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
    stepKey: TenantOnboardingStepKey,
  ) {
    return workspace.steps.some((step) => step.stepKey === stepKey && step.status === 'completed');
  }

  /**
   * Backwards-compatible alias for the many call sites that read the
   * country/language/currency triple for the active onboarding workspace.
   * Delegates to `resolveActiveCountryPack` so the active install profile
   * wins; the legacy "business_info.country" path is only a defensive
   * fallback for legacy dev DBs without an InstallationProfile row.
   */
  private async getCountryPackSnapshot(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ): Promise<{ country: string; language: string; currency: string }> {
    return this.resolveActiveCountryPack(workspace);
  }

  private async buildComplianceSnapshot(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ) {
    const countryPack = await this.resolveActiveCountryPack(workspace);
    return this.buildComplianceSnapshotForApplication(workspace.application.id, countryPack);
  }

  /**
   * IBAN must start with the country prefix the active CountryPack expects
   * AND match its declared total length. The check fires only when the
   * caller is about to persist a non-empty IBAN, so intermediate saves
   * (e.g. autosave with an empty form) keep working.
   *
   * The check is silently skipped when no installation profile is present
   * (legacy dev DBs); production deployments always have one.
   */
  private async assertIbanMatchesActiveCountry(iban: string): Promise<void> {
    const policy = await this.installationProfileService.findActiveCountryPolicy();
    if (!policy) {
      return;
    }
    const bank = policy.pack.bank;
    const ibanCountry = iban.slice(0, 2);
    if (ibanCountry !== bank.ibanCountryCode) {
      throw new BadRequestException(
        `IBAN ülke ön eki '${ibanCountry}' aktif kurulum ülkesi '${bank.ibanCountryCode}' ile eşleşmiyor.`,
      );
    }
    if (iban.length !== bank.ibanLength) {
      throw new BadRequestException(
        `IBAN uzunluğu ${iban.length}; ${bank.ibanCountryCode} için beklenen uzunluk ${bank.ibanLength}.`,
      );
    }
  }

  private async resolveComplianceCatalog(country: string, language: string) {
    const fallback = getTenantOnboardingComplianceCatalog(country, language);
    const [documentDefinitions, consentDefinitions, profile] = await Promise.all([
      this.store.listActiveComplianceDocumentRequirements(country, language),
      this.store.listActiveComplianceConsentDefinitions(country, language),
      this.installationProfileService.findActive(),
    ]);

    // CountryPack legalDocuments carry the placeholder text the user actually
    // SEES when they tick the consent box. We merge title + body into every
    // consent definition so the review step can render an inline preview
    // instead of forcing the user out to an external URL.
    const legalDocs = profile?.pack.legalDocuments ?? [];
    const lookupLegal = (documentCode: string) =>
      legalDocs.find((doc) => doc.typeCode === documentCode) ?? null;

    const decorate = (definition: {
      consentKey: string;
      label: string;
      description: string;
      documentCode: string;
      documentVersion: string;
      documentUrl: string | null;
      required: boolean;
      language: string;
    }) => {
      const legal = lookupLegal(definition.documentCode);
      return {
        ...definition,
        documentTitle: legal?.placeholderTitle ?? null,
        documentBody: legal?.placeholderBody ?? null,
      };
    };

    return {
      ...fallback,
      documents: documentDefinitions.length > 0
        ? documentDefinitions.map((definition) => ({
            type: definition.documentType,
            label: definition.label,
            required: definition.required,
            description: definition.description,
            acceptedFormats: definition.acceptedFormats,
            guidanceOnly: definition.guidanceOnly,
          }))
        : fallback.documents,
      consents:
        consentDefinitions.length > 0
          ? consentDefinitions.map((definition) =>
              decorate({
                consentKey: definition.consentKey,
                label: definition.label,
                description: definition.description,
                documentCode: definition.documentCode,
                documentVersion: definition.documentVersion,
                documentUrl: definition.documentUrl,
                required: definition.required,
                language: definition.language,
              }),
            )
          : fallback.consents.map(decorate),
    };
  }

  private async buildComplianceSnapshotForApplication(
    applicationId: string,
    countryPack: { country: string; language: string; currency: string },
    existingSnapshots?: Awaited<ReturnType<TenantOnboardingStore['listConsentSnapshots']>>,
  ) {
    const catalog = await this.resolveComplianceCatalog(countryPack.country, countryPack.language);
    const snapshots = existingSnapshots ?? await this.store.listConsentSnapshots(applicationId);
    const acceptedConsents = catalog.consents.map((definition) => {
      const snapshot = snapshots.find(
        (entry) =>
          entry.consentKey === definition.consentKey &&
          entry.documentVersion === definition.documentVersion &&
          entry.accepted,
      );
      const supersededSnapshot = snapshots.find(
        (entry) =>
          entry.consentKey === definition.consentKey &&
          entry.documentVersion !== definition.documentVersion &&
          entry.accepted,
      );
      return {
        ...definition,
        accepted: Boolean(snapshot),
        acceptedAt: snapshot?.acceptedAt ?? null,
        reacceptanceRequired: !snapshot && Boolean(supersededSnapshot),
        previouslyAcceptedVersion: !snapshot ? supersededSnapshot?.documentVersion ?? null : null,
      };
    });

    return {
      documentRequirements: {
        definitions: catalog.documents,
        validationPolicy: catalog.documentValidationPolicy,
      },
      consentDefinitions: catalog.consents,
      acceptedConsents,
      missingRequiredConsentKeys: acceptedConsents
        .filter((consent) => consent.required && !consent.accepted)
        .map((consent) => consent.consentKey),
    };
  }

  private getSessionStepData(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
    step: OnboardingSessionStepKey,
  ) {
    const backendStepBySessionStep: Partial<Record<OnboardingSessionStepKey, TenantOnboardingStepKey>> = {
      location: 'business_info',
      address: 'business_info',
      'business-details': 'legal_tax_info',
      'authorized-person': 'owner_contact_info',
      'bank-details': 'bank_details',
      'billing-address': 'billing_address',
      'plan-selection': 'membership_plan',
      operations: 'operations_info',
      verification: 'documents',
      review: 'final_review',
    };
    const backendStep = backendStepBySessionStep[step];

    if (step === 'phone-verification' || step === 'otp') {
      return workspace.phoneVerification ?? null;
    }

    if (step === 'welcome') {
      return {
        phoneVerified: Boolean(workspace.phoneVerification?.verified),
        nextStep: 'location',
      };
    }

    if (step === 'location') {
      return workspace.locationSelection ?? null;
    }

    return backendStep
      ? workspace.steps.find((entry) => entry.stepKey === backendStep)?.data ?? null
      : null;
  }

  private getWorkspaceStepData(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
    stepKey: TenantOnboardingStepKey,
  ) {
    return (workspace.steps.find((entry) => entry.stepKey === stepKey)?.data ?? null) as
      | Record<string, unknown>
      | null;
  }

  private maskIbanForReview(iban: string) {
    const normalized = iban.replace(/\s+/g, '').toUpperCase();
    if (normalized.length <= 4) {
      return normalized || null;
    }

    return `${normalized.slice(0, 4)} ${'*'.repeat(Math.max(normalized.length - 8, 4))} ${normalized.slice(-4)}`;
  }

  private hasLocationSelection(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ) {
    return Boolean(workspace.locationSelection?.locationLabel?.trim());
  }

  private getPrerequisiteRedirectForBankBilling(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ): OnboardingSessionStepKey | null {
    if (!workspace.phoneVerification?.verified) {
      return this.getCurrentSessionStep(workspace);
    }
    if (!this.isWorkspaceStepCompleted(workspace, 'business_info')) {
      return this.hasLocationSelection(workspace) ? 'address' : 'location';
    }
    if (!this.isWorkspaceStepCompleted(workspace, 'legal_tax_info')) {
      return 'business-details';
    }
    if (!this.isWorkspaceStepCompleted(workspace, 'owner_contact_info')) {
      return 'authorized-person';
    }
    return null;
  }

  private normalizeIban(value: string) {
    return value.trim().replace(/\s+/g, '').toUpperCase();
  }

  private composeAddressLine2(input: {
    addressLine2?: string | null;
    building?: string | null;
    floor?: string | null;
    door?: string | null;
    addressNote?: string | null;
  }) {
    const parts = [
      input.addressLine2?.trim(),
      input.building?.trim() ? `Building: ${input.building.trim()}` : null,
      input.floor?.trim() ? `Floor: ${input.floor.trim()}` : null,
      input.door?.trim() ? `Door: ${input.door.trim()}` : null,
      input.addressNote?.trim() ? `Note: ${input.addressNote.trim()}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' | ') : null;
  }

  private isPhoneOtpPending(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ) {
    return Boolean(
      workspace.phoneVerification?.pending &&
      workspace.phoneVerification.expiresAt &&
      new Date(workspace.phoneVerification.expiresAt) > new Date(),
    );
  }

  private maskPhoneNumber(phoneNumber: string) {
    const normalized = phoneNumber.replace(/\s+/g, '');
    if (normalized.length <= 4) {
      return normalized;
    }

    return `${'*'.repeat(Math.max(normalized.length - 4, 0))}${normalized.slice(-4)}`;
  }

  private normalizePhoneNumber(phoneNumber: string) {
    return phoneNumber.trim().replace(/\s+/g, ' ');
  }

  private hashPhoneVerificationCode(applicationId: string, code: string) {
    const secret = process.env.ONBOARDING_OTP_SECRET ?? process.env.JWT_SECRET ?? 'lieferzonen-dev-otp';
    return createHash('sha256')
      .update(`${secret}:${applicationId}:${code}`)
      .digest('hex');
  }

  private assertPhoneVerificationEditable(status: TenantOnboardingApplicationStatus) {
    if (!this.isEditableStatus(status)) {
      throw new ForbiddenException('This onboarding application cannot verify phone in the current state.');
    }
  }

  private shouldExposeDebugVerificationCode() {
    // Strictly non-production. Stub email transport is the default, so the
    // previous OR-clause meant production silently surfaced OTPs in the
    // response body whenever EMAIL_TRANSPORT was unset.
    return process.env.NODE_ENV !== 'production';
  }

  async getSummary(tenantAccountId: string) {
    const application = await this.getOrCreateApplication(tenantAccountId);
    const [steps, businessInfo, legalTaxInfo, ownerContactInfo, bankDetails, billingAddress, planSelection, operationsInfo, documents, reviews, notes, phoneVerification, locationSelection] =
      await Promise.all([
        this.store.listStepProgress(application.id),
        this.store.getBusinessDetail(application.id),
        this.store.getLegalDetail(application.id),
        this.store.getOwnerContact(application.id),
        this.store.getBankDetail(application.id),
        this.store.getBillingAddress(application.id),
        this.store.getPlanSelection(application.id),
        this.store.getOperationsProfile(application.id),
        this.store.listDocuments(application.id),
        this.store.listApplicationReviews(application.id),
        this.store.listAdminNotes(application.id),
        this.store.getPhoneVerification(application.id),
        this.store.getLocationSelection(application.id),
      ]);

    const revisionRequests = [
      ...reviews.filter((review) => review.tenantVisibleNote).map((review) => review.tenantVisibleNote),
      ...notes.filter((note) => note.scope === 'tenant_visible').map((note) => note.body),
    ].filter(Boolean);

    return {
      application,
      studioAccessAllowed: application.status === 'active',
      steps,
      businessInfo,
      legalTaxInfo,
      ownerContactInfo,
      bankDetails,
      billingAddress,
      planSelection,
      operationsInfo,
      phoneVerification,
      locationSelection,
      documents: documents.filter((document) => document.isCurrent),
      revisionRequests,
    };
  }

  async getWorkspace(tenantAccountId: string) {
    const summary = await this.getSummary(tenantAccountId);
    const editable = this.isEditableStatus(summary.application.status);
    const documentsNeedingRevision = summary.documents.some((document) =>
      ['rejected', 'revision_requested', 'expired'].includes(document.status),
    );
    const currentStep = currentStepFromSteps(summary.steps as Array<{ stepKey: TenantOnboardingStepKey; status: string }>);
    const stateToken = buildStateToken(summary.application, currentStep);

    // Surface the password setup delivery summary ONLY when the application
    // reached a post-approval lifecycle. Earlier states never had a token
    // issued, and exposing the summary outside that window would let the
    // partner-facing JSON imply "we e-mailed you" before approval ever ran.
    const passwordSetup = ['approved', 'active'].includes(summary.application.status)
      ? await this.passwordSetupService.getPublicSafeSummaryForTenant(tenantAccountId)
      : null;

    return {
      application: {
        ...summary.application,
        stateToken,
      },
      phoneVerification: {
        verified: Boolean(summary.phoneVerification?.verifiedAt),
        pending: Boolean(
          summary.phoneVerification?.otpCodeHash &&
          summary.phoneVerification?.expiresAt &&
          summary.phoneVerification.expiresAt > new Date() &&
          !summary.phoneVerification.verifiedAt,
        ),
        phoneNumber:
          summary.phoneVerification?.phoneNumber ??
          summary.ownerContactInfo?.phoneNumber ??
          null,
        maskedPhoneNumber: summary.phoneVerification?.phoneNumber
          ? this.maskPhoneNumber(summary.phoneVerification.phoneNumber)
          : null,
        expiresAt: summary.phoneVerification?.expiresAt?.toISOString() ?? null,
        verifiedAt: summary.phoneVerification?.verifiedAt?.toISOString() ?? null,
        lastSentAt: summary.phoneVerification?.lastSentAt?.toISOString() ?? null,
        resendCount: summary.phoneVerification?.resendCount ?? 0,
        attemptCount: summary.phoneVerification?.attemptCount ?? 0,
      },
      locationSelection: summary.locationSelection
        ? {
            locationLabel: summary.locationSelection.locationLabel,
            rawInput: summary.locationSelection.rawInput,
            country: summary.locationSelection.country,
            city: summary.locationSelection.city,
            postalCode: summary.locationSelection.postalCode,
            latitude: summary.locationSelection.latitude,
            longitude: summary.locationSelection.longitude,
            updatedAt: summary.locationSelection.updatedAt,
          }
        : null,
      studioAccessAllowed: summary.studioAccessAllowed,
      editable,
      revisionRequests: summary.revisionRequests,
      steps: (summary.steps as Array<{ stepKey: TenantOnboardingStepKey; status: string; completedAt: Date | null; updatedAt: Date; blockedReason: string | null }>).map((step) => ({
        stepKey: step.stepKey,
        status: this.mapTenantFacingStepStatus(step.stepKey, step.status, summary.application.status, documentsNeedingRevision),
        completedAt: step.completedAt,
        updatedAt: step.updatedAt,
        blockedReason: step.blockedReason,
        locked: !editable,
        data: this.getStepData(summary, step.stepKey),
      })),
      canSubmitForReview: editable && (await this.canSubmitApplication(summary.application.id)),
      submitAction: summary.application.status === 'revision_required' ? 'resubmit' : 'submit',
      passwordSetup,
      stateToken,
    };
  }

  async getSteps(tenantAccountId: string) {
    const application = await this.getOrCreateApplication(tenantAccountId);
    return this.store.listStepProgress(application.id);
  }

  async saveStepDraft(tenantAccountId: string, step: string, input: object) {
    const stepKey = this.assertEditableStepKey(step);
    const application = await this.ensureEditableApplication(tenantAccountId);

    let data: unknown;
    switch (stepKey) {
      case 'business_info': {
        const dto = this.validateDto(Dto.PatchTenantBusinessInfoDto, input);
        const current = await this.store.getBusinessDetail(application.id);
        data = await this.store.upsertBusinessDetail(application.id, {
          businessName: dto.businessName ?? current?.businessName ?? '',
          businessType: dto.businessType ?? current?.businessType ?? '',
          registrationNumber: dto.registrationNumber ?? current?.registrationNumber ?? null,
          taxNumber: dto.taxNumber ?? current?.taxNumber ?? null,
          addressLine1: dto.addressLine1 ?? current?.addressLine1 ?? '',
          addressLine2: dto.addressLine2 ?? current?.addressLine2 ?? null,
          city: dto.city ?? current?.city ?? '',
          postalCode: dto.postalCode ?? current?.postalCode ?? '',
          country: dto.country ?? current?.country ?? '',
        });
        break;
      }
      case 'legal_tax_info': {
        const dto = this.validateDto(Dto.PatchTenantLegalTaxInfoDto, input);
        const current = await this.store.getLegalDetail(application.id);
        data = await this.store.upsertLegalDetail(application.id, {
          legalEntityName: dto.legalEntityName ?? current?.legalEntityName ?? '',
          taxId: dto.taxId ?? current?.taxId ?? null,
          vatId: dto.vatId ?? current?.vatId ?? null,
          registrationCountry: dto.registrationCountry ?? current?.registrationCountry ?? '',
          registeredAddress: dto.registeredAddress ?? current?.registeredAddress ?? '',
        });
        break;
      }
      case 'owner_contact_info': {
        const dto = this.validateDto(Dto.PatchTenantOwnerContactInfoDto, input);
        const current = await this.store.getOwnerContact(application.id);
        data = await this.store.upsertOwnerContact(application.id, {
          fullName: dto.fullName ?? current?.fullName ?? '',
          email: dto.email ?? current?.email ?? '',
          phoneNumber: dto.phoneNumber ?? current?.phoneNumber ?? '',
          roleTitle: dto.roleTitle ?? current?.roleTitle ?? null,
          ownershipPercentage: dto.ownershipPercentage ?? current?.ownershipPercentage ?? null,
        });
        break;
      }
      case 'bank_details': {
        const dto = this.validateDto(Dto.SaveTenantOnboardingBankDetailsDto, input);
        const current = await this.store.getBankDetail(application.id);
        const activePack = await this.resolveActiveCountryPack();
        const normalizedIban = dto.iban ? this.normalizeIban(dto.iban) : current?.iban ?? '';
        // IBAN validation against the active CountryPack — TR install rejects
        // a CH-prefixed IBAN and vice versa. Empty IBAN is left alone so an
        // intermediate save (before the field is filled) does not throw.
        if (normalizedIban) {
          await this.assertIbanMatchesActiveCountry(normalizedIban);
        }
        data = await this.store.upsertBankDetail(application.id, {
          bankName: dto.bankName ?? current?.bankName ?? '',
          accountHolderName: dto.accountHolderName ?? current?.accountHolderName ?? '',
          iban: normalizedIban,
          currency:
            dto.currency?.trim().toUpperCase() ?? current?.currency ?? activePack.currency,
        });
        break;
      }
      case 'billing_address': {
        const dto = this.validateDto(Dto.SaveTenantOnboardingBillingAddressDto, input);
        const current = await this.store.getBillingAddress(application.id);
        data = await this.store.upsertBillingAddress(application.id, {
          useBusinessAddress: dto.useBusinessAddress ?? current?.useBusinessAddress ?? false,
          billingName: dto.billingName ?? current?.billingName ?? '',
          country: dto.country ?? current?.country ?? '',
          city: dto.city ?? current?.city ?? '',
          postalCode: dto.postalCode ?? current?.postalCode ?? '',
          addressLine1: dto.addressLine1 ?? current?.addressLine1 ?? '',
          addressLine2: dto.addressLine2 ?? current?.addressLine2 ?? null,
        });
        break;
      }
      case 'operations_info': {
        const dto = this.validateDto(Dto.PatchTenantOperationsInfoDto, input);
        const current = await this.store.getOperationsProfile(application.id);
        data = await this.store.upsertOperationsProfile(application.id, {
          primaryCity: dto.primaryCity ?? current?.primaryCity ?? '',
          primaryPostalCode: dto.primaryPostalCode ?? current?.primaryPostalCode ?? '',
          deliveryModel: dto.deliveryModel ?? current?.deliveryModel ?? '',
          supportsPickup: dto.supportsPickup ?? current?.supportsPickup ?? false,
          openingHoursSummary: dto.openingHoursSummary ?? current?.openingHoursSummary ?? null,
          estimatedGoLiveDate: dto.estimatedGoLiveDate
            ? new Date(dto.estimatedGoLiveDate)
            : (dto.estimatedGoLiveDate === null ? null : current?.estimatedGoLiveDate ?? null),
        });
        break;
      }
    }

    await this.store.upsertStepProgress(application.id, stepKey, 'in_progress');
    const steps = await this.store.listStepProgress(application.id);
    const currentStep = currentStepFromSteps(steps);
    const freshApplication = await this.store.findApplicationById(application.id);
    const stateToken = freshApplication ? buildStateToken(freshApplication, currentStep) : '';

    return {
      stepKey,
      status: 'in_progress' as const,
      nextStepKey: nextStepAfter(stepKey),
      stateToken,
      data,
    };
  }

  async completeStep(tenantAccountId: string, step: string) {
    const stepKey = this.assertStepKey(step);
    const application = await this.ensureEditableApplication(tenantAccountId);

    await this.assertStepReadyForCompletion(application.id, stepKey);
    await this.store.upsertStepProgress(application.id, stepKey, 'completed');

    return {
      stepKey,
      status: 'completed' as const,
      workspace: await this.getWorkspace(tenantAccountId),
    };
  }

  async uploadDocumentForCurrentTenant(tenantAccountId: string, dto: Dto.UploadTenantDocumentDto) {
    const document = await this.uploadDocument(tenantAccountId, dto);
    return {
      document,
      workspace: await this.getWorkspace(tenantAccountId),
    };
  }

  async uploadDocumentFileForCurrentTenant(
    tenantAccountId: string,
    file: UploadedTenantFile,
    dto: Dto.UploadTenantDocumentFileDto,
  ) {
    const document = await this.uploadDocumentFromFile(tenantAccountId, file, dto);
    return {
      document,
      workspace: await this.getWorkspace(tenantAccountId),
    };
  }

  async uploadDocumentFileByStateToken(
    stateToken: string,
    file: BufferedTenantFile,
    dto: Dto.UploadTenantDocumentFileDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    await this.ensureEditableApplication(application.tenantAccountId);
    this.assertAllowedDocumentFile(file);
    const persistedFile = await this.persistPublicDocumentUpload(application.tenantAccountId, file);
    const document = await this.uploadDocumentFromFile(application.tenantAccountId, persistedFile, dto);
    return {
      document,
      workspace: await this.getWorkspace(application.tenantAccountId),
    };
  }

  async submitForReview(tenantAccountId: string) {
    const application = await this.getOrCreateApplication(tenantAccountId);
    const result =
      application.status === 'revision_required'
        ? await this.resubmit(tenantAccountId)
        : await this.submit(tenantAccountId);

    return {
      application: result,
      workspace: await this.getWorkspace(tenantAccountId),
    };
  }

  async submitForReviewByStateToken(stateToken: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    return this.submitForReview(application.tenantAccountId);
  }

  async saveBusinessInfo(tenantAccountId: string, dto: Dto.UpdateTenantBusinessInfoDto) {
    const application = await this.ensureEditableApplication(tenantAccountId);
    const result = await this.store.upsertBusinessDetail(application.id, {
      ...dto,
      addressLine2: dto.addressLine2 ?? null,
      registrationNumber: dto.registrationNumber ?? null,
      taxNumber: dto.taxNumber ?? null,
    });
    await this.markStepCompleted(application.id, 'business_info');
    return result;
  }

  async saveLegalTaxInfo(tenantAccountId: string, dto: Dto.UpdateTenantLegalTaxInfoDto) {
    const application = await this.ensureEditableApplication(tenantAccountId);
    const result = await this.store.upsertLegalDetail(application.id, {
      ...dto,
      taxId: dto.taxId ?? null,
      vatId: dto.vatId ?? null,
    });
    await this.markStepCompleted(application.id, 'legal_tax_info');
    return result;
  }

  async saveOwnerContactInfo(tenantAccountId: string, dto: Dto.UpdateTenantOwnerContactInfoDto) {
    const application = await this.ensureEditableApplication(tenantAccountId);
    const result = await this.store.upsertOwnerContact(application.id, {
      ...dto,
      roleTitle: dto.roleTitle ?? null,
      ownershipPercentage: dto.ownershipPercentage ?? null,
    });
    await this.markStepCompleted(application.id, 'owner_contact_info');
    return result;
  }

  async saveOperationsInfo(tenantAccountId: string, dto: Dto.UpdateTenantOperationsInfoDto) {
    const application = await this.ensureEditableApplication(tenantAccountId);
    const result = await this.store.upsertOperationsProfile(application.id, {
      ...dto,
      openingHoursSummary: dto.openingHoursSummary ?? null,
      estimatedGoLiveDate: dto.estimatedGoLiveDate ? new Date(dto.estimatedGoLiveDate) : null,
    });
    await this.markStepCompleted(application.id, 'operations_info');
    return result;
  }

  async uploadDocument(tenantAccountId: string, dto: Dto.UploadTenantDocumentDto) {
    const application = await this.ensureEditableApplication(tenantAccountId);
    const asset = await this.fileStorageService.registerTenantUpload({
      ownerTenantId: tenantAccountId,
      originalFileName: dto.fileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      publicUrl: dto.publicUrl,
    });
    await this.store.markDocumentsNotCurrent(application.id, dto.type);
    const version = (await this.store.getLatestDocumentVersion(application.id, dto.type)) + 1;
    const document = await this.store.createDocument({
      applicationId: application.id,
      fileAssetId: asset.id,
      type: dto.type,
      status: 'pending',
      isRequired: dto.isRequired ?? true,
      version,
      isCurrent: true,
      uploadedAt: new Date(),
      reviewedAt: null,
      reviewedByAdminId: null,
      rejectionReason: null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    await this.store.upsertStepProgress(application.id, 'documents', 'completed');
    await this.auditLogService.log({
      actorType: 'tenant',
      actorId: tenantAccountId,
      action: 'document_uploaded',
      entityType: 'tenant_document',
      entityId: document.id,
      applicationId: application.id,
      tenantAccountId,
      metadata: { type: document.type, version: document.version },
    });
    return document;
  }

  async uploadDocumentFromFile(
    tenantAccountId: string,
    file: UploadedTenantFile,
    dto: Dto.UploadTenantDocumentFileDto,
  ) {
    const application = await this.ensureEditableApplication(tenantAccountId);
    const asset = await this.fileStorageService.registerTenantUpload({
      ownerTenantId: tenantAccountId,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      publicUrl: file.path,
    });
    await this.store.markDocumentsNotCurrent(application.id, dto.type);
    const version = (await this.store.getLatestDocumentVersion(application.id, dto.type)) + 1;
    const document = await this.store.createDocument({
      applicationId: application.id,
      fileAssetId: asset.id,
      type: dto.type,
      status: 'pending',
      isRequired: dto.isRequired ?? true,
      version,
      isCurrent: true,
      uploadedAt: new Date(),
      reviewedAt: null,
      reviewedByAdminId: null,
      rejectionReason: null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    await this.store.upsertStepProgress(application.id, 'documents', 'completed');
    await this.auditLogService.log({
      actorType: 'tenant',
      actorId: tenantAccountId,
      action: 'document_uploaded',
      entityType: 'tenant_document',
      entityId: document.id,
      applicationId: application.id,
      tenantAccountId,
      metadata: { type: document.type, version: document.version, fileName: file.originalname },
    });
    return document;
  }

  private assertAllowedDocumentFile(file: Pick<BufferedTenantFile, 'mimetype' | 'originalname'>) {
    const allowedExtensions = ALLOWED_DOCUMENT_FILE_TYPES[file.mimetype];
    const extension = extname(file.originalname).toLowerCase();
    if (!allowedExtensions?.includes(extension)) {
      throw new BadRequestException('Unsupported document file type. Allowed formats: PDF, JPG, JPEG, PNG.');
    }
  }

  private async persistPublicDocumentUpload(
    tenantAccountId: string,
    file: BufferedTenantFile,
  ): Promise<UploadedTenantFile> {
    const directory = join(process.cwd(), 'uploads', 'tenant-onboarding', tenantAccountId);
    await mkdir(directory, { recursive: true });
    const extension = extname(file.originalname).toLowerCase();
    const originalBase = basename(file.originalname, extname(file.originalname))
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80) || 'document';
    const path = join(directory, `${Date.now()}-${randomUUID()}-${originalBase}${extension}`);
    await writeFile(path, file.buffer, { flag: 'wx' });
    return {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path,
    };
  }

  async submit(tenantAccountId: string) {
    const application = await this.ensureEditableApplication(tenantAccountId);
    this.assertTransition(application.status, 'submitted');
    await this.assertReadyForSubmission(application.id);
    const now = new Date();
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: 'submitted',
      submittedAt: application.submittedAt ?? now,
      lastSubmittedAt: now,
      reviewStartedAt: null,
    });
    await this.store.upsertStepProgress(application.id, 'final_review', 'completed');
    await this.tenantAccountsStore.updateComplianceStatus(tenantAccountId, {
      onboardingStatus: 'submitted',
      verificationStatus: 'pending',
    });
    await this.auditLogService.log({
      actorType: 'tenant',
      actorId: tenantAccountId,
      action: 'onboarding_submitted',
      entityType: 'tenant_onboarding_application',
      entityId: updated.id,
      applicationId: updated.id,
      tenantAccountId,
    });
    return updated;
  }

  async resubmit(tenantAccountId: string) {
    const application = await this.getOrCreateApplication(tenantAccountId);
    this.assertTransition(application.status, 'submitted');
    await this.assertReadyForSubmission(application.id);
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: 'submitted',
      lastSubmittedAt: new Date(),
      revisionRequestedAt: null,
      currentRevisionNumber: application.currentRevisionNumber + 1,
    });
    await this.tenantAccountsStore.updateComplianceStatus(tenantAccountId, {
      onboardingStatus: 'submitted',
      verificationStatus: 'pending',
    });
    await this.auditLogService.log({
      actorType: 'tenant',
      actorId: tenantAccountId,
      action: 'onboarding_resubmitted',
      entityType: 'tenant_onboarding_application',
      entityId: updated.id,
      applicationId: updated.id,
      tenantAccountId,
      metadata: { revisionNumber: updated.currentRevisionNumber },
    });
    return updated;
  }

  async listApplicationsForAdmin(filters: {
    status?: TenantOnboardingApplicationStatus;
    city?: string;
    businessType?: string;
    completeness?: 'complete' | 'incomplete';
  }) {
    const applications = await this.store.listApplications();
    const results: Array<{
      application: (typeof applications)[number]['application'];
      tenantEmail: string;
      tenantCompanyName: string;
      businessCity: string | null;
      businessType: string | null;
      ownerContactName: string | null;
      ownerContactEmail: string | null;
      ownerContactPhone: string | null;
      completeness: boolean;
      documentSummary: {
        totalCurrent: number;
        pending: number;
        approved: number;
        rejected: number;
        revisionRequested: number;
        requiredCurrent: number;
        requiredApproved: number;
      };
    }> = [];
    for (const entry of applications) {
      if (filters.status && entry.application.status !== filters.status) {
        continue;
      }
      if (filters.city && entry.businessCity?.toLowerCase() !== filters.city.toLowerCase()) {
        continue;
      }
      if (filters.businessType && entry.businessType?.toLowerCase() !== filters.businessType.toLowerCase()) {
        continue;
      }
      const [isComplete, ownerContact, documents] = await Promise.all([
        this.isApplicationComplete(entry.application.id),
        this.store.getOwnerContact(entry.application.id),
        this.store.listDocuments(entry.application.id),
      ]);

      if (filters.completeness) {
        if (filters.completeness === 'complete' && !isComplete) {
          continue;
        }
        if (filters.completeness === 'incomplete' && isComplete) {
          continue;
        }
      }

      const currentDocuments = documents.filter((document) => document.isCurrent);

      results.push({
        ...entry,
        ownerContactName: ownerContact?.fullName ?? null,
        ownerContactEmail: ownerContact?.email ?? null,
        ownerContactPhone: ownerContact?.phoneNumber ?? null,
        completeness: isComplete,
        documentSummary: {
          totalCurrent: currentDocuments.length,
          pending: currentDocuments.filter((document) => document.status === 'pending').length,
          approved: currentDocuments.filter((document) => document.status === 'approved').length,
          rejected: currentDocuments.filter((document) => document.status === 'rejected').length,
          revisionRequested: currentDocuments.filter((document) => document.status === 'revision_requested').length,
          requiredCurrent: currentDocuments.filter((document) => document.isRequired).length,
          requiredApproved: currentDocuments.filter(
            (document) => document.isRequired && document.status === 'approved',
          ).length,
        },
      });
    }
    return results;
  }

  async getApplicationForAdmin(applicationId: string) {
    const application = await this.store.findApplicationById(applicationId);
    if (!application) {
      throw new NotFoundException('Tenant onboarding application not found.');
    }

    // Admin view: keep the flat shape (account + business merged in one
    // object) by reading through the dedicated lookup that joins both halves.
    const [tenantAccount, steps, businessInfo, legalTaxInfo, ownerContactInfo, operationsInfo, documents, applicationReviews, documentReviews, notes, consentSnapshots] =
      await Promise.all([
        this.store.findTenantAccountByApplicationId(application.id),
        this.store.listStepProgress(application.id),
        this.store.getBusinessDetail(application.id),
        this.store.getLegalDetail(application.id),
        this.store.getOwnerContact(application.id),
        this.store.getOperationsProfile(application.id),
        this.store.listDocuments(application.id),
        this.store.listApplicationReviews(application.id),
        this.store.listDocumentReviewsByApplication(application.id),
        this.store.listAdminNotes(application.id),
        this.store.listConsentSnapshots(application.id),
      ]);

    const documentsWithAssets = await Promise.all(
      documents.map(async (document) => {
        const fileAsset = await this.fileStorageService.getAsset(document.fileAssetId);
        return this.toAdminDocumentView(document, fileAsset);
      }),
    );
    const countryPack = await this.resolveActiveCountryPack();
    const onboardingCompliance = await this.buildComplianceSnapshotForApplication(
      application.id,
      countryPack,
      consentSnapshots,
    );

    return {
      application,
      tenantAccount,
      steps,
      businessInfo,
      legalTaxInfo,
      ownerContactInfo,
      operationsInfo,
      documents: documentsWithAssets,
      applicationReviews,
      documentReviews,
      notes,
      consentSnapshots,
      onboardingCompliance,
    };
  }

  async findApplicationForTenantAdmin(tenantAccountId: string) {
    return this.store.findApplicationByTenantId(tenantAccountId);
  }

  async listDocumentsForAdmin() {
    const documents = await this.store.listAllCurrentDocuments();

    return Promise.all(
      documents.map(async (document) => {
        const [application, tenantAccount, fileAsset] = await Promise.all([
          this.store.findApplicationById(document.applicationId),
          this.store.findTenantAccountByApplicationId(document.applicationId),
          this.fileStorageService.getAsset(document.fileAssetId),
        ]);

        const documentView = this.toAdminDocumentView(document, fileAsset);
        return {
          document: documentView,
          application,
          tenantAccount,
          fileUrl: documentView.fileUrl,
        };
      }),
    );
  }

  async getDocumentForAdmin(documentId: string) {
    const document = await this.store.findDocumentById(documentId);
    if (!document) {
      throw new NotFoundException('Tenant document not found.');
    }

    const [application, fileAsset] = await Promise.all([
      this.getApplicationForAdmin(document.applicationId),
      this.fileStorageService.getAsset(document.fileAssetId),
    ]);

    return {
      document: this.toAdminDocumentView(document, fileAsset),
      application,
    };
  }

  /**
   * Build the client-facing document URL. Locally stored files are served
   * only via the authenticated streaming endpoint — the raw filesystem path
   * (`fileAsset.publicUrl`) is NEVER returned to clients. Externally hosted
   * assets keep their absolute URL.
   */
  private toAdminDocumentFileUrl(
    documentId: string,
    asset: Pick<FileAsset, 'publicUrl'> | null | undefined,
  ): string | null {
    if (!asset) {
      return null;
    }
    if (/^https?:\/\//i.test(asset.publicUrl)) {
      return asset.publicUrl;
    }
    return `/admin/tenant-documents/${documentId}/file`;
  }

  /** Admin-facing document projection: safe metadata + streaming URL, no
   * filesystem path and no full file-asset record. */
  private toAdminDocumentView(document: TenantDocument, asset: FileAsset | null) {
    return {
      ...document,
      fileName: asset?.originalFileName ?? null,
      mimeType: asset?.mimeType ?? null,
      sizeBytes: asset?.sizeBytes ?? null,
      fileUrl: this.toAdminDocumentFileUrl(document.id, asset),
    };
  }

  /** Stream a document for an authenticated admin reviewer. */
  async streamDocumentForAdmin(documentId: string): Promise<StreamableFile> {
    const document = await this.store.findDocumentById(documentId);
    if (!document) {
      throw new NotFoundException('Tenant document not found.');
    }
    const asset = await this.fileStorageService.getAsset(document.fileAssetId);
    if (!asset) {
      throw new NotFoundException('Tenant document file not found.');
    }
    return this.fileStorageService.openDocumentStream(asset, 'inline');
  }

  /**
   * Stream a document for the owning tenant only. The document must belong to
   * the caller's own application; any other tenant's document resolves to 404
   * so document ids cannot be enumerated across tenants.
   */
  async streamOwnDocument(
    tenantAccountId: string,
    documentId: string,
  ): Promise<StreamableFile> {
    const document = await this.store.findDocumentById(documentId);
    if (!document) {
      throw new NotFoundException('Tenant document not found.');
    }
    const application = await this.store.findApplicationByTenantId(tenantAccountId);
    if (!application || application.id !== document.applicationId) {
      throw new NotFoundException('Tenant document not found.');
    }
    const asset = await this.fileStorageService.getAsset(document.fileAssetId);
    if (!asset) {
      throw new NotFoundException('Tenant document file not found.');
    }
    return this.fileStorageService.openDocumentStream(asset, 'inline');
  }

  listTenantsForAdmin(filters: {
    status?: TenantOnboardingApplicationStatus;
    city?: string;
    businessType?: string;
    completeness?: 'complete' | 'incomplete';
  }) {
    return this.listApplicationsForAdmin(filters);
  }

  async requestRevision(applicationId: string, adminId: string, note: { internalNote?: string; tenantVisibleNote?: string }) {
    const application = await this.requireApplication(applicationId);
    this.assertTransition(application.status, 'revision_required');
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: 'revision_required',
      revisionRequestedAt: new Date(),
    });
    await this.store.createApplicationReview({
      applicationId,
      adminId,
      decision: 'request_revision',
      internalNote: note.internalNote ?? null,
      tenantVisibleNote: note.tenantVisibleNote ?? null,
    });
    await this.persistNotes(applicationId, adminId, note);
    await this.tenantAccountsStore.updateComplianceStatus(updated.tenantAccountId, {
      onboardingStatus: 'revision_required',
      verificationStatus: 'pending',
    });
    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'application_revision_requested',
      entityType: 'tenant_onboarding_application',
      entityId: applicationId,
      applicationId,
      tenantAccountId: updated.tenantAccountId,
      metadata: note,
    });
    return updated;
  }

  async approveApplication(applicationId: string, adminId: string, note?: { internalNote?: string; tenantVisibleNote?: string }) {
    const application = await this.requireApplication(applicationId);
    this.assertTransition(application.status, 'approved');
    const currentRequiredDocuments = (await this.store.listDocuments(applicationId)).filter((document) => document.isCurrent && document.isRequired);
    if (currentRequiredDocuments.some((document) => document.status !== 'approved')) {
      throw new BadRequestException('All required current documents must be approved before approving the application.');
    }
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: 'approved',
      approvedAt: new Date(),
    });
    await this.store.createApplicationReview({
      applicationId,
      adminId,
      decision: 'approve',
      internalNote: note?.internalNote ?? null,
      tenantVisibleNote: note?.tenantVisibleNote ?? null,
    });
    await this.persistNotes(applicationId, adminId, note ?? {});
    await this.tenantAccountsStore.updateComplianceStatus(updated.tenantAccountId, {
      onboardingStatus: 'approved',
      verificationStatus: 'verified',
      isVerified: true,
    });
    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'application_approved',
      entityType: 'tenant_onboarding_application',
      entityId: applicationId,
      applicationId,
      tenantAccountId: updated.tenantAccountId,
      metadata: note ?? {},
    });

    // Issue the post-approval password setup magic link. Capturing delivery
    // status here lets the admin response surface "e-mail sent / delivery
    // unavailable / failed" honestly — the alternative (silent best-effort)
    // is exactly the lie this prompt's brief forbids.
    const tenant = await this.tenantAccountsStore.findById(updated.tenantAccountId);
    const needsPasswordSetup = tenant ? tenant.account.passwordHash === '' : false;
    let passwordSetup: {
      deliveryStatus: string;
      deliveryErrorCode: string | null;
      sentToEmail: string | null;
      tokenIssued: boolean;
      debugLink?: string | null;
    } | null = null;
    if (needsPasswordSetup && tenant) {
      try {
        const issued = await this.passwordSetupService.issueForTenant({
          tenantAccountId: tenant.account.id,
          createdByAdminId: adminId,
        });
        passwordSetup = {
          deliveryStatus: issued.deliveryStatus,
          deliveryErrorCode: issued.deliveryErrorCode,
          sentToEmail: issued.token.sentToEmail,
          tokenIssued: true,
          debugLink: issued.debugLink,
        };
        await this.auditLogService.log({
          actorType: 'admin',
          actorId: adminId,
          action: 'password_setup_link_issued',
          entityType: 'tenant_account',
          entityId: tenant.account.id,
          applicationId,
          tenantAccountId: tenant.account.id,
          metadata: {
            deliveryStatus: issued.deliveryStatus,
            deliveryErrorCode: issued.deliveryErrorCode,
          },
        });
      } catch (error) {
        // Production-mode fail-closed: when PASSWORD_SETUP_TOKEN_SECRET (and
        // the JWT_SECRET fallback) are not configured, issueForTenant throws
        // ServiceUnavailableException with `password_setup_unavailable`. We
        // collapse it into the passwordSetup envelope so admin UI can show a
        // config-error banner instead of bubbling a 503 up to the approve call.
        const errorCode =
          typeof (error as { response?: { code?: unknown } }).response?.code === 'string'
            ? ((error as { response: { code: string } }).response.code)
            : null;
        const isConfigUnavailable = errorCode === 'password_setup_unavailable';
        this.logger.error(
          JSON.stringify({
            event: 'password_setup_issue_failed',
            tenantAccountId: tenant.account.id,
            applicationId,
            errorCode,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        passwordSetup = {
          deliveryStatus: isConfigUnavailable ? 'unavailable' : 'failed',
          deliveryErrorCode: isConfigUnavailable ? 'secret_unavailable' : 'token_issue_threw',
          sentToEmail: tenant.account.email,
          tokenIssued: false,
        };
      }
    }
    return { ...updated, passwordSetup };
  }

  /**
   * Admin-triggered resend of the post-approval password setup magic link.
   * Honest delivery summary mirrors the approve path so the modal banner
   * works identically for both flows. The gate is "application is in a
   * post-approval state and the tenant has not yet set a password" — earlier
   * statuses (draft/submitted/under_review/revision_required/rejected) reject.
   */
  async resendPasswordSetupLink(applicationId: string, adminId: string) {
    const application = await this.requireApplication(applicationId);
    if (!['approved', 'active'].includes(application.status)) {
      throw new BadRequestException({
        message:
          'Şifre belirleme bağlantısı yalnızca onaylanmış veya aktif başvurular için yeniden gönderilebilir.',
        code: 'application_not_in_resendable_state',
      });
    }
    const tenant = await this.tenantAccountsStore.findById(application.tenantAccountId);
    if (!tenant) {
      throw new NotFoundException('Tenant account could not be found.');
    }

    let passwordSetup: {
      deliveryStatus: string;
      deliveryErrorCode: string | null;
      sentToEmail: string | null;
      tokenIssued: boolean;
      debugLink?: string | null;
    };
    try {
      const issued = await this.passwordSetupService.resendForTenant({
        tenantAccountId: tenant.account.id,
        adminId,
      });
      passwordSetup = {
        deliveryStatus: issued.deliveryStatus,
        deliveryErrorCode: issued.deliveryErrorCode,
        sentToEmail: issued.token.sentToEmail,
        tokenIssued: true,
        debugLink: issued.debugLink,
      };
      await this.auditLogService.log({
        actorType: 'admin',
        actorId: adminId,
        action: 'password_setup_link_resent',
        entityType: 'tenant_account',
        entityId: tenant.account.id,
        applicationId,
        tenantAccountId: tenant.account.id,
        metadata: {
          deliveryStatus: issued.deliveryStatus,
          deliveryErrorCode: issued.deliveryErrorCode,
        },
      });
    } catch (error) {
      const errorCode =
        typeof (error as { response?: { code?: unknown } }).response?.code === 'string'
          ? ((error as { response: { code: string } }).response.code)
          : null;
      // password_already_set / application_not_in_resendable_state are
      // expected hard rejects — re-throw so the admin sees a real 400 instead
      // of a synthetic "failed" banner. Only the config-missing case is
      // collapsed into the passwordSetup envelope (it's an operator problem,
      // not the admin's input).
      if (errorCode === 'password_setup_unavailable') {
        this.logger.error(
          JSON.stringify({
            event: 'password_setup_resend_unavailable',
            tenantAccountId: tenant.account.id,
            applicationId,
            errorCode,
          }),
        );
        return {
          passwordSetup: {
            deliveryStatus: 'unavailable',
            deliveryErrorCode: 'secret_unavailable',
            sentToEmail: tenant.account.email,
            tokenIssued: false,
          },
        };
      }
      throw error;
    }
    return { passwordSetup };
  }

  async rejectApplication(applicationId: string, adminId: string, note: { internalNote?: string; tenantVisibleNote?: string }) {
    const application = await this.requireApplication(applicationId);
    this.assertTransition(application.status, 'rejected');
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: 'rejected',
      rejectedAt: new Date(),
    });
    await this.store.createApplicationReview({
      applicationId,
      adminId,
      decision: 'reject',
      internalNote: note.internalNote ?? null,
      tenantVisibleNote: note.tenantVisibleNote ?? null,
    });
    await this.persistNotes(applicationId, adminId, note);
    await this.tenantAccountsStore.updateComplianceStatus(updated.tenantAccountId, {
      onboardingStatus: 'rejected',
      verificationStatus: 'rejected',
      isVerified: false,
    });
    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'application_rejected',
      entityType: 'tenant_onboarding_application',
      entityId: applicationId,
      applicationId,
      tenantAccountId: updated.tenantAccountId,
      metadata: note,
    });
    return updated;
  }

  async reviewDocument(documentId: string, adminId: string, decision: 'approve' | 'reject' | 'request_revision', note?: string) {
    const document = await this.store.findDocumentById(documentId);
    if (!document) {
      throw new NotFoundException('Tenant document not found.');
    }
    const updated = await this.store.updateDocumentStatus(documentId, {
      status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'revision_requested',
      reviewedAt: new Date(),
      reviewedByAdminId: adminId,
      rejectionReason: decision === 'approve' ? null : note ?? null,
      expiresAt: document.expiresAt,
    });
    await this.store.createDocumentReview({
      documentId,
      adminId,
      decision,
      note: note ?? null,
    });
    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: `document_${decision}`,
      entityType: 'tenant_document',
      entityId: documentId,
      applicationId: updated.applicationId,
      metadata: { note: note ?? null, type: updated.type },
    });
    return updated;
  }

  async activateTenant(tenantAccountId: string, adminId: string) {
    const application = await this.getOrCreateApplication(tenantAccountId);
    this.assertTransition(application.status, 'active');
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: 'active',
      activatedAt: application.activatedAt ?? new Date(),
      suspendedAt: null,
    });
    await this.tenantAccountsStore.updateComplianceStatus(tenantAccountId, {
      onboardingStatus: 'active',
      verificationStatus: 'verified',
      isActive: true,
      isVerified: true,
    });
    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_activated',
      entityType: 'tenant_account',
      entityId: tenantAccountId,
      applicationId: updated.id,
      tenantAccountId,
    });
    return updated;
  }

  async suspendTenant(tenantAccountId: string, adminId: string, reason?: string) {
    const application = await this.getOrCreateApplication(tenantAccountId);
    this.assertTransition(application.status, 'suspended');
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: 'suspended',
      suspendedAt: new Date(),
    });
    await this.tenantAccountsStore.updateComplianceStatus(tenantAccountId, {
      onboardingStatus: 'suspended',
      verificationStatus: 'verified',
      isActive: false,
    });
    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_suspended',
      entityType: 'tenant_account',
      entityId: tenantAccountId,
      applicationId: updated.id,
      tenantAccountId,
      metadata: { reason: reason ?? null },
    });
    return updated;
  }

  async reopenReview(tenantAccountId: string, adminId: string) {
    const application = await this.getOrCreateApplication(tenantAccountId);
    this.assertTransition(application.status, 'under_review');
    const updated = await this.store.updateApplicationStatus(application.id, {
      status: 'under_review',
      reviewStartedAt: new Date(),
    });
    await this.tenantAccountsStore.updateComplianceStatus(tenantAccountId, {
      onboardingStatus: 'under_review',
      verificationStatus: 'pending',
      isActive: true,
      isVerified: false,
    });
    await this.auditLogService.log({
      actorType: 'admin',
      actorId: adminId,
      action: 'tenant_review_reopened',
      entityType: 'tenant_account',
      entityId: tenantAccountId,
      applicationId: updated.id,
      tenantAccountId,
    });
    return updated;
  }

  private async persistNotes(applicationId: string, adminId: string, note: { internalNote?: string; tenantVisibleNote?: string }) {
    if (note.internalNote) {
      await this.store.createAdminNote({ applicationId, adminId, scope: 'internal', body: note.internalNote });
    }
    if (note.tenantVisibleNote) {
      await this.store.createAdminNote({ applicationId, adminId, scope: 'tenant_visible', body: note.tenantVisibleNote });
    }
  }

  private async ensureEditableApplication(tenantAccountId: string) {
    const application = await this.getOrCreateApplication(tenantAccountId);
    if (['submitted', 'under_review', 'approved', 'active', 'suspended'].includes(application.status)) {
      throw new ForbiddenException('This onboarding application cannot be edited in the current state.');
    }
    return application;
  }

  private async requireApplication(applicationId: string) {
    const application = await this.store.findApplicationById(applicationId);
    if (!application) {
      throw new NotFoundException('Tenant onboarding application not found.');
    }
    return application;
  }

  private async markStepCompleted(applicationId: string, stepKey: TenantOnboardingStepKey) {
    await this.store.upsertStepProgress(applicationId, stepKey, 'completed');
  }

  private isEditableStatus(status: TenantOnboardingApplicationStatus) {
    return !['submitted', 'under_review', 'approved', 'active', 'suspended'].includes(status);
  }

  private async canSubmitApplication(applicationId: string) {
    try {
      await this.assertReadyForSubmission(applicationId);
      return true;
    } catch {
      return false;
    }
  }

  private assertStepKey(step: string): TenantOnboardingStepKey {
    if (!tenantOnboardingStepKeys.includes(step as TenantOnboardingStepKey)) {
      throw new BadRequestException(`Unsupported onboarding step: ${step}.`);
    }

    return step as TenantOnboardingStepKey;
  }

  private assertEditableStepKey(step: string): EditableStepKey {
    const stepKey = this.assertStepKey(step);
    if (stepKey === 'final_review' || stepKey === 'documents' || stepKey === 'membership_plan') {
      throw new BadRequestException(`Draft updates are not supported for onboarding step: ${step}.`);
    }

    return stepKey;
  }

  private validateDto<T extends object>(classType: new () => T, input: object) {
    const instance = plainToInstance(classType, input);
    const errors = validateSync(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const constraints = errors.flatMap((error) => Object.values(error.constraints ?? {}));
      throw new BadRequestException({
        message: 'tenant_onboarding_validation_failed',
        errors: constraints,
      });
    }

    return instance;
  }

  private async assertStepReadyForCompletion(applicationId: string, stepKey: TenantOnboardingStepKey) {
    switch (stepKey) {
      case 'business_info': {
        const detail = await this.store.getBusinessDetail(applicationId);
        this.assertRequiredFields(detail, ['businessName', 'businessType', 'addressLine1', 'city', 'postalCode', 'country']);
        return;
      }
      case 'legal_tax_info': {
        const detail = await this.store.getLegalDetail(applicationId);
        this.assertRequiredFields(detail, ['legalEntityName', 'registrationCountry', 'registeredAddress']);
        return;
      }
      case 'owner_contact_info': {
        const detail = await this.store.getOwnerContact(applicationId);
        this.assertRequiredFields(detail, ['fullName', 'email', 'phoneNumber']);
        return;
      }
      case 'bank_details': {
        const detail = await this.store.getBankDetail(applicationId);
        this.assertRequiredFields(detail, ['bankName', 'accountHolderName', 'iban', 'currency']);
        return;
      }
      case 'billing_address': {
        const detail = await this.store.getBillingAddress(applicationId);
        this.assertRequiredFields(detail, ['billingName', 'country', 'city', 'postalCode', 'addressLine1']);
        return;
      }
      case 'membership_plan': {
        const detail = await this.store.getPlanSelection(applicationId);
        this.assertRequiredFields(detail, ['planKey', 'planNameSnapshot', 'commissionSummarySnapshot', 'currency']);
        return;
      }
      case 'operations_info': {
        const detail = await this.store.getOperationsProfile(applicationId);
        this.assertRequiredFields(detail, ['primaryCity', 'primaryPostalCode', 'deliveryModel']);
        return;
      }
      case 'documents': {
        const documents = await this.store.listDocuments(applicationId);
        const currentRequiredDocuments = documents.filter((document) => document.isCurrent && document.isRequired);
        if (currentRequiredDocuments.length === 0) {
          throw new BadRequestException('Belge adımını tamamlamadan önce en az bir zorunlu belge yüklenmelidir.');
        }
        if (currentRequiredDocuments.some((document) => ['rejected', 'revision_requested', 'expired'].includes(document.status))) {
          throw new BadRequestException('Belge adımı tamamlanmadan önce güncel zorunlu belgeler yeniden yüklenmelidir.');
        }
        return;
      }
      case 'final_review': {
        await this.assertReadyForSubmission(applicationId);
        return;
      }
    }
  }

  private assertRequiredFields<T extends object>(record: T | null, keys: Array<keyof T>) {
    if (!record) {
      throw new BadRequestException('Bu başvuru adımı henüz başlatılmadı.');
    }

    const missing = keys.filter((key) => {
      const value = record[key];
      return value === null || value === undefined || value === '';
    });

    if (missing.length > 0) {
      throw new BadRequestException({
        message: 'tenant_onboarding_step_incomplete',
        missingFields: missing,
      });
    }
  }

  private getStepData(
    summary: Awaited<ReturnType<TenantOnboardingService['getSummary']>>,
    stepKey: TenantOnboardingStepKey,
  ) {
    switch (stepKey) {
      case 'business_info':
        return summary.businessInfo;
      case 'legal_tax_info':
        return summary.legalTaxInfo;
      case 'owner_contact_info':
        return summary.ownerContactInfo;
      case 'bank_details':
        return summary.bankDetails;
      case 'billing_address':
        return summary.billingAddress;
      case 'membership_plan':
        return summary.planSelection;
      case 'operations_info':
        return summary.operationsInfo;
      case 'documents':
        return summary.documents;
      case 'final_review':
        return {
          revisionRequests: summary.revisionRequests,
          submittedAt: summary.application.submittedAt,
          lastSubmittedAt: summary.application.lastSubmittedAt,
        };
    }
  }

  private mapTenantFacingStepStatus(
    stepKey: TenantOnboardingStepKey,
    status: string,
    applicationStatus: TenantOnboardingApplicationStatus,
    documentsNeedingRevision: boolean,
  ): TenantFacingStepStatus {
    if (status === 'blocked') {
      return 'needs_revision';
    }

    if (applicationStatus === 'revision_required' && (stepKey === 'final_review' || (stepKey === 'documents' && documentsNeedingRevision))) {
      return 'needs_revision';
    }

    if (status === 'completed' || status === 'in_progress') {
      return status;
    }

    return 'not_started';
  }

  private async assertReadyForSubmission(applicationId: string) {
    const [steps, documents] = await Promise.all([
      this.store.listStepProgress(applicationId),
      this.store.listDocuments(applicationId),
    ]);
    const incomplete = tenantOnboardingStepKeys
      .filter((key) => key !== 'final_review')
      .some((key) => steps.find((step) => step.stepKey === key)?.status !== 'completed');
    if (incomplete) {
      throw new BadRequestException('Göndermeden önce tüm zorunlu başvuru adımları tamamlanmalıdır.');
    }
    const currentRequiredDocuments = documents.filter((document) => document.isCurrent && document.isRequired);
    if (currentRequiredDocuments.length === 0) {
      throw new BadRequestException('Göndermeden önce en az bir güncel zorunlu belge yüklenmelidir.');
    }
    const activePack = await this.resolveActiveCountryPack();
    const catalog = await this.resolveComplianceCatalog(
      activePack.country,
      activePack.language,
    );
    this.assertProductionConsentContent(catalog.consents);
    const snapshots = await this.store.listConsentSnapshots(applicationId);
    const missingRequiredConsent = catalog.consents.some(
      (definition) =>
        definition.required &&
        !snapshots.some(
          (snapshot) =>
            snapshot.consentKey === definition.consentKey &&
            snapshot.documentVersion === definition.documentVersion &&
            snapshot.accepted,
        ),
    );
    if (missingRequiredConsent) {
      throw new BadRequestException('Göndermeden önce tüm zorunlu başvuru onayları kabul edilmelidir.');
    }
  }

  private assertProductionConsentContent(
    consents: Array<{
      required: boolean;
      description: string;
      documentVersion: string;
      documentTitle?: string | null;
      documentBody?: string | null;
    }>,
  ) {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    const placeholderPattern = /placeholder|taslak|non-production|production de/i;
    const containsPlaceholder = consents.some(
      (consent) =>
        consent.required &&
        placeholderPattern.test(
          `${consent.documentVersion} ${consent.description} ${consent.documentTitle ?? ''} ${consent.documentBody ?? ''}`,
        ),
    );
    if (containsPlaceholder) {
      throw new ServiceUnavailableException({
        message: 'Application submission is blocked until reviewed legal consent documents are configured.',
        code: 'placeholder_legal_content',
      });
    }
  }

  private async isApplicationComplete(applicationId: string) {
    const steps = await this.store.listStepProgress(applicationId);
    return tenantOnboardingStepKeys
      .filter((key) => key !== 'final_review')
      .every((key) => steps.find((step) => step.stepKey === key)?.status === 'completed');
  }

  private assertTransition(
    currentStatus: TenantOnboardingApplicationStatus,
    targetStatus: TenantOnboardingApplicationStatus,
  ) {
    assertOnboardingTransition(currentStatus, targetStatus);
  }
}
