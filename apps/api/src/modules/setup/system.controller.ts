import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/security/decorators/public.decorator';
import { SystemStateService } from './system-state.service';

@Controller('system')
@Public()
@ApiTags('system')
export class SystemController {
  constructor(private readonly systemStateService: SystemStateService) {}

  @Get('state')
  @ApiOperation({ summary: 'Report the platform bootstrap lifecycle state.' })
  @ApiOkResponse({
    description: 'Returns the current system state.',
    schema: {
      example: { state: 'UNINITIALIZED' },
    },
  })
  getState() {
    return this.systemStateService.getState();
  }
}
