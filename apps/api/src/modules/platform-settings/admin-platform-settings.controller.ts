import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { AdminRoles } from '../../common/security/decorators/admin-roles.decorator';
import { AuthTypes } from '../../common/security/decorators/auth-types.decorator';
import { AdminRoleGuard } from '../../common/security/guards/admin-role.guard';
import { AdminRole } from '../admin-auth/entities/admin-account.entity';
import { GeoProviderId, PlatformSettingsService } from './platform-settings.service';

class UpdateGeoProviderDto {
  @IsIn(['locationiq', 'none'])
  provider: GeoProviderId;
}

@Controller('admin/platform-settings')
@AuthTypes('admin')
@UseGuards(AdminRoleGuard)
@ApiBearerAuth('bearer')
@ApiTags('admin-platform-settings')
export class AdminPlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('geo-provider')
  @AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN)
  @ApiOperation({ summary: 'Return the active geo provider + configured-status flag.' })
  @ApiOkResponse({ description: 'Current geo provider configuration.' })
  async getGeoProvider() {
    const config = await this.settings.getActiveProvider();
    // Never expose the API key value itself — only whether one is configured.
    return {
      provider: config.provider,
      apiKeyConfigured: config.apiKeyConfigured,
      active: config.active,
      availableProviders: [
        { id: 'locationiq', label: 'LocationIQ' },
        { id: 'none', label: 'Devre dışı' },
      ] as const,
    };
  }

  @Put('geo-provider')
  @AdminRoles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Set the active geo provider (admin-only).' })
  @ApiOkResponse({ description: 'Updated geo provider configuration.' })
  async setGeoProvider(@Body() dto: UpdateGeoProviderDto) {
    const config = await this.settings.setActiveProvider(dto.provider);
    return {
      provider: config.provider,
      apiKeyConfigured: config.apiKeyConfigured,
      active: config.active,
    };
  }
}
