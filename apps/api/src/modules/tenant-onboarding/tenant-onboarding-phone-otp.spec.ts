import { ServiceUnavailableException } from '@nestjs/common';
import { TenantOnboardingService } from './tenant-onboarding.service';

/**
 * MR-OTP-TRANSPORT-LOUD-FAIL-01
 *
 * Phone OTP must fail loudly in production when the email transport is a
 * stub (EMAIL_TRANSPORT=log) or SMTP config is incomplete. The endpoint must
 * never return a fake-success challenge with a debug code in production.
 */
describe('TenantOnboardingService phone OTP loud-fail', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const APPLICATION_ID = 'app-1';
  const TENANT_ID = 'tenant-1';
  const STATE_TOKEN = 'state-token';
  const PHONE = '+41791234567';

  type Mocks = {
    store: {
      getPhoneVerification: jest.Mock;
      getOwnerContact: jest.Mock;
      upsertPhoneVerificationChallenge: jest.Mock;
    };
    tenantAccountsStore: { findById: jest.Mock };
    emailService: {
      isStubTransport: jest.Mock;
      resolveTransport: jest.Mock;
      send: jest.Mock;
    };
  };

  function buildService(stubTransport: boolean, sendResult?: any) {
    const store = {
      getPhoneVerification: jest.fn().mockResolvedValue(null),
      getOwnerContact: jest.fn().mockResolvedValue(null),
      upsertPhoneVerificationChallenge: jest.fn().mockResolvedValue(undefined),
    };
    const tenantAccountsStore = {
      findById: jest.fn().mockResolvedValue({
        account: { id: TENANT_ID, email: 'owner@example.com', phoneNumber: PHONE },
      }),
    };
    const emailService = {
      isStubTransport: jest.fn().mockReturnValue(stubTransport),
      resolveTransport: jest.fn().mockReturnValue(stubTransport ? 'log' : 'smtp'),
      send: jest.fn().mockResolvedValue(
        sendResult ?? { delivered: true, transport: 'smtp', stub: false },
      ),
    };

    const service = new TenantOnboardingService(
      store as any,
      tenantAccountsStore as any,
      {} as any,
      {} as any,
      emailService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    // Stub orchestration helpers that aren't under test here.
    jest
      .spyOn(service as any, 'resolveApplicationFromStateToken')
      .mockResolvedValue({ id: APPLICATION_ID, tenantAccountId: TENANT_ID, status: 'draft' });
    jest.spyOn(service as any, 'assertPhoneVerificationEditable').mockImplementation(() => undefined);
    jest.spyOn(service as any, 'getWorkspace').mockResolvedValue({ stateToken: STATE_TOKEN });
    jest.spyOn(service as any, 'resolveSessionByStateToken').mockResolvedValue({});
    jest.spyOn(service as any, 'resolvePlatformDisplayName').mockResolvedValue('Lieferzonen');

    const mocks: Mocks = { store, tenantAccountsStore, emailService };
    return { service, mocks };
  }

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  it('throws 503 otp_provider_unavailable in production with stub transport and does not persist the OTP', async () => {
    process.env.NODE_ENV = 'production';
    const { service, mocks } = buildService(true);

    const error = await service
      .sendPhoneVerificationCodeByStateToken(STATE_TOKEN, PHONE)
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: 'otp_provider_unavailable',
    });

    expect(mocks.store.upsertPhoneVerificationChallenge).not.toHaveBeenCalled();
    expect(mocks.emailService.send).not.toHaveBeenCalled();
  });

  it('throws 503 otp_delivery_not_acknowledged in production when send returns delivered=false', async () => {
    process.env.NODE_ENV = 'production';
    const { service } = buildService(false, { delivered: false, transport: 'smtp', stub: false });

    const error = await service
      .sendPhoneVerificationCodeByStateToken(STATE_TOKEN, PHONE)
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: 'otp_delivery_not_acknowledged',
    });
  });

  it('throws 503 otp_delivery_failed in production when send throws', async () => {
    process.env.NODE_ENV = 'production';
    const { service, mocks } = buildService(false);
    mocks.emailService.send.mockRejectedValueOnce(new Error('smtp boom'));

    const error = await service
      .sendPhoneVerificationCodeByStateToken(STATE_TOKEN, PHONE)
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
      code: 'otp_delivery_failed',
    });
  });

  it('does not include debugCode in the response on the production success path', async () => {
    process.env.NODE_ENV = 'production';
    const { service } = buildService(false, { delivered: true, transport: 'smtp', stub: false });

    const result = await service.sendPhoneVerificationCodeByStateToken(STATE_TOKEN, PHONE);
    expect(result).toMatchObject({ nextStep: 'otp' });
    expect((result as { debugCode?: string }).debugCode).toBeUndefined();
  });

  it('exposes debugCode in non-production with a stub transport', async () => {
    process.env.NODE_ENV = 'development';
    const { service } = buildService(true, { delivered: false, transport: 'log', stub: true });

    const result = await service.sendPhoneVerificationCodeByStateToken(STATE_TOKEN, PHONE);
    expect((result as { debugCode?: string }).debugCode).toMatch(/^\d{6}$/);
  });
});
