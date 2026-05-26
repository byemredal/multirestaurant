import {
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { LegalConsentService } from './legal-consent.service';
import { RecordConsentDto } from './dto/record-consent.dto';
import { UpsertMarketingConsentDto } from './dto/upsert-marketing-consent.dto';
import { CreateOrderLegalAcceptanceDto } from './dto/create-order-legal-acceptance.dto';

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

@Controller('me/legal')
@AuthTypes('customer')
@ApiTags('customer-legal')
@ApiBearerAuth('bearer')
export class CustomerLegalController {
  constructor(private readonly legalConsentService: LegalConsentService) {}

  @Post('consents')
  @ApiOperation({
    summary:
      'Record customer consent for one or more legal document versions. ' +
      'Append-only — to revoke, call again with action="revoked".',
  })
  @ApiCreatedResponse({ description: 'Returns the inserted ConsentEvent rows.' })
  @ApiUnauthorizedResponse({ description: 'Customer bearer token is missing or invalid.' })
  async recordConsent(
    @Body() dto: RecordConsentDto,
    @Req() request: AuthenticatedRequest & Request,
  ) {
    const events = await this.legalConsentService.recordConsent(
      { type: 'customer', customerAccountId: request.user.id },
      dto,
      { ipAddress: extractIp(request), userAgent: extractUserAgent(request) },
    );
    return { consents: events };
  }

  @Get('consents')
  @ApiOperation({ summary: 'List recent consent events for the authenticated customer.' })
  @ApiOkResponse({ description: 'Returns up to the last 200 consent events.' })
  async listConsents(@Req() request: AuthenticatedRequest) {
    return {
      consents: await this.legalConsentService.listConsentsForCustomer(request.user.id),
    };
  }

  @Get('re-consent-required')
  @ApiOperation({
    summary:
      'Returns the list of mandatory document codes the customer has not yet ' +
      'accepted in their latest version. UI should block checkout if missing is non-empty.',
  })
  async checkReConsent(@Req() request: AuthenticatedRequest) {
    return this.legalConsentService.requiresReConsent('customer', {
      customerAccountId: request.user.id,
    });
  }

  @Get('marketing-consents')
  @ApiOperation({
    summary:
      'Returns the latest grant/revoke snapshot per marketing channel for the customer.',
  })
  async getMarketingSnapshot(@Req() request: AuthenticatedRequest) {
    return {
      marketingConsents: await this.legalConsentService.getMarketingConsentSnapshot({
        customerAccountId: request.user.id,
      }),
    };
  }

  @Post('marketing-consents')
  @ApiOperation({
    summary:
      'Record one or more marketing consent changes (grant/revoke) per channel. Append-only.',
  })
  async upsertMarketingConsent(
    @Body() dto: UpsertMarketingConsentDto,
    @Req() request: AuthenticatedRequest & Request,
  ) {
    const consents = await this.legalConsentService.upsertMarketingConsent(
      { type: 'customer', customerAccountId: request.user.id },
      dto,
      { ipAddress: extractIp(request), userAgent: extractUserAgent(request) },
    );
    return { consents };
  }
}

@Controller('checkout/legal-acceptance')
@AuthTypes('customer')
@ApiTags('customer-checkout-legal')
@ApiBearerAuth('bearer')
export class CheckoutLegalAcceptanceController {
  constructor(private readonly legalConsentService: LegalConsentService) {}

  @Post()
  @ApiOperation({
    summary:
      'Record per-order legal acceptance (distance-sales contract + pre-information form). ' +
      'Must be called BEFORE markPaymentSuccess; otherwise CONFIRMED transition is blocked.',
  })
  @ApiCreatedResponse({ description: 'Returns the created OrderLegalAcceptance row.' })
  async createAcceptance(
    @Body() dto: CreateOrderLegalAcceptanceDto,
    @Req() request: AuthenticatedRequest & Request,
  ) {
    return this.legalConsentService.createOrderLegalAcceptance(
      request.user.id,
      dto,
      { ipAddress: extractIp(request), userAgent: extractUserAgent(request) },
    );
  }
}
