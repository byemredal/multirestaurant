import { ServiceUnavailableException } from '@nestjs/common';
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
      beginInitialization: jest.fn().mockResolvedValue(undefined),
      failInitialization: jest.fn().mockResolvedValue(undefined),
      completeInitialization: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SetupService(
      setupStore as any,
      state as any,
      { hash: jest.fn().mockResolvedValue('hash') } as any,
      { invalidate: jest.fn() } as any,
    );
    return { service, setupStore };
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
    const { service, setupStore } = buildService();

    await service.initialize(dto);
    expect(setupStore.initialize).toHaveBeenCalledTimes(1);
  });
});
