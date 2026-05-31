import { StoresService } from './stores.service';
import { StoreOnboardingStatus, StoreStatus } from './entities/store.entity';

/** A canonical, public-listable Store row (status active + accepting orders). */
function buildStoreRow(overrides: Record<string, unknown> = {}) {
  return {
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
    acceptingOrders: true,
    createdAt: '2026-04-12T18:00:00.000Z',
    updatedAt: '2026-04-12T18:00:00.000Z',
    // Aggregated from the canonical StoreServiceArea coverage join.
    serviceAreaCount: 1,
    openHourCount: 0,
    deliveryFee: 4.9,
    minimumOrderAmount: 25,
    estimatedDeliveryMinutes: 35,
    ...overrides,
  };
}

function buildService(databaseService: unknown) {
  // listPublic / findPublicStore do not touch the coverage-sync collaborator.
  return new StoresService(
    databaseService as any,
    {} as any,
    { findActiveCountryPolicy: async () => null } as any,
  );
}

describe('StoresService public discovery', () => {
  it('passes delivery postal code filters into public discovery query', async () => {
    const all = jest.fn().mockResolvedValue([buildStoreRow()]);
    const prepare = jest.fn(() => ({ all }));
    const databaseService = { prepare };
    const service = buildService(databaseService);

    const result = await service.listPublic({
      postalCode: '6319',
      mode: 'delivery',
    });

    expect(prepare).toHaveBeenCalled();
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
        acceptingOrders: true,
        supportsDelivery: true,
        supportsCollection: false,
        // Currency now comes from the active CountryPack; the mocked policy is
        // null here, so it resolves to '' instead of the old hardcoded 'EUR'.
        currency: '',
      }),
    );
  });

  it('reads canonical coverage (StoreServiceArea / StoreCoveragePostalCode), not legacy StoreDeliveryZone', async () => {
    const all = jest.fn().mockResolvedValue([buildStoreRow()]);
    const prepare = jest.fn((_sql?: string) => ({ all }));
    const databaseService = { prepare };
    const service = buildService(databaseService);

    await service.listPublic({ postalCode: '6300', mode: 'delivery' });

    const discoverySql = String(prepare.mock.calls[0]?.[0] ?? '');
    expect(discoverySql).toContain('"StoreServiceArea"');
    expect(discoverySql).toContain('"StoreCoveragePostalCode"');
    // No read of the legacy table (quoted identifier = an actual table reference).
    expect(discoverySql).not.toContain('"StoreDeliveryZone"');
  });

  it('marks stores that are not accepting orders as not orderable/open', async () => {
    const all = jest
      .fn()
      .mockResolvedValue([buildStoreRow({ acceptingOrders: false })]);
    const prepare = jest.fn(() => ({ all }));
    const databaseService = { prepare };
    const service = buildService(databaseService);

    // Search the store's own postal area so collection would normally match.
    const result = await service.listPublic({
      postalCode: '6300',
      mode: 'delivery',
    });

    expect(result.stores[0]).toEqual(
      expect.objectContaining({
        acceptingOrders: false,
        supportsDelivery: false,
        supportsCollection: false,
      }),
    );
  });

  it('defaults to delivery mode when no discovery mode is provided', async () => {
    const all = jest.fn().mockResolvedValue([]);
    const prepare = jest.fn(() => ({ all }));
    const databaseService = { prepare };
    const service = buildService(databaseService);

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
    const prepare = jest.fn(() => ({ all }));
    const databaseService = { prepare };
    const service = buildService(databaseService);

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

describe('StoresService.findPublicStore', () => {
  it('returns canonical coverage data and preserves the slug without reading legacy zones', async () => {
    const store = buildStoreRow({
      serviceAreaCount: 2,
      deliveryFee: 5.5,
      minimumOrderAmount: 20,
      estimatedDeliveryMinutes: 30,
    });
    const get = jest.fn().mockResolvedValue(store);
    const all = jest.fn().mockResolvedValue([]);
    const prepare = jest.fn((_sql?: string) => ({ get, all }));
    const databaseService = { prepare };
    const service = buildService(databaseService);

    const result = await service.findPublicStore('store-1');

    expect(result?.store.slug).toBe('demo-kitchen');
    expect(result?.store).toEqual(
      expect.objectContaining({
        acceptingOrders: true,
        supportsDelivery: true,
        deliveryFee: 5.5,
        minimumOrderAmount: 20,
        estimatedDeliveryMinutes: 30,
      }),
    );

    const detailSql = String(prepare.mock.calls[0]?.[0] ?? '');
    expect(detailSql).toContain('"StoreServiceArea"');
    // No read of the legacy table (quoted identifier = an actual table reference).
    expect(detailSql).not.toContain('"StoreDeliveryZone"');
  });

  it('honors acceptingOrders=false in computed public availability', async () => {
    const store = buildStoreRow({ acceptingOrders: false });
    const get = jest.fn().mockResolvedValue(store);
    const all = jest.fn().mockResolvedValue([]);
    const prepare = jest.fn(() => ({ get, all }));
    const databaseService = { prepare };
    const service = buildService(databaseService);

    const result = await service.findPublicStore('store-1');

    expect(result?.store).toEqual(
      expect.objectContaining({
        acceptingOrders: false,
        supportsDelivery: false,
        supportsCollection: false,
      }),
    );
  });

  it('returns null when no active store matches', async () => {
    const get = jest.fn().mockResolvedValue(undefined);
    const all = jest.fn().mockResolvedValue([]);
    const prepare = jest.fn(() => ({ get, all }));
    const databaseService = { prepare };
    const service = buildService(databaseService);

    const result = await service.findPublicStore('missing-store');

    expect(result).toBeNull();
  });
});

describe('StoresService.updateAcceptingOrders', () => {
  it('updates the flag for the owning tenant and returns the refreshed store', async () => {
    // run() reports one affected row; the subsequent getOwnedStore read returns
    // the post-update row (acceptingOrders=false), proving the value round-trips
    // into the mapped Store entity consumed by the public read path (Slice 1).
    const run = jest.fn().mockResolvedValue({ rowCount: 1 });
    const get = jest
      .fn()
      .mockResolvedValue(buildStoreRow({ acceptingOrders: false }));
    const all = jest.fn().mockResolvedValue([]);
    const prepare = jest.fn((_sql?: string) => ({ run, get, all }));
    const databaseService = { prepare };
    const service = buildService(databaseService);

    const result = await service.updateAcceptingOrders('store-1', 'tenant-1', false);

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        $acceptingOrders: false,
        $id: 'store-1',
        $ownerTenantId: 'tenant-1',
      }),
    );
    expect(result?.acceptingOrders).toBe(false);
  });

  it('returns null for a cross-tenant update (no row matched) without reading the store', async () => {
    const run = jest.fn().mockResolvedValue({ rowCount: 0 });
    const get = jest.fn();
    const all = jest.fn();
    const prepare = jest.fn((_sql?: string) => ({ run, get, all }));
    const databaseService = { prepare };
    const service = buildService(databaseService);

    const result = await service.updateAcceptingOrders('store-1', 'other-tenant', true);

    expect(result).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
