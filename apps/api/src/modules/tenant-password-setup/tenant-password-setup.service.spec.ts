import { BadRequestException } from '@nestjs/common';
import { TenantPasswordSetupService } from './tenant-password-setup.service';
import type {
  PasswordSetupTokenRow,
  TenantPasswordSetupStore,
} from './tenant-password-setup.store';
import type { TenantAccountsStore } from '../tenants/tenants.store';
import type { PasswordService } from '../../common/security/password.service';
import type { EmailService } from '../notification/email.service';
import type { SetupStore } from '../setup/setup.store';

/**
 * Per-tenant resend cooldown — the 01-HARDENING addition that prevents an
 * admin double-click from rotating the password setup token (and silently
 * invalidating the link still in the partner's inbox) on every request.
 *
 * We mock only what the cooldown branch needs: the tenant lookup (must
 * return a tenant whose password is NOT yet set) and the "latest token for
 * this tenant" lookup. The cooldown rejection throws BEFORE any e-mail
 * provider call, so EmailService/PasswordService/SetupStore are inert mocks.
 */
describe('TenantPasswordSetupService.resendForTenant — cooldown', () => {
  const originalEnv = { ...process.env };
  const tenantAccountId = 'tenant-1';

  const buildTenant = () => ({
    account: {
      id: tenantAccountId,
      email: 'partner@example.com',
      passwordHash: '',
      phoneNumber: '+41761234567',
      firstName: 'Pat',
    },
  });

  const baseTokenRow = (createdAt: Date): PasswordSetupTokenRow => ({
    id: 'token-1',
    tenantAccountId,
    tokenHash: 'hash',
    purpose: 'initial_password_setup',
    expiresAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
    consumedAt: null,
    createdByAdminId: 'admin-1',
    sentToEmail: 'partner@example.com',
    sentToPhone: null,
    deliveryStatus: 'sent',
    deliveryErrorCode: null,
    createdAt,
  });

  type StoreMock = Pick<
    TenantPasswordSetupStore,
    'findLatestForTenant' | 'invalidateActiveForTenant' | 'create' | 'setDeliveryStatus'
  >;

  function buildService(overrides?: {
    latest?: PasswordSetupTokenRow | null;
    cooldownMs?: string;
  }) {
    if (overrides?.cooldownMs !== undefined) {
      process.env.PASSWORD_SETUP_RESEND_COOLDOWN_MS = overrides.cooldownMs;
    }
    const store: StoreMock = {
      findLatestForTenant: jest
        .fn<Promise<PasswordSetupTokenRow | null>, [string]>()
        .mockResolvedValue(overrides?.latest ?? null),
      invalidateActiveForTenant: jest.fn().mockResolvedValue(undefined),
      // The test never reaches issueForTenant — but stub these so a
      // surprise call would fail loudly with a clear name in the stack.
      create: jest.fn().mockImplementation(() => {
        throw new Error('store.create should not be reached during cooldown rejection');
      }),
      setDeliveryStatus: jest.fn(),
    };

    const tenantAccountsStore: Pick<TenantAccountsStore, 'findById'> = {
      findById: jest.fn().mockResolvedValue(buildTenant()),
    };

    const passwordService = {} as PasswordService;
    const emailService = {
      isStubTransport: jest.fn().mockReturnValue(true),
      send: jest.fn(),
    } as unknown as EmailService;
    const setupStore = {
      getPlatformSetup: jest.fn().mockResolvedValue(null),
    } as unknown as SetupStore;
    const databaseService = {
      transaction: jest.fn(async (work: () => Promise<unknown>) => work()),
    };

    return new TenantPasswordSetupService(
      store as TenantPasswordSetupStore,
      tenantAccountsStore as TenantAccountsStore,
      passwordService,
      emailService,
      setupStore,
      databaseService as any,
    );
  }

  beforeEach(() => {
    delete process.env.PASSWORD_SETUP_RESEND_COOLDOWN_MS;
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it('rejects with resend_cooldown_active when the latest token is within the cooldown window', async () => {
    const recent = new Date(Date.now() - 5_000); // 5 s ago, well inside default 60 s
    const service = buildService({ latest: baseTokenRow(recent) });

    await expect(
      service.resendForTenant({ tenantAccountId, adminId: 'admin-1' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'resend_cooldown_active',
        retryAfterSeconds: expect.any(Number),
      }),
    });
  });

  it('returns retryAfterSeconds proportional to the time remaining', async () => {
    // 30s ago against the default 60s cooldown → ~30s remaining.
    const halfway = new Date(Date.now() - 30_000);
    const service = buildService({ latest: baseTokenRow(halfway) });

    try {
      await service.resendForTenant({ tenantAccountId, adminId: 'admin-1' });
      fail('expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        retryAfterSeconds: number;
      };
      expect(response.retryAfterSeconds).toBeGreaterThanOrEqual(25);
      expect(response.retryAfterSeconds).toBeLessThanOrEqual(35);
    }
  });

  it('honors a deliberately failed delivery — the cooldown applies regardless of deliveryStatus', async () => {
    // A previous attempt that failed at the transport level still counts:
    // otherwise a flaky SMTP server becomes a retry-spam channel into the
    // partner's inbox.
    const recent = new Date(Date.now() - 1_000);
    const failedToken: PasswordSetupTokenRow = {
      ...baseTokenRow(recent),
      deliveryStatus: 'failed',
      deliveryErrorCode: 'email_send_threw',
    };
    const service = buildService({ latest: failedToken });

    await expect(
      service.resendForTenant({ tenantAccountId, adminId: 'admin-1' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'resend_cooldown_active' }),
    });
  });

  it('clamps env-configured cooldown above the minimum (10 s) so misconfig=0 cannot disable the guard', async () => {
    const recent = new Date(Date.now() - 1_000);
    // Operator set cooldown to 0 — clamp should bump it to 10s, so a 1s-old
    // token still falls inside the cooldown window.
    const service = buildService({ latest: baseTokenRow(recent), cooldownMs: '0' });

    await expect(
      service.resendForTenant({ tenantAccountId, adminId: 'admin-1' }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'resend_cooldown_active' }),
    });
  });
});

describe('TenantPasswordSetupService.redeem - atomic token consumption', () => {
  const originalEnv = { ...process.env };
  const activeToken: PasswordSetupTokenRow = {
    id: 'token-1',
    tenantAccountId: 'tenant-1',
    tokenHash: 'stored-hash',
    purpose: 'initial_password_setup',
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    createdByAdminId: 'admin-1',
    sentToEmail: 'partner@example.com',
    sentToPhone: null,
    deliveryStatus: 'sent',
    deliveryErrorCode: null,
    createdAt: new Date(),
  };

  function buildRedeemService(row: PasswordSetupTokenRow | null = activeToken) {
    let consumed = false;
    const store = {
      findByTokenHash: jest.fn().mockResolvedValue(row),
      consumeIfActive: jest.fn().mockImplementation(async () => {
        if (consumed) return false;
        consumed = true;
        return true;
      }),
    };
    const tenants = {
      findById: jest.fn().mockResolvedValue({ account: { email: 'partner@example.com' } }),
      updatePasswordHash: jest.fn().mockResolvedValue(undefined),
    };
    const password = { hash: jest.fn().mockResolvedValue('password-hash') };
    const database = { transaction: jest.fn(async (work: () => Promise<unknown>) => work()) };
    const service = new TenantPasswordSetupService(
      store as any,
      tenants as any,
      password as any,
      {} as any,
      {} as any,
      database as any,
    );
    return { service, store, tenants };
  }

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-password-setup-secret';
  });

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('allows only one of two parallel redemptions for the same token', async () => {
    const { service, tenants } = buildRedeemService();
    const results = await Promise.allSettled([
      service.redeem('same-token', 'Password123'),
      service.redeem('same-token', 'Password456'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(tenants.updatePasswordHash).toHaveBeenCalledTimes(1);
  });

  it('rejects a token that loses the conditional consume check', async () => {
    const { service, store, tenants } = buildRedeemService();
    store.consumeIfActive.mockResolvedValue(false);

    await expect(service.redeem('used-token', 'Password123')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'invalid_or_expired_token' }),
    });
    expect(tenants.updatePasswordHash).not.toHaveBeenCalled();
  });

  it('rejects expired tokens before attempting password persistence', async () => {
    const { service, store, tenants } = buildRedeemService({
      ...activeToken,
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(service.redeem('expired-token', 'Password123')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'invalid_or_expired_token' }),
    });
    expect(store.consumeIfActive).not.toHaveBeenCalled();
    expect(tenants.updatePasswordHash).not.toHaveBeenCalled();
  });
});
