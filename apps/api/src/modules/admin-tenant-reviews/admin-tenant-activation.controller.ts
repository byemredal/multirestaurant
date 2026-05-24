import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRoles } from '../../common/security/decorators/admin-roles.decorator';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AdminRoleGuard } from '../../common/security/guards/admin-role.guard';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import { AdminRole } from '../admin-auth/entities/admin-account.entity';
import { AdminTenantReviewsService } from './admin-tenant-reviews.service';
import { ListTenantApplicationsDto } from './dto/list-tenant-applications.dto';
import { SuspendTenantDto } from './dto/suspend-tenant.dto';

@Controller('admin/tenants')
@AuthTypes('admin')
@UseGuards(AdminRoleGuard)
@ApiBearerAuth('bearer')
@ApiTags('admin-tenant-activation')
export class AdminTenantActivationController {
  constructor(private readonly reviewsService: AdminTenantReviewsService) {}

  @Get()
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.REVIEW_ADMIN, AdminRole.OPERATIONS_ADMIN)
  list(@Query() query: ListTenantApplicationsDto) {
    return this.reviewsService.listTenants(query);
  }

  @Post(':id/activate')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  activate(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.reviewsService.activateTenant(id, request.user.id);
  }

  @Post(':id/suspend')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  suspend(@Param('id') id: string, @Req() request: AuthenticatedRequest, @Body() dto: SuspendTenantDto) {
    return this.reviewsService.suspendTenant(id, request.user.id, dto.reason);
  }

  @Post(':id/reopen-review')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.REVIEW_ADMIN)
  reopenReview(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.reviewsService.reopenReview(id, request.user.id);
  }
}
