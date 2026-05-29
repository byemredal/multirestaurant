import { BadRequestException } from '@nestjs/common';
import { CartService } from './cart.service';

/**
 * Covers the backward-compatible serviceType (code) resolution added to
 * PATCH /cart/preferences. These cases throw before any cart UPDATE /
 * buildCartPayload, so only findCartByCustomer + listActiveServiceTypes need
 * stubbing.
 */
describe('CartService.updatePreferences — serviceType code resolution', () => {
  const CART_ROW = {
    id: 'cart-1',
    customerAccountId: 'cust-1',
    storeId: 'store-1',
    subtotalAmount: 0,
    totalAmount: 0,
    currencyId: 'cur-1',
    currencySnapshot: 'CHF',
    serviceTypeId: 'pickup-id',
    serviceTypeSnapshot: 'pickup',
    paymentMethodId: null,
    paymentMethodSnapshot: null,
    deliveryDistanceKm: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  function makeService(activeServiceTypes: Array<{ serviceTypeId: string; code: string }>) {
    const databaseService = {
      prepare: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue(CART_ROW),
        run: jest.fn().mockResolvedValue(undefined),
        all: jest.fn().mockResolvedValue([]),
      }),
    };
    const storeSettingsStore = {
      listActiveServiceTypes: jest.fn().mockResolvedValue(activeServiceTypes),
      findActiveServiceTypeAssignment: jest.fn(),
    };
    const service = new CartService(
      databaseService as any,
      {} as any,
      storeSettingsStore as any,
      {} as any,
    );
    return { service, storeSettingsStore };
  }

  it('rejects an inactive service type code with service_type_unavailable', async () => {
    const { service } = makeService([{ serviceTypeId: 'pickup-id', code: 'pickup' }]);
    await expect(
      service.updatePreferences('cust-1', { serviceType: 'delivery' } as any),
    ).rejects.toMatchObject(
      new BadRequestException({
        code: 'service_type_unavailable',
        message: 'Bu restoran seçilen servis türünü desteklemiyor.',
      }),
    );
  });

  it('rejects when the store has no active service types', async () => {
    const { service } = makeService([]);
    await expect(
      service.updatePreferences('cust-1', { serviceType: 'pickup' } as any),
    ).rejects.toMatchObject(
      new BadRequestException({
        code: 'no_active_service_types',
        message: 'Restoranın aktif servis türü bulunmuyor.',
      }),
    );
  });

  it('resolves an active service type code to its id (no throw before update)', async () => {
    const { service, storeSettingsStore } = makeService([
      { serviceTypeId: 'pickup-id', code: 'pickup' },
      { serviceTypeId: 'delivery-id', code: 'delivery' },
    ]);
    // buildCartPayload reads more rows via the stubbed prepare().get() → CART_ROW,
    // which is enough to return without throwing.
    await expect(
      service.updatePreferences('cust-1', { serviceType: 'delivery' } as any),
    ).resolves.toBeDefined();
    expect(storeSettingsStore.listActiveServiceTypes).toHaveBeenCalledWith('store-1');
  });
});
