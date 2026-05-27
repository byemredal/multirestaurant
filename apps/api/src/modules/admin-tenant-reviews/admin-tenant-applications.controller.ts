import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRoles } from '../../common/security/decorators/admin-roles.decorator';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AdminRoleGuard } from '../../common/security/guards/admin-role.guard';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { AdminRole } from '../admin-auth/entities/admin-account.entity';
import { AdminTenantReviewsService } from './admin-tenant-reviews.service';
import { ListTenantApplicationsDto } from './dto/list-tenant-applications.dto';
import { ReviewTenantApplicationDto } from './dto/review-application.dto';

@Controller('admin/tenant-applications')
@AuthTypes('admin')
@UseGuards(AdminRoleGuard)
@ApiBearerAuth('bearer')
@ApiTags('admin-tenant-applications')
export class AdminTenantApplicationsController {
  constructor(private readonly reviewsService: AdminTenantReviewsService) {}

  @Get()
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN, AdminRole.OPERATIONS_ADMIN)
  list(@Query() query: ListTenantApplicationsDto) {
    return this.reviewsService.listApplications(query);
  }

  @Get(':id')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN, AdminRole.OPERATIONS_ADMIN)
  get(@Param('id') id: string) {
    return this.reviewsService.getApplication(id);
  }

  @Get(':id/timeline')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN, AdminRole.OPERATIONS_ADMIN)
  getTimeline(@Param('id') id: string) {
    return this.reviewsService.getApplicationTimeline(id);
  }

  @Post(':id/request-revision')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN)
  requestRevision(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReviewTenantApplicationDto,
  ) {
    return this.reviewsService.requestRevision(id, request.user.id, dto);
  }

  @Post(':id/approve')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN)
  approve(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReviewTenantApplicationDto,
  ) {
    return this.reviewsService.approveApplication(id, request.user.id, dto);
  }

  @Post(':id/reject')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN)
  reject(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: ReviewTenantApplicationDto,
  ) {
    return this.reviewsService.rejectApplication(id, request.user.id, dto);
  }

  @Post(':id/password-setup/resend')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN)
  resendPasswordSetup(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reviewsService.resendPasswordSetupLink(id, request.user.id);
  }
}
