import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_KEY } from '../constants';

export interface RateLimitPolicy {
  key: string;
  limit: number;
  ttlMs: number;
}

export const RateLimit = (policy: RateLimitPolicy) =>
  SetMetadata(RATE_LIMIT_KEY, policy);
