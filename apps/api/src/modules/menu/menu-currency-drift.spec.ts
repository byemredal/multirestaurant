import { BadRequestException } from '@nestjs/common';
import { MenuService } from './menu.service';

/**
 * MR-DB-HARDENING-01 Slice 5 — menu item currency must match the active
 * platform currency at write time, instead of only surfacing as a checkout
 * currency_mismatch. No-op pre-setup (no active CountryPack).
 */
describe('MenuService currency drift guard', () => {
  function makeService(opts: {
    policy: { currencyCode: string } | null;
    currencyRow?: { code: string };
  }) {
    const get = jest.fn().mockResolvedValue(opts.currencyRow);
    const run = jest.fn().mockResolvedValue({ rowCount: 1 });
    const prepare = jest.fn(() => ({ get, run }));
    const installationProfile = {
      findActiveCountryPolicy: jest.fn().mockResolvedValue(opts.policy),
    };
    const service = new MenuService(
      { prepare } as any,
      {} as any,
      installationProfile as any,
    );
    (service as any).ensureOwnedStore = jest.fn().mockResolvedValue(undefined);
    return { service, get };
  }

  const assertCurrency = (service: MenuService, currencyId: string) =>
    (service as any).assertMenuItemCurrencyMatchesPlatform(currencyId) as Promise<void>;

  it('accepts a currency that matches the platform currency', async () => {
    const { service } = makeService({
      policy: { currencyCode: 'CHF' },
      currencyRow: { code: 'CHF' },
    });
    await expect(assertCurrency(service, 'chf-id')).resolves.toBeUndefined();
  });

  it('rejects a currency that does not match the platform currency', async () => {
    const { service } = makeService({
      policy: { currencyCode: 'CHF' },
      currencyRow: { code: 'USD' },
    });
    await expect(assertCurrency(service, 'usd-id')).rejects.toMatchObject({
      response: { code: 'menu_item_currency_mismatch' },
    });
  });

  it('rejects an unknown currencyId', async () => {
    const { service } = makeService({
      policy: { currencyCode: 'CHF' },
      currencyRow: undefined,
    });
    await expect(assertCurrency(service, 'ghost-id')).rejects.toMatchObject({
      response: { code: 'menu_item_currency_invalid' },
    });
  });

  it('is a no-op before platform setup (no active CountryPack)', async () => {
    const { service, get } = makeService({ policy: null });
    await expect(assertCurrency(service, 'any-id')).resolves.toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });

  it('createItem rejects a mismatched currency before inserting', async () => {
    const { service } = makeService({
      policy: { currencyCode: 'CHF' },
      currencyRow: { code: 'USD' },
    });
    await expect(
      service.createItem('store-1', 'tenant-1', {
        name: 'Pizza',
        basePrice: 10,
        currencyId: 'usd-id',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
