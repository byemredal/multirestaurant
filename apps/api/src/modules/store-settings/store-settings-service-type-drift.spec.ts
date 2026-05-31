import { StoreSettingsService } from './store-settings.service';

/**
 * MR-DB-HARDENING-01 Slice 5 — service type ↔ ordering policy drift.
 * Policy is the canonical write path (upsertOrderingPolicy syncs StoreServiceType
 * forward); the direct StoreServiceType assignment flow must keep the policy's
 * delivery/pickup booleans in sync the other way, so checkout's order-time policy
 * check can never contradict cart readiness.
 */
describe('StoreSettingsService service-type / ordering-policy sync', () => {
  function makeService(over: {
    serviceTypesReturn?: Array<{ code: string; isActive: boolean }>;
    policy?: {
      minOrderAmount: number;
      acceptsDelivery: boolean;
      acceptsPickup: boolean;
      currencyCode: string;
    };
  }) {
    const store = {
      replaceServiceTypes: jest
        .fn()
        .mockResolvedValue(over.serviceTypesReturn ?? []),
      getOrCreateOrderingPolicy: jest.fn().mockResolvedValue(
        over.policy ?? {
          minOrderAmount: 0,
          acceptsDelivery: true,
          acceptsPickup: true,
          currencyCode: 'CHF',
        },
      ),
      upsertOrderingPolicy: jest.fn().mockResolvedValue({}),
      syncServiceTypesFromOrderingPolicy: jest.fn().mockResolvedValue([]),
    };
    const systemTaxonomyService = {
      getServiceTypeByIdOrThrow: jest.fn().mockResolvedValue({ id: 'x' }),
    };
    const installationProfile = {
      findActiveCountryPolicy: jest.fn().mockResolvedValue(null),
    };
    const service = new StoreSettingsService(
      store as any,
      {} as any,
      systemTaxonomyService as any,
      installationProfile as any,
    );
    (service as any).ensureOwnedStore = jest.fn().mockResolvedValue(undefined);
    return { service, store };
  }

  it('writes delivery/pickup back to the policy when a direct assignment differs', async () => {
    const { service, store } = makeService({
      serviceTypesReturn: [
        { code: 'delivery', isActive: true },
        { code: 'pickup', isActive: false },
      ],
      policy: {
        minOrderAmount: 25,
        acceptsDelivery: true,
        acceptsPickup: true, // currently contradicts the new assignment
        currencyCode: 'CHF',
      },
    });

    await service.replaceServiceTypes('store-1', 'tenant-1', {
      serviceTypes: [
        { serviceTypeId: 'del-id', isActive: true },
        { serviceTypeId: 'pick-id', isActive: false },
      ],
    } as any);

    expect(store.upsertOrderingPolicy).toHaveBeenCalledWith('store-1', {
      minOrderAmount: 25,
      acceptsDelivery: true,
      acceptsPickup: false,
      currencyCode: 'CHF',
    });
  });

  it('does not rewrite the policy when assignments already match it', async () => {
    const { service, store } = makeService({
      serviceTypesReturn: [
        { code: 'delivery', isActive: true },
        { code: 'pickup', isActive: true },
        { code: 'dine_in', isActive: false },
      ],
      policy: {
        minOrderAmount: 0,
        acceptsDelivery: true,
        acceptsPickup: true,
        currencyCode: 'CHF',
      },
    });

    await service.replaceServiceTypes('store-1', 'tenant-1', {
      serviceTypes: [
        { serviceTypeId: 'del-id', isActive: true },
        { serviceTypeId: 'pick-id', isActive: true },
        { serviceTypeId: 'dine-id', isActive: false },
      ],
    } as any);

    expect(store.upsertOrderingPolicy).not.toHaveBeenCalled();
  });

  it('keeps StoreServiceType in sync when the ordering policy is updated (forward)', async () => {
    const { service, store } = makeService({
      policy: {
        minOrderAmount: 0,
        acceptsDelivery: true,
        acceptsPickup: true,
        currencyCode: 'CHF',
      },
    });

    await service.upsertOrderingPolicy('store-1', 'tenant-1', {
      acceptsDelivery: true,
      acceptsPickup: false,
    } as any);

    expect(store.syncServiceTypesFromOrderingPolicy).toHaveBeenCalledWith('store-1', {
      acceptsDelivery: true,
      acceptsPickup: false,
    });
  });
});
