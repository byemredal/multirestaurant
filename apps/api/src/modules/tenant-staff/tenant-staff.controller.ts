import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AuthenticatedRequest } from '../../common/types/authenticated-request.interface';
import {
  InviteStaffDto,
  UpdateStaffDto,
} from './dto/invite-staff.dto';
import { TenantStaffService } from './tenant-staff.service';

@Controller('tenants/me/staff')
@AuthTypes('tenant')
@ApiTags('tenant-staff')
@ApiBearerAuth('bearer')
export class TenantStaffController {
  constructor(private readonly tenantStaffService: TenantStaffService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite a staff member.',
    description:
      'Creates an invited StaffAccount (passwordHash NULL) plus initial ' +
      'StaffMembership rows, and issues a single-use invite token returned ' +
      'exactly once in the response.',
  })
  @ApiBody({ type: InviteStaffDto })
  @ApiOkResponse({ description: 'Returns the new staff record + one-shot invite token.' })
  @ApiUnauthorizedResponse({ description: 'Tenant bearer token is missing or invalid.' })
  invite(@Req() request: AuthenticatedRequest, @Body() dto: InviteStaffDto) {
    return this.tenantStaffService.invite(request.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List staff for the authenticated tenant.' })
  list(@Req() request: AuthenticatedRequest) {
    return this.tenantStaffService.list(request.user.id);
  }

  @Get(':staffId')
  @ApiOperation({ summary: 'Get sanitized staff detail.' })
  getOne(
    @Param('staffId', new ParseUUIDPipe({ version: '4' })) staffId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tenantStaffService.getOne(request.user.id, staffId);
  }

  @Patch(':staffId')
  @ApiOperation({ summary: 'Update staff profile + memberships.' })
  @ApiBody({ type: UpdateStaffDto })
  update(
    @Param('staffId', new ParseUUIDPipe({ version: '4' })) staffId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateStaffDto,
  ) {
    return this.tenantStaffService.update(request.user.id, staffId, dto);
  }

  @Post(':staffId/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-deactivate a staff account.',
    description:
      'Sets isActive=false and employmentStatus=suspended. Hard delete is ' +
      'intentionally not exposed so audit/security history survives.',
  })
  deactivate(
    @Param('staffId', new ParseUUIDPipe({ version: '4' })) staffId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tenantStaffService.deactivate(request.user.id, staffId);
  }

  @Post(':staffId/invite/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue a fresh invite token (rotates any prior unused token).',
  })
  resendInvite(
    @Param('staffId', new ParseUUIDPipe({ version: '4' })) staffId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tenantStaffService.resendInvite(request.user.id, staffId);
  }
}
