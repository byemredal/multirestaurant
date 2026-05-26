import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRoles } from '../../common/security/decorators/admin-roles.decorator';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AdminRoleGuard } from '../../common/security/guards/admin-role.guard';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { AdminRole } from '../admin-auth/entities/admin-account.entity';
import { AdminTenantReviewsService } from './admin-tenant-reviews.service';
import {
  CreateComplianceConsentDefinitionDto,
  CreateComplianceDocumentRequirementDto,
  UpdateComplianceConsentDefinitionDto,
  UpdateComplianceDocumentRequirementDto,
} from './dto/compliance-catalog.dto';

@Controller('admin/compliance-catalog')
@AuthTypes('admin')
@UseGuards(AdminRoleGuard)
@ApiBearerAuth('bearer')
@ApiTags('admin-compliance-catalog')
export class AdminComplianceCatalogController {
  constructor(private readonly reviewsService: AdminTenantReviewsService) {}

  @Get('document-requirements')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN, AdminRole.OPERATIONS_ADMIN)
  listDocumentRequirements() {
    return this.reviewsService.listComplianceDocumentRequirements();
  }

  @Post('document-requirements')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  createDocumentRequirement(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateComplianceDocumentRequirementDto,
  ) {
    return this.reviewsService.createComplianceDocumentRequirement(request.user.id, dto);
  }

  @Patch('document-requirements/:id')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  updateDocumentRequirement(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateComplianceDocumentRequirementDto,
  ) {
    return this.reviewsService.updateComplianceDocumentRequirement(id, request.user.id, dto);
  }

  @Get('consent-definitions')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN, AdminRole.OPERATIONS_ADMIN)
  listConsentDefinitions() {
    return this.reviewsService.listComplianceConsentDefinitions();
  }

  @Post('consent-definitions')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  createConsentDefinition(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateComplianceConsentDefinitionDto,
  ) {
    return this.reviewsService.createComplianceConsentDefinition(request.user.id, dto);
  }

  @Patch('consent-definitions/:id')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  updateConsentDefinition(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateComplianceConsentDefinitionDto,
  ) {
    return this.reviewsService.updateComplianceConsentDefinition(id, request.user.id, dto);
  }
}
