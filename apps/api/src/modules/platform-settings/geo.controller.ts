import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/security/decorators/public.decorator';
import { GeoService } from './geo.service';

@Controller('geo')
@Public()
@ApiTags('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('suggest')
  @ApiOperation({
    summary: 'Return address suggestions from the configured geo provider.',
    description:
      'Server-side proxy — the provider API key never leaves the server. ' +
      'Returns an empty list when the query is too short. Throws 503 if no ' +
      'provider is configured or the upstream is unreachable.',
  })
  @ApiOkResponse({ description: 'Provider-agnostic suggestion list.' })
  async suggest(@Query('q') q: string, @Query('country') country?: string) {
    const results = await this.geoService.suggest(q ?? '', {
      countryCode: country?.trim() || undefined,
    });
    return { results };
  }
}
