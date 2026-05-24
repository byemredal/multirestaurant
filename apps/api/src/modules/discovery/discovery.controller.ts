import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../common/security/decorators/public.decorator';
import { DiscoveryService } from './discovery.service';
import {
  CreateSessionAddressDto,
  DiscoverRestaurantsDto,
} from './dto/discovery.dto';

/**
 * Public customer-facing discovery surface. Anonymous: store a session address,
 * then discover restaurants. Authenticated clients resolve the customer's
 * default address (see CustomerAddressController) and pass it to `restaurants`.
 */
@Controller('public/discovery')
@Public()
@ApiTags('public-discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Post('session-address')
  @ApiOperation({
    summary: 'Store a postal code / address for an anonymous visitor.',
  })
  @ApiCreatedResponse({
    description: 'Returns the opaque session token and the normalized address.',
  })
  createSessionAddress(@Body() dto: CreateSessionAddressDto) {
    return this.discoveryService.createSessionAddress(dto);
  }

  @Get('session-address/:token')
  @ApiOperation({ summary: 'Re-read a previously stored session address.' })
  @ApiParam({ name: 'token', description: 'Opaque session token.' })
  @ApiOkResponse({ description: 'Returns the stored session address.' })
  @ApiNotFoundResponse({ description: 'Session address not found or expired.' })
  getSessionAddress(@Param('token') token: string) {
    return this.discoveryService.getSessionAddress(token);
  }

  @Get('restaurants')
  @ApiOperation({
    summary: 'Discover restaurants that can deliver to a given location.',
  })
  @ApiOkResponse({
    description:
      'Returns ranked eligible restaurants with coverage, availability and ranking detail.',
  })
  discover(@Query() query: DiscoverRestaurantsDto) {
    return this.discoveryService.discover(query);
  }
}
