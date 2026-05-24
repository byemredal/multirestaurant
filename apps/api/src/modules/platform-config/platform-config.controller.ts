import { Controller, Get } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/security/decorators/public.decorator';
import { PlatformConfigService } from './platform-config.service';

@Controller('config')
@Public()
@ApiTags('platform-config')
export class PlatformConfigController {
  constructor(private readonly platformConfigService: PlatformConfigService) {}

  @Get('branding')
  @ApiOperation({ summary: 'Retrieve the persisted platform branding config.' })
  @ApiOkResponse({ description: 'Returns the platform branding configuration.' })
  @ApiNotFoundResponse({ description: 'The platform is not initialized yet.' })
  getBranding() {
    return this.platformConfigService.getBranding();
  }

  @Get('country')
  @ApiOperation({ summary: 'Retrieve the current primary country config.' })
  @ApiOkResponse({ description: 'Returns the code-driven country configuration.' })
  @ApiNotFoundResponse({ description: 'The platform is not initialized yet.' })
  getCountry() {
    return this.platformConfigService.getCurrentCountry();
  }
}
