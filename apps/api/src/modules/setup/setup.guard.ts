import { timingSafeEqual } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { BOOTSTRAP_KEY_HEADER } from './setup.constants';
import { SystemStateService } from './system-state.service';

/** Length-safe constant-time string comparison. */
function safeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Gate for protected setup endpoints. Access is granted only while the
 * platform is not yet READY and the request carries a valid bootstrap key.
 */
@Injectable()
export class SetupGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly systemStateService: SystemStateService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. Setup is closed once the platform is READY.
    if (await this.systemStateService.isReady()) {
      throw new ForbiddenException('Setup is disabled: platform is ready.');
    }

    // 2. A bootstrap key must be configured on the server.
    const expectedKey = this.configService.get<string>('app.bootstrapKey', '');
    if (!expectedKey) {
      throw new ForbiddenException(
        'Setup is unavailable: BOOTSTRAP_KEY is not configured.',
      );
    }

    // 3. The request must present a matching bootstrap key.
    const providedKey = request.headers[BOOTSTRAP_KEY_HEADER];
    if (
      typeof providedKey !== 'string' ||
      !safeEquals(providedKey, expectedKey)
    ) {
      throw new UnauthorizedException('Invalid or missing bootstrap key.');
    }

    return true;
  }
}
