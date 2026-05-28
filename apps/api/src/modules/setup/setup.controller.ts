import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../common/security/decorators/public.decorator';
import { RateLimit } from '../../common/security/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../../common/security/guards/rate-limit.guard';
import { InitializePlatformDto } from './dto/initialize-platform.dto';
import { BOOTSTRAP_KEY_HEADER } from './setup.constants';
import { SetupGuard } from './setup.guard';
import { SetupService } from './setup.service';

@Controller('setup')
@Public()
@ApiTags('setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Get('status')
  @ApiOperation({ summary: 'Report whether the platform has been initialized.' })
  @ApiOkResponse({ description: 'Returns the current bootstrap status.' })
  getStatus() {
    return this.setupService.getStatus();
  }

  @Get('preflight')
  @ApiOperation({
    summary: 'Report setup preconditions and any blocking conflicts.',
  })
  @ApiOkResponse({ description: 'Returns the current setup preflight result.' })
  getPreflight() {
    return this.setupService.getPreflight();
  }

  @Post('initialize')
  @UseGuards(SetupGuard, RateLimitGuard)
  @RateLimit({ key: 'platform-setup-initialize', limit: 5, ttlMs: 60_000 })
  @HttpCode(HttpStatus.CREATED)
  @ApiHeader({
    name: BOOTSTRAP_KEY_HEADER,
    required: true,
    description: 'Bootstrap key — must match the server BOOTSTRAP_KEY.',
  })
  @ApiOperation({ summary: 'Perform the one-time platform bootstrap.' })
  @ApiCreatedResponse({ description: 'Platform initialized successfully.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing bootstrap key.' })
  @ApiForbiddenResponse({ description: 'Setup is disabled or unavailable.' })
  @ApiConflictResponse({
    description: 'Platform is already initialized or initialization is in progress.',
  })
  initialize(@Body() dto: InitializePlatformDto) {
    return this.setupService.initialize(dto);
  }
}
