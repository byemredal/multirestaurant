import { StoresService } from './stores.service';
import { StoreOnboardingStatus, StoreStatus } from './entities/store.entity';

describe('StoresService public discovery', () => {
  it('passes delivery postal code filters into public discovery query', async () => {
    const all = jest.fn().mockResolvedValue([
      {
        id: 'store-1',
        ownerTenantId: 'tenant-1',
        name: 'Demo Kitchen',
        slug: 'demo-kitchen',
        category: 'Pizza',
        description: null,
        imageUrl: null,
        status: StoreStatus.ACTIVE,
        onboardingStatus: StoreOnboardingStatus.READY_FOR_REVIEW,
        isActive: true,
        addressLine1: 'Kirchenstrasse 12',
        addressLine2: null,
        city: 'Zug',
        postalCode: '6300',
        country: 'CH',
        latitude: null,
        longitude: null,
        phoneNumber: '+41 41 711 00 01',
        createdAt: '2026-04-12T18:00:00.000Z',
        updatedAt: '2026-04-12T18:00:00.000Z',
        deliveryZoneCount: 1,
        openHourCount: 0,
        deliveryFee: 4.9,
        minimumOrderAmount: 25,
        estimatedDeliveryMinutes: 35,
      },
    ]);
    const databaseService = {
      prepare: jest.fn(() => ({
        all,
      })),
    };
    // listPublic does not touch the coverage-sync collaborator.
    const service = new StoresService(databaseService as any, {} as any);

    const result = await service.listPublic({
      postalCode: '6319',
      mode: 'delivery',
    });

    expect(databaseService.prepare).toHaveBeenCalled();
    expect(all).toHaveBeenCalledWith(
      expect.objectContaining({
        $postalCode: '6319',
        $mode: 'delivery',
      }),
    );
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0]?.name).toBe('Demo Kitchen');
    expect(result.stores[0]).toEqual(
      expect.objectContaining({
        deliveryFee: 4.9,
        minimumOrderAmount: 25,
        estimatedDeliveryMinutes: 35,
        supportsDelivery: true,
        supportsCollection: false,
        currency: 'EUR',
      }),
    );
  });

  it('defaults to delivery mode when no discovery mode is provided', async () => {
    const all = jest.fn().mockResolvedValue([]);
    const databaseService = {
      prepare: jest.fn(() => ({
        all,
      })),
    };
    // listPublic does not touch the coverage-sync collaborator.
    const service = new StoresService(databaseService as any, {} as any);

    await service.listPublic({
      postalCode: '6300',
    });

    expect(all).toHaveBeenCalledWith(
      expect.objectContaining({
        $postalCode: '6300',
        $mode: 'delivery',
        $shopType: null,
        $categoryCount: 0,
      }),
    );
  });

  it('passes storefront filters into public discovery query', async () => {
    const all = jest.fn().mockResolvedValue([]);
    const databaseService = {
      prepare: jest.fn(() => ({
        all,
      })),
    };
    // listPublic does not touch the coverage-sync collaborator.
    const service = new StoresService(databaseService as any, {} as any);

    await service.listPublic({
      postalCode: '6319',
      mode: 'delivery',
      shopType: 'Pizza',
      categories: ['asian', 'kebab'],
      freeDelivery: true,
      openNow: true,
      isNew: true,
      maxMinimumOrder: 30,
      sort: 'eta',
    });

    expect(all).toHaveBeenCalledWith(
      expect.objectContaining({
        $postalCode: '6319',
        $mode: 'delivery',
        $shopType: 'pizza',
        $categories: ['asian', 'kebab'],
        $categoryCount: 2,
        $freeDelivery: true,
        $openNow: true,
        $isNew: true,
        $maxMinimumOrder: 30,
      }),
    );
  });
});
