import { ServiceUnavailableException } from '@nestjs/common';
import { TenantTestOrdersController } from './tenant-test-orders.controller';

describe('TenantTestOrdersController production protection', () => {
  const originalEnv = { ...process.env };

  afterAll(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('refuses to create test orders in production', () => {
    process.env.NODE_ENV = 'production';
    const orders = { createTestOrderForTenant: jest.fn() };
    const controller = new TenantTestOrdersController(orders as any);

    expect(() => controller.create({ user: { id: 'tenant-1' } } as any, {} as any)).toThrow(
      ServiceUnavailableException,
    );
    expect(orders.createTestOrderForTenant).not.toHaveBeenCalled();
  });

  it('keeps non-production tooling available', () => {
    process.env.NODE_ENV = 'development';
    const orders = { createTestOrderForTenant: jest.fn().mockReturnValue({ id: 'order-1' }) };
    const controller = new TenantTestOrdersController(orders as any);

    expect(controller.create({ user: { id: 'tenant-1' } } as any, {} as any)).toEqual({
      id: 'order-1',
    });
  });
});
