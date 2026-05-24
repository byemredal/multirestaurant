import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRoles } from '../../common/security/decorators/admin-roles.decorator';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AdminRoleGuard } from '../../common/security/guards/admin-role.guard';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { AdminRole } from '../admin-auth/entities/admin-account.entity';
import { AdminTenantReviewsService } from './admin-tenant-reviews.service';
import { ReviewTenantDocumentDto } from './dto/review-document.dto';

@Controller('admin/tenant-documents')
@AuthTypes('admin')
@UseGuards(AdminRoleGuard)
@ApiBearerAuth('bearer')
@ApiTags('admin-document-reviews')
export class AdminDocumentReviewsController {
  constructor(private readonly reviewsService: AdminTenantReviewsService) {}

  @Get()
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN, AdminRole.OPERATIONS_ADMIN)
  list() {
    return this.reviewsService.listDocuments();
  }

  @Get(':id')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN, AdminRole.OPERATIONS_ADMIN)
  get(@Param('id') id: string) {
    return this.reviewsService.getDocument(id);
  }

  @Post(':id/approve')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN)
  approve(@Param('id') id: string, @Req() request: AuthenticatedRequest, @Body() dto: ReviewTenantDocumentDto) {
    return this.reviewsService.approveDocument(id, request.user.id, dto);
  }

  @Post(':id/reject')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN)
  reject(@Param('id') id: string, @Req() request: AuthenticatedRequest, @Body() dto: ReviewTenantDocumentDto) {
    return this.reviewsService.rejectDocument(id, request.user.id, dto);
  }

  @Post(':id/request-revision')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN)
  requestRevision(@Param('id') id: string, @Req() request: AuthenticatedRequest, @Body() dto: ReviewTenantDocumentDto) {
    return this.reviewsService.requestDocumentRevision(id, request.user.id, dto);
  }
}
