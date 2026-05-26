import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { LegalConsentService } from './legal-consent.service';
import { RecordConsentDto } from './dto/record-consent.dto';
import { UpsertMarketingConsentDto } from './dto/upsert-marketing-consent.dto';
import { UpsertStoreTermsAddendumDto } from './dto/upsert-store-terms-addendum.dto';

function extractIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return req.ip ?? null;
}

function extractUserAgent(req: Request): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 500) : null;
}

@Controller('tenant/legal')
@AuthTypes('tenant')
@ApiTags('tenant-legal')
@ApiBearerAuth('bearer')
export class TenantLegalController {
  constructor(private readonly legalConsentService: LegalConsentService) {}

  @Post('consents')
  @ApiOperation({
    summary:
      'Record tenant consent for one or more platform legal versions. ' +
      'Used on onboarding submit and re-consent flows.',
  })
  @ApiCreatedResponse({ description: 'Returns the inserted ConsentEvent rows.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  async recordConsent(
    @Body() dto: RecordConsentDto,
    @Req() request: AuthenticatedRequest & Request,
  ) {
    const events = await this.legalConsentService.recordConsent(
      { type: 'tenant', tenantAccountId: request.user.id },
      dto,
      { ipAddress: extractIp(request), userAgent: extractUserAgent(request) },
    );
    return { consents: events };
  }

  @Get('consents')
  @ApiOperation({ summary: 'List recent consent events for the authenticated tenant.' })
  async listConsents(@Req() request: AuthenticatedRequest) {
    return {
      consents: await this.legalConsentService.listConsentsForTenant(request.user.id),
    };
  }

  @Get('re-consent-required')
  @ApiOperation({
    summary:
      'Returns the list of mandatory tenant document codes still requiring acceptance.',
  })
  async checkReConsent(@Req() request: AuthenticatedRequest) {
    return this.legalConsentService.requiresReConsent('tenant', {
      tenantAccountId: request.user.id,
    });
  }

  @Get('marketing-consents')
  @ApiOperation({ summary: 'Latest grant/revoke snapshot per marketing channel for tenant.' })
  async getMarketingSnapshot(@Req() request: AuthenticatedRequest) {
    return {
      marketingConsents: await this.legalConsentService.getMarketingConsentSnapshot({
        tenantAccountId: request.user.id,
      }),
    };
  }

  @Post('marketing-consents')
  @ApiOperation({ summary: 'Record one or more marketing consent changes for the tenant.' })
  async upsertMarketingConsent(
    @Body() dto: UpsertMarketingConsentDto,
    @Req() request: AuthenticatedRequest & Request,
  ) {
    const consents = await this.legalConsentService.upsertMarketingConsent(
      { type: 'tenant', tenantAccountId: request.user.id },
      dto,
      { ipAddress: extractIp(request), userAgent: extractUserAgent(request) },
    );
    return { consents };
  }
}

@Controller('tenant/stores/:storeId/terms-addendums')
@AuthTypes('tenant')
@ApiTags('tenant-store-terms-addendums')
@ApiBearerAuth('bearer')
export class TenantStoreTermsAddendumController {
  constructor(private readonly legalConsentService: LegalConsentService) {}

  @Get()
  @ApiOperation({ summary: 'List store terms addendums for an owned store.' })
  @ApiParam({ name: 'storeId' })
  @ApiOkResponse({ description: 'Returns addendums tied to the tenant-owned store.' })
  async list(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      addendums: await this.legalConsentService.listStoreAddendumsForOwner(
        storeId,
        request.user.id,
      ),
    };
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new store terms addendum tied to a platform document version.',
  })
  @ApiParam({ name: 'storeId' })
  @ApiCreatedResponse({ description: 'Returns the created addendum.' })
  async create(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Body() dto: UpsertStoreTermsAddendumDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.legalConsentService.createStoreAddendum(
      storeId,
      request.user.id,
      dto,
    );
  }

  @Delete(':addendumId')
  @ApiOperation({ summary: 'Deactivate (soft) a store addendum.' })
  @ApiParam({ name: 'storeId' })
  @ApiParam({ name: 'addendumId' })
  async deactivate(
    @Param('storeId', new ParseUUIDPipe({ version: '4' })) storeId: string,
    @Param('addendumId', new ParseUUIDPipe({ version: '4' })) addendumId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.legalConsentService.deactivateStoreAddendum(
      storeId,
      addendumId,
      request.user.id,
    );
  }
}
