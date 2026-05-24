import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../security/decorators/public.decorator';

@Controller()
@Public()
@ApiTags('system')
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health probe for the active API runtime.' })
  @ApiOkResponse({ description: 'Returns a lightweight summary of the running API instance.' })
  getHealth() {
    return {
      status: 'ok',
      app: 'apps/api',
      phase: 'phase-6-tenant-order-handling',
      modules: ['auth', 'tenants', 'stores', 'menu', 'cart', 'orders'],
      persistence: 'sql',
      apiPrefix: this.configService.get<string>('app.apiPrefix', 'api/v1'),
    };
  }

  @Get('ping')
  @ApiOperation({ summary: 'Simple ping endpoint.' })
  @ApiOkResponse({ description: 'Returns a pong flag and current timestamp.' })
  getPing() {
    return {
      pong: true,
      timestamp: new Date().toISOString(),
    };
  }
}
