import { ForbiddenException } from '@nestjs/common';
import { CryptoUtil } from '../../common/utility/crypto-util';
import { TenantOnboardingService } from './tenant-onboarding.service';

/**
 * MR-ONBOARDING-ERROR-AND-REVISION-CLEANUP-01:
 * The public state-token resolver must never leak a raw `Forbidden` /
 * `Invalid state token.` string. Every failure mode collapses to a single
 * structured `onboarding_session_invalid` code the frontend can map to a
 * user-friendly message, while terminal-closed reads still succeed.
 */
describe('TenantOnboardingService state-token resolve error contract', () => {
  const ORIGINAL_SECRET = process.env.STATE_TOKEN_SECRET;

  beforeAll(() => {
    process.env.STATE_TOKEN_SECRET = 'test-state-token-secret';
  });

  afterAll(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.STATE_TOKEN_SECRET;
    } else {
      process.env.STATE_TOKEN_SECRET = ORIGINAL_SECRET;
    }
  });

  function makeService(findApplicationById: jest.Mock) {
    const store = { findApplicationById };
    const service = new TenantOnboardingService(
      store as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return service;
  }

  function resolve(service: TenantOnboardingService, token: string, allowTerminal?: boolean) {
    return (service as any).resolveApplicationFromStateToken(token, { allowTerminal }) as Promise<unknown>;
  }

  function buildToken(overrides: Record<string, unknown> = {}) {
    return CryptoUtil.encryptStateToken({
      applicationId: 'app-1',
      tenantAccountId: 'tenant-1',
      status: 'draft',
      currentStep: 'business_info',
      tokenSalt: 'salt-original',
      issuedAt: new Date().toISOString(),
      ...overrides,
    });
  }

  async function expectInvalidCode(promise: Promise<unknown>) {
    await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
    try {
      await promise;
    } catch (error) {
      const response = (error as ForbiddenException).getResponse() as { code?: string };
      expect(response.code).toBe('onboarding_session_invalid');
    }
  }

  it('returns a structured code (not raw Forbidden) for a malformed token', async () => {
    const service = makeService(jest.fn());
    await expectInvalidCode(resolve(service, 'not.a.realtoken'));
  });

  it('returns a structured code when the application is unknown', async () => {
    const service = makeService(jest.fn().mockResolvedValue(null));
    await expectInvalidCode(resolve(service, buildToken()));
  });

  it('returns a structured code on a token-salt mismatch (stale token)', async () => {
    const service = makeService(
      jest.fn().mockResolvedValue({
        id: 'app-1',
        tenantAccountId: 'tenant-1',
        status: 'draft',
        tokenSalt: 'salt-rotated',
      }),
    );
    await expectInvalidCode(resolve(service, buildToken({ tokenSalt: 'salt-original' })));
  });

  it('returns a structured code for a wiped-salt application without allowTerminal', async () => {
    const service = makeService(
      jest.fn().mockResolvedValue({
        id: 'app-1',
        tenantAccountId: 'tenant-1',
        status: 'approved',
        tokenSalt: null,
      }),
    );
    await expectInvalidCode(resolve(service, buildToken()));
  });

  it('allows a terminal-closed (approved) read so the tenant sees the approved screen', async () => {
    const application = {
      id: 'app-1',
      tenantAccountId: 'tenant-1',
      status: 'approved',
      tokenSalt: null,
    };
    const service = makeService(jest.fn().mockResolvedValue(application));
    await expect(resolve(service, buildToken(), true)).resolves.toBe(application);
  });
});
