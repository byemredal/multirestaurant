import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { mkdirSync } from 'fs';
import { diskStorage, memoryStorage } from 'multer';
import { basename, extname, join } from 'path';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { Public } from '../../common/security/decorators/public.decorator';
import { RateLimit } from '../../common/security/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/security/guards/rate-limit.guard';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import * as Dto from './dto';
import { TenantOnboardingService } from './tenant-onboarding.service';

type PatchTenantStepDto =
  | Dto.PatchTenantBusinessInfoDto
  | Dto.PatchTenantLegalTaxInfoDto
  | Dto.PatchTenantOwnerContactInfoDto
  | Dto.PatchTenantOperationsInfoDto;

function sanitizeFileName(value: string) {
  return basename(value).replace(/[^a-zA-Z0-9._-]/g, '_');
}

@Controller('v2/tenant/onboarding')
@AuthTypes('tenant')
@UseGuards(RateLimitGuard)
@RateLimit({ key: 'tenant-onboarding-v2', limit: 120, ttlMs: 60_000 })
@ApiBearerAuth('bearer')
@ApiTags('tenant-onboarding')
export class TenantOnboardingController {
  constructor(private readonly onboardingService: TenantOnboardingService) {}

  @Public()
  @Post('start')
  @RateLimit({ key: 'tenant-onboarding-v2-start', limit: 5, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Start a stateless tenant onboarding application.' })
  start(@Req() request: AuthenticatedRequest, @Body() dto: Dto.StartTenantOnboardingDto) {
    return this.onboardingService.start(dto, {
      ipAddress: this.extractClientIp(request),
      userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null,
    });
  }

  private extractClientIp(request: AuthenticatedRequest): string | null {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0]!.trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0]!.split(',')[0]!.trim();
    }
    return (request as { ip?: string }).ip ?? null;
  }

  @Public()
  @Post('phone-verification/send')
  @RateLimit({ key: 'tenant-onboarding-v2-phone-send', limit: 5, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Send a tenant onboarding phone verification code by token body.' })
  sendPhoneVerificationCodeFromBody(
    @Body() dto: Dto.SendTenantOnboardingPhoneVerificationByTokenDto,
  ) {
    return this.onboardingService.sendPhoneVerificationCodeByStateToken(
      dto.stateToken,
      dto.phoneNumber,
    );
  }

  @Public()
  @Post('phone-verification/verify')
  @RateLimit({ key: 'tenant-onboarding-v2-phone-verify', limit: 10, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Verify a tenant onboarding phone verification code by token body.' })
  verifyPhoneVerificationCodeFromBody(
    @Body() dto: Dto.VerifyTenantOnboardingPhoneByTokenDto,
  ) {
    return this.onboardingService.verifyPhoneByStateToken(dto.stateToken, dto.code);
  }

  @Public()
  @Get(':stateToken/workspace')
  @ApiOperation({ summary: 'Get the tenant onboarding workspace by state token.' })
  getWorkspaceByStateToken(@Param('stateToken') stateToken: string) {
    return this.onboardingService.resolveStateToken(stateToken);
  }

  @Public()
  @Get(':stateToken/session')
  @ApiOperation({ summary: 'Resolve a tenant onboarding session and requested step by state token.' })
  getSessionByStateToken(
    @Param('stateToken') stateToken: string,
    @Query('step') requestedStep?: string,
  ) {
    return this.onboardingService.resolveSessionByStateToken(stateToken, requestedStep);
  }

  @Public()
  @Post(':stateToken/phone-verification/send')
  @RateLimit({ key: 'tenant-onboarding-v2-phone-send', limit: 5, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Send a tenant onboarding phone verification code.' })
  sendPhoneVerificationCode(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.SendTenantOnboardingPhoneVerificationDto,
  ) {
    return this.onboardingService.sendPhoneVerificationCodeByStateToken(
      stateToken,
      dto.phoneNumber,
    );
  }

  @Public()
  @Post(':stateToken/phone/send-code')
  @RateLimit({ key: 'tenant-onboarding-v2-phone-send', limit: 5, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Send a tenant onboarding phone verification code for the V2 phone step.' })
  sendPhoneCode(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.SendTenantOnboardingPhoneVerificationDto,
  ) {
    return this.onboardingService.sendPhoneVerificationCodeByStateToken(
      stateToken,
      dto.phoneNumber,
    );
  }

  @Public()
  @Post(':stateToken/phone/resend-code')
  @RateLimit({ key: 'tenant-onboarding-v2-phone-resend', limit: 3, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Resend a tenant onboarding phone verification code for the V2 OTP step.' })
  resendPhoneCode(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.ResendTenantOnboardingPhoneVerificationDto,
  ) {
    return this.onboardingService.resendPhoneVerificationCodeByStateToken(
      stateToken,
      dto.phoneNumber,
    );
  }

  @Public()
  @Post(':stateToken/phone-verification/verify')
  @RateLimit({ key: 'tenant-onboarding-v2-phone-verify', limit: 10, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Verify a tenant onboarding phone verification code.' })
  verifyPhoneVerificationCode(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.VerifyTenantOnboardingPhoneDto,
  ) {
    return this.onboardingService.verifyPhoneByStateToken(stateToken, dto.code);
  }

  @Public()
  @Post(':stateToken/phone/verify-code')
  @RateLimit({ key: 'tenant-onboarding-v2-phone-verify', limit: 10, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Verify a tenant onboarding phone verification code for the V2 OTP step.' })
  verifyPhoneCode(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.VerifyTenantOnboardingPhoneDto,
  ) {
    return this.onboardingService.verifyPhoneByStateToken(stateToken, dto.code);
  }

  @Public()
  @Post(':stateToken/continue-link/email')
  @RateLimit({ key: 'tenant-onboarding-v2-continue-email', limit: 3, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Email the tenant onboarding continuation link.' })
  sendContinueLinkEmail(@Param('stateToken') stateToken: string) {
    return this.onboardingService.sendContinueLinkByStateToken(stateToken);
  }

  @Public()
  @Post(':stateToken/welcome/complete')
  @ApiOperation({ summary: 'Complete the informational V2 welcome step.' })
  completeWelcome(@Param('stateToken') stateToken: string) {
    return this.onboardingService.completeWelcomeByStateToken(stateToken);
  }

  @Public()
  @Post(':stateToken/location')
  @ApiOperation({ summary: 'Save the V2 onboarding location search selection.' })
  saveLocationSelection(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.SaveTenantOnboardingLocationSelectionDto,
  ) {
    return this.onboardingService.saveLocationSelectionByStateToken(stateToken, dto);
  }

  @Public()
  @Post(':stateToken/address')
  @ApiOperation({ summary: 'Save and complete the V2 onboarding address step.' })
  saveAddress(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.SaveTenantOnboardingAddressDto,
  ) {
    return this.onboardingService.saveAddressByStateToken(stateToken, dto);
  }

  @Public()
  @Post(':stateToken/business-details/verify-registration')
  @ApiOperation({ summary: 'Mock-verify the V2 onboarding business registration number.' })
  verifyBusinessRegistration(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.VerifyTenantOnboardingBusinessRegistrationDto,
  ) {
    return this.onboardingService.verifyBusinessRegistrationByStateToken(stateToken, dto);
  }

  @Public()
  @Post(':stateToken/business-details')
  @ApiOperation({ summary: 'Save and complete the V2 onboarding business details step.' })
  saveBusinessDetails(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.SaveTenantOnboardingBusinessDetailsDto,
  ) {
    return this.onboardingService.saveBusinessDetailsByStateToken(stateToken, dto);
  }

  @Public()
  @Post(':stateToken/authorized-person')
  @ApiOperation({ summary: 'Save and complete the V2 onboarding authorized person step.' })
  saveAuthorizedPerson(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.SaveTenantOnboardingAuthorizedPersonDto,
  ) {
    return this.onboardingService.saveAuthorizedPersonByStateToken(stateToken, dto);
  }

  @Public()
  @Post(':stateToken/bank-details')
  @ApiOperation({ summary: 'Save and complete the V2 onboarding bank details step.' })
  saveBankDetails(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.SaveTenantOnboardingBankDetailsDto,
  ) {
    return this.onboardingService.saveBankDetailsByStateToken(stateToken, dto);
  }

  @Public()
  @Post(':stateToken/billing-address')
  @ApiOperation({ summary: 'Save and complete the V2 onboarding billing address step.' })
  saveBillingAddress(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.SaveTenantOnboardingBillingAddressDto,
  ) {
    return this.onboardingService.saveBillingAddressByStateToken(stateToken, dto);
  }

  @Public()
  @Get(':stateToken/plans')
  @ApiOperation({ summary: 'List the configurable placeholder plan catalog for V2 onboarding.' })
  getPlans(@Param('stateToken') stateToken: string) {
    return this.onboardingService.getPlansByStateToken(stateToken);
  }

  @Public()
  @Post(':stateToken/plan-selection')
  @ApiOperation({ summary: 'Save and complete the V2 onboarding plan selection step.' })
  savePlanSelection(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.SaveTenantOnboardingPlanSelectionDto,
  ) {
    return this.onboardingService.savePlanSelectionByStateToken(stateToken, dto);
  }

  @Public()
  @Post(':stateToken/operations')
  @ApiOperation({ summary: 'Save and complete the V2 onboarding operations requirements step.' })
  saveOperations(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.UpdateTenantOperationsInfoDto,
  ) {
    return this.onboardingService.saveOperationsByStateToken(stateToken, dto);
  }

  @Public()
  @Get(':stateToken/review')
  @ApiOperation({ summary: 'Get the V2 onboarding review summary before submission.' })
  getReview(@Param('stateToken') stateToken: string) {
    return this.onboardingService.getReviewByStateToken(stateToken);
  }

  @Public()
  @Get(':stateToken/consents')
  @ApiOperation({ summary: 'Get country-pack document guidance and onboarding consent definitions.' })
  getConsents(@Param('stateToken') stateToken: string) {
    return this.onboardingService.getConsentsByStateToken(stateToken);
  }

  @Public()
  @Post(':stateToken/consents')
  @ApiOperation({ summary: 'Persist accepted onboarding consent snapshots before submission.' })
  saveConsents(
    @Param('stateToken') stateToken: string,
    @Body() dto: Dto.SaveTenantOnboardingConsentsDto,
  ) {
    return this.onboardingService.saveConsentsByStateToken(stateToken, dto);
  }

  @Public()
  @Patch(':stateToken/steps/:stepKey')
  @ApiOperation({ summary: 'Save a tenant onboarding step draft by state token.' })
  patchStepByStateToken(
    @Param('stateToken') stateToken: string,
    @Param('stepKey') stepKey: string,
    @Body() dto: PatchTenantStepDto,
  ) {
    return this.onboardingService.saveStepDraftByStateToken(stateToken, stepKey, dto);
  }

  @Public()
  @Post(':stateToken/steps/:stepKey/complete')
  @ApiOperation({ summary: 'Complete a tenant onboarding step by state token.' })
  completeStepByStateToken(
    @Param('stateToken') stateToken: string,
    @Param('stepKey') stepKey: string,
  ) {
    return this.onboardingService.completeStepByStateToken(stateToken, stepKey);
  }

  @Public()
  @Post(':stateToken/documents/upload')
  @RateLimit({ key: 'tenant-onboarding-v2-document-upload', limit: 10, ttlMs: 60_000 })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      // Public uploads stay in memory until the state token and editable
      // application state have been validated by the service.
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadDocumentFileByStateToken(
    @Param('stateToken') stateToken: string,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    @Body() body: Record<string, string | boolean | undefined>,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required.');
    }

    return this.onboardingService.uploadDocumentFileByStateToken(stateToken, file, {
      type: String(body.type ?? ''),
      isRequired:
        body.isRequired === undefined
          ? true
          : body.isRequired === true || body.isRequired === 'true' || body.isRequired === 'on',
      expiresAt: body.expiresAt ? String(body.expiresAt) : undefined,
    });
  }

  @Public()
  @Post(':stateToken/submit')
  @RateLimit({ key: 'tenant-onboarding-v2-submit', limit: 5, ttlMs: 60_000 })
  @ApiOperation({ summary: 'Submit tenant onboarding for review by state token.' })
  submitForReviewByStateToken(@Param('stateToken') stateToken: string) {
    return this.onboardingService.submitForReviewByStateToken(stateToken);
  }

  @Get()
  @ApiOperation({ summary: 'Get the tenant onboarding summary and studio gating state.' })
  getSummary(@Req() request: AuthenticatedRequest) {
    return this.onboardingService.getSummary(request.user.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated tenant onboarding workspace.' })
  getWorkspace(@Req() request: AuthenticatedRequest) {
    return this.onboardingService.getWorkspace(request.user.id);
  }

  @Get('steps')
  getSteps(@Req() request: AuthenticatedRequest) {
    return this.onboardingService.getSteps(request.user.id);
  }

  @Patch('me/:step')
  patchStep(
    @Req() request: AuthenticatedRequest,
    @Param('step') step: string,
    @Body() dto: PatchTenantStepDto,
  ) {
    return this.onboardingService.saveStepDraft(request.user.id, step, dto);
  }

  @Post('me/:step/complete')
  completeStep(@Req() request: AuthenticatedRequest, @Param('step') step: string) {
    return this.onboardingService.completeStep(request.user.id, step);
  }

  @Post('me/documents')
  uploadDocumentForCurrentTenant(
    @Req() request: AuthenticatedRequest,
    @Body() dto: Dto.UploadTenantDocumentDto,
  ) {
    return this.onboardingService.uploadDocumentForCurrentTenant(request.user.id, dto);
  }

  @Post('me/documents/upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (request, _file, callback) => {
          const tenantId = (request as AuthenticatedRequest).user?.id ?? 'anonymous';
          const directory = join(process.cwd(), 'uploads', 'tenant-onboarding', tenantId);
          mkdirSync(directory, { recursive: true });
          callback(null, directory);
        },
        filename: (_request, file, callback) => {
          const extension = extname(file.originalname);
          const baseName = sanitizeFileName(file.originalname.replace(extension, ''));
          callback(null, `${Date.now()}-${baseName}${extension}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadDocumentFileForCurrentTenant(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; path: string },
    @Body() body: Record<string, string | boolean | undefined>,
  ) {
    if (!file) {
      throw new BadRequestException('Document file is required.');
    }

    return this.onboardingService.uploadDocumentFileForCurrentTenant(request.user.id, file, {
      type: String(body.type ?? ''),
      isRequired:
        body.isRequired === undefined
          ? true
          : body.isRequired === true || body.isRequired === 'true' || body.isRequired === 'on',
      expiresAt: body.expiresAt ? String(body.expiresAt) : undefined,
    });
  }

  @Get('me/documents/:documentId/file')
  @ApiOperation({ summary: "Stream one of the authenticated tenant's own onboarding documents." })
  streamOwnDocument(
    @Req() request: AuthenticatedRequest,
    @Param('documentId') documentId: string,
  ) {
    return this.onboardingService.streamOwnDocument(request.user.id, documentId);
  }

  @Post('me/submit')
  submitForReview(@Req() request: AuthenticatedRequest) {
    return this.onboardingService.submitForReview(request.user.id);
  }

  @Put('business-info')
  saveBusinessInfo(
    @Req() request: AuthenticatedRequest,
    @Body() dto: Dto.UpdateTenantBusinessInfoDto,
  ) {
    return this.onboardingService.saveBusinessInfo(request.user.id, dto);
  }

  @Put('legal-tax-info')
  saveLegalTaxInfo(
    @Req() request: AuthenticatedRequest,
    @Body() dto: Dto.UpdateTenantLegalTaxInfoDto,
  ) {
    return this.onboardingService.saveLegalTaxInfo(request.user.id, dto);
  }

  @Put('owner-contact-info')
  saveOwnerContactInfo(
    @Req() request: AuthenticatedRequest,
    @Body() dto: Dto.UpdateTenantOwnerContactInfoDto,
  ) {
    return this.onboardingService.saveOwnerContactInfo(request.user.id, dto);
  }

  @Put('operations-info')
  saveOperationsInfo(
    @Req() request: AuthenticatedRequest,
    @Body() dto: Dto.UpdateTenantOperationsInfoDto,
  ) {
    return this.onboardingService.saveOperationsInfo(request.user.id, dto);
  }

  @Post('documents')
  uploadDocument(@Req() request: AuthenticatedRequest, @Body() dto: Dto.UploadTenantDocumentDto) {
    return this.onboardingService.uploadDocument(request.user.id, dto);
  }

  @Post('submit')
  submit(@Req() request: AuthenticatedRequest) {
    return this.onboardingService.submit(request.user.id);
  }

  @Post('resubmit')
  resubmit(@Req() request: AuthenticatedRequest) {
    return this.onboardingService.resubmit(request.user.id);
  }
}
