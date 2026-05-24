import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { RATE_LIMIT_KEY } from '../constants';
import { RateLimitPolicy } from '../decorators/rate-limit.decorator';
import { SecurityLoggerService } from '../security-logger.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, number[]>();

  constructor(
    private readonly reflector: Reflector,
    private readonly securityLogger: SecurityLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy | undefined>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!policy) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const now = Date.now();
    const actorKey =
      request.user?.id ??
      (typeof request.body?.email === 'string' ? request.body.email.toLowerCase() : undefined) ??
      request.ip ??
      'anonymous';
    const bucketKey = `${policy.key}:${actorKey}`;
    const attempts = (this.buckets.get(bucketKey) ?? []).filter(
      (timestamp) => timestamp > now - policy.ttlMs,
    );

    if (attempts.length >= policy.limit) {
      this.securityLogger.logRateLimit({
        key: policy.key,
        path: request.originalUrl,
        method: request.method,
        ip: request.ip,
      });
      throw new HttpException(
        'Too many requests. Please wait and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    attempts.push(now);
    this.buckets.set(bucketKey, attempts);
    return true;
  }
}
