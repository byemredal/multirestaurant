import { ServiceUnavailableException } from '@nestjs/common';
import { SystemState } from './setup.constants';
import { SetupService } from './setup.service';

describe('SetupService legal placeholder production gate', () => {
  const originalEnv = { ...process.env };
  const dto = {
    adminEmail: 'admin@example.com',
    adminPassword: 'Password123',
    adminFirstName: 'Admin',
    adminLastName: 'Owner',
    platformName: 'Platform',
    supportEmail: 'support@example.com',
    primaryCountry: 'CH',
  } as any;

  function buildService() {
    const setupStore = {
      getPlatformSetup: jest.fn().mockResolvedValue(null),
      hasSuperAdmin: jest.fn().mockResolvedValue(false),
      initialize: jest.fn().mockResolvedValue(undefined),
    };
    const state = {
      getState: jest.fn().mockResolvedValue({ state: SystemState.UNINITIALIZED }),
      beginInitialization: jest.fn().mockResolvedValue(undefined),
      failInitialization: jest.fn().mockResolvedValue(undefined),
      completeInitialization: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn().mockReturnValue('test-bootstrap-key'),
    };
    const service = new SetupService(
      setupStore as any,
      state as any,
      { hash: jest.fn().mockResolvedValue('hash') } as any,
      { invalidate: jest.fn() } as any,
      configService as any,
    );
    return { service, setupStore, state, configService };
  }

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('blocks production initialization while legal text is placeholder content', async () => {
    process.env.NODE_ENV = 'production';
    const { service, setupStore } = buildService();

    await expect(service.initialize(dto)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(setupStore.initialize).not.toHaveBeenCalled();
  });

  it('keeps development setup usable with explicitly marked placeholder text', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT;
    const { service, setupStore } = buildService();

    await service.initialize(dto);
    expect(setupStore.initialize).toHaveBeenCalledTimes(1);
  });

  it('allows explicitly acknowledged placeholder legal content for local production bootstrap', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT = 'true';
    const { service, setupStore } = buildService();

    await service.initialize(dto);
    expect(setupStore.initialize).toHaveBeenCalledTimes(1);
  });

  it('no longer passes a legacy legalDocuments payload to setup initialization (Slice 7B)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_PLACEHOLDER_LEGAL_CONTENT;
    const { service, setupStore } = buildService();

    await service.initialize(dto);

    expect(setupStore.initialize).toHaveBeenCalledWith(
      expect.not.objectContaining({ legalDocuments: expect.anything() }),
    );
  });

  it('reports a ready preflight when setup can start', async () => {
    const { service } = buildService();

    await expect(service.getPreflight()).resolves.toMatchObject({
      ready: true,
      initialized: false,
      systemState: SystemState.UNINITIALIZED,
      setupState: SystemState.UNINITIALIZED,
      hasPlatformSetup: false,
      hasSuperAdmin: false,
      bootstrapKeyConfigured: true,
      bootstrapConfigured: true,
      countryPacksAvailable: true,
      countryPackReady: true,
      conflicts: [],
      blockingIssues: [],
    });
  });

  it('reports a super admin conflict before platform setup', async () => {
    const { service, setupStore } = buildService();
    setupStore.hasSuperAdmin.mockResolvedValue(true);

    await expect(service.getPreflight()).resolves.toMatchObject({
      ready: false,
      initialized: false,
      conflicts: ['super_admin_exists_before_setup'],
      blockingIssues: [
        expect.objectContaining({ code: 'super_admin_exists_before_setup' }),
      ],
    });
  });

  it('reports an initialized platform conflict', async () => {
    const { service, setupStore, state } = buildService();
    setupStore.getPlatformSetup.mockResolvedValue({
      platformName: 'Platform',
      supportEmail: 'support@example.com',
      logoUrl: null,
      primaryCountry: 'CH',
      initializedAt: '2026-05-31T00:00:00.000Z',
    });
    state.getState.mockResolvedValue({ state: SystemState.READY });

    await expect(service.getPreflight()).resolves.toMatchObject({
      ready: false,
      initialized: true,
      hasPlatformSetup: true,
      systemState: SystemState.READY,
      conflicts: ['platform_already_initialized'],
      blockingIssues: [
        expect.objectContaining({ code: 'platform_already_initialized' }),
      ],
    });
  });

  it('reports a missing bootstrap key conflict without exposing secrets', async () => {
    const { service, configService } = buildService();
    configService.get.mockReturnValue('');

    await expect(service.getPreflight()).resolves.toMatchObject({
      ready: false,
      bootstrapKeyConfigured: false,
      bootstrapConfigured: false,
      conflicts: ['bootstrap_key_missing'],
      blockingIssues: [
        expect.objectContaining({ code: 'bootstrap_key_missing' }),
      ],
    });
  });
});
