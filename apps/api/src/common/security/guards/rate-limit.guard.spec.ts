import { HttpException } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard public token and IP throttling', () => {
  function buildGuard(limit = 1) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        key: 'public-onboarding-test',
        limit,
        ttlMs: 60_000,
      }),
    };
    const logger = { logRateLimit: jest.fn() };
    return { guard: new RateLimitGuard(reflector as any, logger as any), logger };
  }

  function context(request: Record<string, unknown>) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as any;
  }

  it('allows an initial public request', () => {
    const { guard } = buildGuard();
    expect(
      guard.canActivate(context({ ip: '10.0.0.1', params: { stateToken: 'token-a' }, body: {} })),
    ).toBe(true);
  });

  it('throttles repeated requests from one IP even when tokens change', () => {
    const { guard } = buildGuard();
    guard.canActivate(context({ ip: '10.0.0.1', params: { stateToken: 'token-a' }, body: {} }));

    expect(() =>
      guard.canActivate(context({ ip: '10.0.0.1', params: { stateToken: 'token-b' }, body: {} })),
    ).toThrow(HttpException);
  });

  it('throttles one token even when requests use different IPs', () => {
    const { guard } = buildGuard();
    guard.canActivate(context({ ip: '10.0.0.1', params: { stateToken: 'token-a' }, body: {} }));

    expect(() =>
      guard.canActivate(context({ ip: '10.0.0.2', params: { stateToken: 'token-a' }, body: {} })),
    ).toThrow(HttpException);
  });
});
