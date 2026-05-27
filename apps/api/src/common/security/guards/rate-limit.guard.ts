import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
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
    const actors = request.user?.id
      ? [`user:${request.user.id}`]
      : this.publicActorKeys(request);

    for (const actorKey of actors) {
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
    }
    return true;
  }

  private publicActorKeys(request: Request): string[] {
    const actors = new Set<string>([`ip:${request.ip ?? 'anonymous'}`]);
    if (typeof request.body?.email === 'string') {
      actors.add(`email:${request.body.email.trim().toLowerCase()}`);
    }
    const token =
      typeof request.params?.stateToken === 'string'
        ? request.params.stateToken
        : typeof request.params?.token === 'string'
          ? request.params.token
          : typeof request.body?.stateToken === 'string'
            ? request.body.stateToken
            : null;
    if (token) {
      actors.add(`token:${createHash('sha256').update(token).digest('hex')}`);
    }
    return [...actors];
  }
}
