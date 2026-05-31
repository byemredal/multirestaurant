import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { LegalConsentService } from './legal-consent.service';
import { CreateLegalDocumentDto } from './dto/create-legal-document.dto';
import { PublishDocumentVersionDto } from './dto/publish-document-version.dto';
import { UpdateLegalDocumentDto } from './dto/update-legal-document.dto';
import { PlatformLegalDocumentAudience } from './entities/platform-legal-document.entity';

@Controller('admin/legal')
@AuthTypes('admin')
@ApiTags('admin-legal')
@ApiBearerAuth('bearer')
export class AdminLegalDocumentsController {
  constructor(private readonly legalConsentService: LegalConsentService) {}

  @Get('document-types')
  @ApiOperation({ summary: 'List LegalDocumentType taxonomy entries (admin view).' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async listTypes(@Query('includeInactive') includeInactive?: string) {
    return {
      documentTypes: await this.legalConsentService.listDocumentTypes(
        includeInactive === 'true',
      ),
    };
  }

  @Get('documents')
  @ApiOperation({
    summary:
      'List PlatformLegalDocument entries bundled with their current versions.',
  })
  @ApiQuery({
    name: 'audience',
    required: false,
    enum: ['customer', 'tenant', 'all'],
  })
  @ApiQuery({ name: 'countryCode', required: false, example: 'TR' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  async listDocuments(
    @Query('audience') audience?: PlatformLegalDocumentAudience,
    @Query('countryCode') countryCode?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const normalizedCountry = countryCode?.trim().toUpperCase();
    return {
      documents: await this.legalConsentService.listDocuments({
        audience,
        countryCode:
          normalizedCountry && /^[A-Z]{2}$/.test(normalizedCountry)
            ? normalizedCountry
            : undefined,
        includeInactive: includeInactive === 'true',
      }),
    };
  }

  @Post('documents')
  @ApiOperation({ summary: 'Create a new PlatformLegalDocument header (no content yet).' })
  @ApiCreatedResponse({ description: 'New document header was created.' })
  @ApiUnauthorizedResponse({ description: 'Admin token is missing or invalid.' })
  async createDocument(
    @Body() dto: CreateLegalDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.legalConsentService.createDocument(dto, request.user.id);
  }

  @Patch('documents/:documentId')
  @ApiOperation({
    summary:
      'Update a PlatformLegalDocument header (audience / isRequired / isActive). ' +
      'Content is immutable per J-Law 10 — body changes require a new version.',
  })
  @ApiParam({ name: 'documentId' })
  async updateDocument(
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Body() dto: UpdateLegalDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.legalConsentService.updateDocument(documentId, dto, request.user.id);
  }

  @Get('documents/:documentId/versions')
  @ApiOperation({ summary: 'List versions of a PlatformLegalDocument.' })
  @ApiParam({ name: 'documentId' })
  @ApiQuery({ name: 'locale', required: false })
  async listVersions(
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Query('locale') locale?: string,
  ) {
    return {
      versions: await this.legalConsentService.listVersions(documentId, locale),
    };
  }

  @Post('documents/:documentId/versions')
  @ApiOperation({
    summary:
      'Publish a new immutable version of a PlatformLegalDocument. ' +
      'If supersedeCurrent is true (default), the previous active version is supersededAt-stamped.',
  })
  @ApiParam({ name: 'documentId' })
  @ApiCreatedResponse({ description: 'Returns the newly published version.' })
  async publishVersion(
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
    @Body() dto: PublishDocumentVersionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.legalConsentService.publishVersion(documentId, dto, request.user.id);
  }

  @Post('versions/:versionId/supersede')
  @ApiOperation({
    summary: 'Mark a version as superseded (no replacement). Triggers re-consent flow.',
  })
  @ApiParam({ name: 'versionId' })
  @ApiOkResponse({ description: 'Returns ok=true when supersession is recorded.' })
  async supersedeVersion(
    @Param('versionId', new ParseUUIDPipe({ version: '4' })) versionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.legalConsentService.supersedeVersion(versionId, request.user.id);
  }
}
