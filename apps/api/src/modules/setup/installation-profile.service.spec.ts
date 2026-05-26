import { NotFoundException } from '@nestjs/common';
import { CH_PACK } from '@lieferzonen/config';
import { InstallationProfileService } from './installation-profile.service';
import {
  InstallationProfileRow,
  InstallationProfileStore,
} from './installation-profile.store';

function makeRow(overrides: Partial<InstallationProfileRow> = {}): InstallationProfileRow {
  return {
    id: 'install',
    countryCode: 'CH',
    locale: 'de-CH',
    currencyCode: 'CHF',
    timezone: 'Europe/Zurich',
    packVersion: CH_PACK.packVersion,
    initializedAt: '2026-05-26T00:00:00.000Z',
    initializedByAdminId: 'admin-1',
    ...overrides,
  };
}

function makeService(row: InstallationProfileRow | null) {
  const store: jest.Mocked<Pick<InstallationProfileStore, 'find'>> = {
    find: jest.fn().mockResolvedValue(row),
  };
  return {
    service: new InstallationProfileService(store as unknown as InstallationProfileStore),
    store,
  };
}

describe('InstallationProfileService', () => {
  it('returns null and does not throw when setup has not run', async () => {
    const { service, store } = makeService(null);
    const active = await service.findActive();
    expect(active).toBeNull();
    expect(store.find).toHaveBeenCalledTimes(1);
  });

  it('merges the DB row with the code-driven CountryPack', async () => {
    const { service } = makeService(makeRow());
    const active = await service.getActive();
    expect(active.countryCode).toBe('CH');
    expect(active.locale).toBe('de-CH');
    expect(active.packVersionMatches).toBe(true);
    expect(active.pack).toBe(CH_PACK);
  });

  it('caches the active profile after the first read', async () => {
    const { service, store } = makeService(makeRow());
    await service.findActive();
    await service.findActive();
    await service.findActive();
    expect(store.find).toHaveBeenCalledTimes(1);
  });

  it('invalidate() forces the next read to re-query the store', async () => {
    const { service, store } = makeService(makeRow());
    await service.findActive();
    service.invalidate();
    await service.findActive();
    expect(store.find).toHaveBeenCalledTimes(2);
  });

  it('flags pack-version drift between DB and code', async () => {
    const { service } = makeService(makeRow({ packVersion: 'CH-0' }));
    const active = await service.getActive();
    expect(active.packVersion).toBe('CH-0');
    expect(active.codePackVersion).toBe(CH_PACK.packVersion);
    expect(active.packVersionMatches).toBe(false);
  });

  it('throws when the DB row references an unsupported country (deploy older than DB)', async () => {
    const { service } = makeService(makeRow({ countryCode: 'XX' }));
    await expect(service.findActive()).rejects.toThrow(/not a supported CountryPack/);
  });

  it('getActive throws NotFoundException when setup has not run', async () => {
    const { service } = makeService(null);
    await expect(service.getActive()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findClientPack projects to the client-safe shape and excludes bank/IBAN', async () => {
    const { service } = makeService(makeRow());
    const pack = await service.findClientPack();
    expect(pack).not.toBeNull();
    expect(pack?.country).toBe('CH');
    expect(pack?.currency).toBe('CHF');
    expect(pack?.tax.label).toBe('VAT');
    expect(pack).not.toHaveProperty('bank');
  });
});
