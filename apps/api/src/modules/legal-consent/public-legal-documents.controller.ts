import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/security/decorators/public.decorator';
import { LegalConsentService } from './legal-consent.service';
import { RecordConsentDto } from './dto/record-consent.dto';
import { PlatformLegalDocumentAudience } from './entities/platform-legal-document.entity';

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

@Controller('public/legal')
@Public()
@ApiTags('public-legal')
export class PublicLegalDocumentsController {
  constructor(private readonly legalConsentService: LegalConsentService) {}

  @Get('document-types')
  @ApiOperation({ summary: 'List active LegalDocumentType taxonomy values.' })
  @ApiOkResponse({ description: 'System-owned legal document type catalog.' })
  async listTypes() {
    return { documentTypes: await this.legalConsentService.listDocumentTypes(false) };
  }

  @Get('documents/active')
  @ApiOperation({
    summary:
      'List active legal documents bundled with their current version, optionally filtered by audience.',
  })
  @ApiQuery({
    name: 'audience',
    required: false,
    enum: ['customer', 'tenant', 'all'],
    description: 'Filter the bundle to a specific audience.',
  })
  @ApiQuery({ name: 'locale', required: false, example: 'tr' })
  async listActive(
    @Query('audience') audience?: PlatformLegalDocumentAudience,
    @Query('locale') locale?: string,
  ) {
    const documents = await this.legalConsentService.listActiveBundle(
      audience ?? 'customer',
      locale ?? 'tr',
    );
    return { documents };
  }

  @Get('documents/:code/latest')
  @ApiOperation({
    summary: 'Fetch a specific platform legal document by code with its current version.',
  })
  @ApiParam({ name: 'code', description: 'Stable document code.' })
  @ApiQuery({ name: 'locale', required: false })
  async getLatestByCode(@Param('code') code: string, @Query('locale') locale?: string) {
    return this.legalConsentService.getLatestByCode(code, locale ?? 'tr');
  }

  @Post('consents/anonymous')
  @ApiOperation({
    summary:
      'Record an anonymous consent event (used for cookie consent before login). ' +
      'Caller must supply anonymousIdentifier.',
  })
  async recordAnonymousConsent(@Body() dto: RecordConsentDto, @Req() req: Request) {
    const events = await this.legalConsentService.recordConsent(
      {
        type: 'anonymous',
        anonymousIdentifier: dto.anonymousIdentifier,
      },
      dto,
      { ipAddress: extractIp(req), userAgent: extractUserAgent(req) },
    );
    return { consents: events };
  }
}
