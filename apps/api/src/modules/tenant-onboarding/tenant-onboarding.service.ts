import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AdminAuditLogService } from '../admin-audit-log/admin-audit-log.service';
import { TenantAccountsStore } from '../tenants/tenants.store';
import { SharedFileStorageService } from '../shared-file-storage/shared-file-storage.service';
import { EmailService } from '../notification/email.service';
import * as Dto from './dto';
import {
  tenantOnboardingStepKeys,
  TenantOnboardingApplicationStatus,
  TenantOnboardingStepKey,
} from './entities/tenant-onboarding.entity';
import { TenantOnboardingStore } from './tenant-onboarding.store';
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

type PhoneVerificationChallenge = {
  applicationId: string;
  phoneNumber: string;
  code: string;
  expiresAt: number;
  attempts: number;
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
  verification: 'verification',
  review: 'review',
  submitted: 'submitted',
  waiting: 'submitted',
  'business-info': 'location',
  'legal-tax-info': 'business-details',
  'owner-contact-info': 'authorized-person',
  'operations-info': 'plan-selection',
  documents: 'verification',
  'final-review': 'review',
};

const TERMINAL_WAITING_STATUSES = new Set<TenantOnboardingApplicationStatus>([
  'submitted',
  'under_review',
  'rejected',
  'suspended',
]);

@Injectable()
export class TenantOnboardingService {
  private readonly phoneVerificationChallenges = new Map<string, PhoneVerificationChallenge>();
  private readonly verifiedPhoneApplications = new Map<string, string>();

  constructor(
    private readonly store: TenantOnboardingStore,
    private readonly tenantAccountsStore: TenantAccountsStore,
    private readonly fileStorageService: SharedFileStorageService,
    private readonly auditLogService: AdminAuditLogService,
    private readonly emailService: EmailService,
  ) { }

  async start(dto: Dto.StartTenantOnboardingDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.tenantAccountsStore.findByEmail(email);

    if (existing) {
      const resumable =
        existing.passwordHash === '' &&
        ['draft', 'revision_required'].includes(existing.onboardingStatus);

      if (!resumable) {
        throw new ConflictException('Tenant account already exists for this email.');
      }

      const workspace = await this.getWorkspace(existing.id);
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
      phoneNumber: dto.phoneNumber,
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

    const application = await this.getOrCreateApplication(tenant.id);
    await this.seedApplicationFromStart(application.id, dto);

    const workspace = await this.getWorkspace(tenant.id);
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
    const application = await this.resolveApplicationFromStateToken(stateToken);
    return this.getWorkspace(application.tenantAccountId);
  }

  async resolveSessionByStateToken(stateToken: string, requestedStep?: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
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
      countryPack: this.getCountryPackSnapshot(workspace),
      stepData: this.getSessionStepData(workspace, normalizedRequestedStep ?? currentStep),
      workspace,
    };
  }

  async sendPhoneVerificationCodeByStateToken(stateToken: string, phoneNumber: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    const tenant = await this.tenantAccountsStore.findById(application.tenantAccountId);
    if (!tenant) {
      throw new NotFoundException('Tenant account could not be found.');
    }

    const normalizedPhoneNumber = this.normalizePhoneNumber(phoneNumber);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 10 * 60 * 1000;
    this.phoneVerificationChallenges.set(application.id, {
      applicationId: application.id,
      phoneNumber: normalizedPhoneNumber,
      code,
      expiresAt,
      attempts: 0,
    });

    await this.emailService.send({
      to: tenant.email,
      subject: 'Lieferzonen telefon doğrulama kodunuz',
      text: `Telefon doğrulama kodunuz: ${code}. Bu kod 10 dakika geçerlidir.`,
    });

    return {
      maskedPhoneNumber: this.maskPhoneNumber(normalizedPhoneNumber),
      expiresAt: new Date(expiresAt).toISOString(),
      delivery: 'email_fallback',
      debugCode: this.shouldExposeDebugVerificationCode() ? code : undefined,
    };
  }

  async verifyPhoneByStateToken(stateToken: string, code: string) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    const challenge = this.phoneVerificationChallenges.get(application.id);
    if (!challenge || challenge.expiresAt < Date.now()) {
      this.phoneVerificationChallenges.delete(application.id);
      throw new BadRequestException('Phone verification code expired.');
    }

    if (challenge.attempts >= 5) {
      this.phoneVerificationChallenges.delete(application.id);
      throw new BadRequestException('Phone verification attempts exceeded.');
    }

    if (challenge.code !== code) {
      challenge.attempts += 1;
      throw new BadRequestException('Invalid phone verification code.');
    }

    this.phoneVerificationChallenges.delete(application.id);
    this.verifiedPhoneApplications.set(application.id, challenge.phoneNumber);
    return {
      verified: true,
      workspace: await this.getWorkspace(application.tenantAccountId),
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
    await this.emailService.send({
      to: tenant.email,
      subject: 'Lieferzonen başvurunuza devam edin',
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

  private async resolveApplicationFromStateToken(stateToken: string) {
    let payload: ReturnType<typeof validateStateTokenPayload>;

    try {
      payload = validateStateTokenPayload(CryptoUtil.decryptStateToken(stateToken));
    } catch {
      throw new ForbiddenException('Invalid state token.');
    }

    const application = await this.store.findApplicationById(payload.applicationId);
    if (!application || application.tenantAccountId !== payload.tenantAccountId) {
      throw new ForbiddenException('Invalid state token.');
    }

    if (!application.tokenSalt || application.tokenSalt !== payload.tokenSalt) {
      throw new ForbiddenException('Invalid state token.');
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
    if (TERMINAL_WAITING_STATUSES.has(workspace.application.status)) {
      return 'submitted';
    }

    if (!workspace.phoneVerification?.verified) {
      return 'phone-verification';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'business_info')) {
      return 'location';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'legal_tax_info')) {
      return 'business-details';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'owner_contact_info')) {
      return 'authorized-person';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'operations_info')) {
      return 'plan-selection';
    }

    if (!this.isWorkspaceStepCompleted(workspace, 'documents')) {
      return 'verification';
    }

    return 'review';
  }

  private getAllowedSessionSteps(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ): OnboardingSessionStepKey[] {
    if (TERMINAL_WAITING_STATUSES.has(workspace.application.status)) {
      return ['submitted'];
    }

    const allowed = new Set<OnboardingSessionStepKey>(['phone-verification']);

    if (!workspace.phoneVerification?.verified) {
      // The OTP page is a canonical V2 route, but the legacy UI still renders
      // phone send + code verification together.
      allowed.add('otp');
      return ONBOARDING_SESSION_STEP_ORDER.filter((step) => allowed.has(step));
    }

    allowed.add('otp');
    allowed.add('welcome');

    allowed.add('location');
    if (this.isWorkspaceStepCompleted(workspace, 'business_info')) {
      allowed.add('address');
      allowed.add('business-details');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'legal_tax_info')) {
      allowed.add('authorized-person');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'owner_contact_info')) {
      allowed.add('bank-details');
      allowed.add('billing-address');
      allowed.add('plan-selection');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'operations_info')) {
      allowed.add('verification');
    }

    if (this.isWorkspaceStepCompleted(workspace, 'documents')) {
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

    if (this.isWorkspaceStepCompleted(workspace, 'operations_info')) {
      completed.add('bank-details');
      completed.add('billing-address');
      completed.add('plan-selection');
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

  private getCountryPackSnapshot(
    workspace: Awaited<ReturnType<TenantOnboardingService['getWorkspace']>>,
  ) {
    const businessInfo = workspace.steps.find((step) => step.stepKey === 'business_info')?.data as
      | { country?: string | null }
      | null
      | undefined;
    const countryCandidate = businessInfo?.country?.trim().toUpperCase();
    const country = countryCandidate && /^[A-Z]{2}$/.test(countryCandidate)
      ? countryCandidate
      : 'CH';

    return {
      country,
      language: country === 'CH' ? 'de-CH' : 'de-CH',
      currency: country === 'CH' ? 'CHF' : 'CHF',
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
      'plan-selection': 'operations_info',
      verification: 'documents',
      review: 'final_review',
    };
    const backendStep = backendStepBySessionStep[step];

    return backendStep
      ? workspace.steps.find((entry) => entry.stepKey === backendStep)?.data ?? null
      : null;
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

  private shouldExposeDebugVerificationCode() {
    return process.env.NODE_ENV !== 'production' || process.env.EMAIL_TRANSPORT === 'log';
  }

  async getSummary(tenantAccountId: string) {
    const application = await this.getOrCreateApplication(tenantAccountId);
    const [steps, businessInfo, legalTaxInfo, ownerContactInfo, operationsInfo, documents, reviews, notes] =
      await Promise.all([
        this.store.listStepProgress(application.id),
        this.store.getBusinessDetail(application.id),
        this.store.getLegalDetail(application.id),
        this.store.getOwnerContact(application.id),
        this.store.getOperationsProfile(application.id),
        this.store.listDocuments(application.id),
        this.store.listApplicationReviews(application.id),
        this.store.listAdminNotes(application.id),
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
      operationsInfo,
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

    return {
      application: {
        ...summary.application,
        stateToken,
      },
      phoneVerification: {
        verified: this.verifiedPhoneApplications.has(summary.application.id),
        phoneNumber: this.verifiedPhoneApplications.get(summary.application.id) ?? null,
      },
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
    file: UploadedTenantFile,
    dto: Dto.UploadTenantDocumentFileDto,
  ) {
    const application = await this.resolveApplicationFromStateToken(stateToken);
    const document = await this.uploadDocumentFromFile(application.tenantAccountId, file, dto);
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

    const [tenantAccount, steps, businessInfo, legalTaxInfo, ownerContactInfo, operationsInfo, documents, applicationReviews, documentReviews, notes] =
      await Promise.all([
        this.tenantAccountsStore.findById(application.tenantAccountId),
        this.store.listStepProgress(application.id),
        this.store.getBusinessDetail(application.id),
        this.store.getLegalDetail(application.id),
        this.store.getOwnerContact(application.id),
        this.store.getOperationsProfile(application.id),
        this.store.listDocuments(application.id),
        this.store.listApplicationReviews(application.id),
        this.store.listDocumentReviewsByApplication(application.id),
        this.store.listAdminNotes(application.id),
      ]);

    const documentsWithAssets = await Promise.all(
      documents.map(async (document) => {
        const fileAsset = await this.fileStorageService.getAsset(document.fileAssetId);

        return {
          ...document,
          fileAsset,
          fileUrl: fileAsset?.publicUrl ?? null,
        };
      }),
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

        return {
          document,
          application,
          tenantAccount,
          fileAsset,
          fileUrl: fileAsset?.publicUrl ?? null,
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
      document: {
        ...document,
        fileAsset,
        fileUrl: fileAsset?.publicUrl ?? null,
      },
      application,
    };
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
    return updated;
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
    if (stepKey === 'final_review' || stepKey === 'documents') {
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
      case 'operations_info': {
        const detail = await this.store.getOperationsProfile(applicationId);
        this.assertRequiredFields(detail, ['primaryCity', 'primaryPostalCode', 'deliveryModel']);
        return;
      }
      case 'documents': {
        const documents = await this.store.listDocuments(applicationId);
        const currentRequiredDocuments = documents.filter((document) => document.isCurrent && document.isRequired);
        if (currentRequiredDocuments.length === 0) {
          throw new BadRequestException('At least one required document must be uploaded before completing the documents step.');
        }
        if (currentRequiredDocuments.some((document) => ['rejected', 'revision_requested', 'expired'].includes(document.status))) {
          throw new BadRequestException('Current required documents must be re-uploaded before the documents step can be completed.');
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
      throw new BadRequestException('This onboarding step has not been started yet.');
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
      throw new BadRequestException('All required onboarding steps must be completed before submission.');
    }
    const currentRequiredDocuments = documents.filter((document) => document.isCurrent && document.isRequired);
    if (currentRequiredDocuments.length === 0) {
      throw new BadRequestException('At least one required current document must be uploaded before submission.');
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
