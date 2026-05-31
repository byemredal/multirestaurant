import { NotFoundException } from '@nestjs/common';
import { StoreSettingsService } from './store-settings.service';

/**
 * MR-DB-HARDENING-01 Slice 1B — the operational `acceptingOrders` switch is
 * written through the tenant-only general settings flow. These cover ownership
 * (cross-tenant reject), the happy path, and a no-regression check that a plain
 * settings update does not touch the Store row.
 */
describe('StoreSettingsService acceptingOrders setter', () => {
  const storeId = 'store-1';
  const ownerTenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  const settingRecord = {
    id: 'setting-1',
    storeId,
    defaultCurrencyId: 'cur-1',
    defaultLanguageId: 'lang-1',
    advancedOptionsJson: {},
    createdAt: '2026-04-12T18:00:00.000Z',
    updatedAt: '2026-04-12T18:00:00.000Z',
  };

  function buildService(opts: {
    ownedByTenant?: string;
    updateResult?: { acceptingOrders: boolean } | null;
  }) {
    const store = {
      getOrCreateStoreSetting: jest.fn().mockResolvedValue(settingRecord),
      upsertStoreSetting: jest.fn().mockResolvedValue(settingRecord),
    };
    // findOwnedStore enforces ownership: only returns the store for its owner.
    const storesService = {
      findOwnedStore: jest.fn(async (id: string, tenantId: string) =>
        tenantId === opts.ownedByTenant
          ? { id, ownerTenantId: tenantId, acceptingOrders: true }
          : null,
      ),
      updateAcceptingOrders: jest.fn().mockResolvedValue(opts.updateResult ?? null),
    };
    const service = new StoreSettingsService(
      store as any,
      storesService as any,
      {} as any,
      {} as any,
    );
    return { service, store, storesService };
  }

  it('lets the owning tenant set acceptingOrders=false', async () => {
    const { service, storesService } = buildService({
      ownedByTenant: ownerTenantId,
      updateResult: { acceptingOrders: false },
    });

    const result = await service.upsertStoreSetting(storeId, ownerTenantId, {
      acceptingOrders: false,
    });

    expect(storesService.updateAcceptingOrders).toHaveBeenCalledWith(
      storeId,
      ownerTenantId,
      false,
    );
    expect(result).toEqual(
      expect.objectContaining({ id: 'setting-1', acceptingOrders: false }),
    );
  });

  it('lets the owning tenant set acceptingOrders=true', async () => {
    const { service, storesService } = buildService({
      ownedByTenant: ownerTenantId,
      updateResult: { acceptingOrders: true },
    });

    const result = await service.upsertStoreSetting(storeId, ownerTenantId, {
      acceptingOrders: true,
    });

    expect(storesService.updateAcceptingOrders).toHaveBeenCalledWith(
      storeId,
      ownerTenantId,
      true,
    );
    expect(result).toEqual(expect.objectContaining({ acceptingOrders: true }));
  });

  it('rejects a cross-tenant update and never touches the Store row', async () => {
    const { service, storesService } = buildService({
      ownedByTenant: ownerTenantId,
    });

    await expect(
      service.upsertStoreSetting(storeId, otherTenantId, {
        acceptingOrders: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(storesService.updateAcceptingOrders).not.toHaveBeenCalled();
  });

  it('does not regress: a settings update without acceptingOrders leaves the Store row untouched', async () => {
    const { service, store, storesService } = buildService({
      ownedByTenant: ownerTenantId,
    });

    const result = await service.upsertStoreSetting(storeId, ownerTenantId, {
      advancedOptionsJson: { themeKey: 'warm-bistro' },
    });

    expect(store.upsertStoreSetting).toHaveBeenCalled();
    expect(storesService.updateAcceptingOrders).not.toHaveBeenCalled();
    // acceptingOrders is reflected from the owned store (current value).
    expect(result).toEqual(expect.objectContaining({ acceptingOrders: true }));
  });

  it('getStoreSetting surfaces the current acceptingOrders value', async () => {
    const { service } = buildService({ ownedByTenant: ownerTenantId });

    const result = await service.getStoreSetting(storeId, ownerTenantId);

    expect(result).toEqual(
      expect.objectContaining({ id: 'setting-1', acceptingOrders: true }),
    );
  });
});
