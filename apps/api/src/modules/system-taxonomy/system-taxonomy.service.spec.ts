import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SystemTaxonomyService } from './system-taxonomy.service';

describe('SystemTaxonomyService', () => {
  function makeService(rows: { all?: unknown[]; get?: unknown }) {
    const all = jest.fn().mockResolvedValue(rows.all ?? []);
    const get = jest.fn().mockResolvedValue(rows.get);
    const databaseService = {
      prepare: jest.fn(() => ({ all, get })),
    };
    return {
      service: new SystemTaxonomyService(databaseService as any),
      all,
      get,
    };
  }

  it('returns only active currencies sorted by sortOrder', async () => {
    const { service } = makeService({
      all: [
        {
          id: 'currency-1',
          code: 'TRY',
          displayName: 'Turkish Lira',
          symbol: '₺',
          numericCode: '949',
          decimalDigits: 2,
          sortOrder: 10,
          isActive: true,
          createdAt: 't0',
          updatedAt: 't0',
        },
      ],
    });

    const currencies = await service.listActiveCurrencies();
    expect(currencies).toEqual([
      expect.objectContaining({ code: 'TRY', sortOrder: 10, isActive: true }),
    ]);
  });

  it('throws when fetching a missing currency', async () => {
    const { service } = makeService({ get: undefined });
    await expect(service.getCurrencyByIdOrThrow('00000000-0000-0000-0000-000000000000'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects inactive language assignments', async () => {
    const { service } = makeService({
      get: {
        id: 'lang-1',
        code: 'tr-TR',
        displayName: 'Turkish (Turkey)',
        nativeDisplayName: 'Türkçe',
        sortOrder: 10,
        isActive: false,
        createdAt: 't0',
        updatedAt: 't0',
      },
    });

    await expect(service.getLanguageByIdOrThrow('lang-1'))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns active payment methods with iconKey preserved', async () => {
    const { service } = makeService({
      all: [
        {
          id: 'pm-1',
          code: 'cash',
          displayName: 'Nakit',
          iconKey: 'cash',
          sortOrder: 10,
          isActive: true,
          createdAt: 't',
          updatedAt: 't',
        },
      ],
    });

    const methods = await service.listActivePaymentMethods();
    expect(methods).toEqual([
      expect.objectContaining({ code: 'cash', iconKey: 'cash', sortOrder: 10 }),
    ]);
  });

  it('throws BadRequest when assigning an inactive service type', async () => {
    const { service } = makeService({
      get: {
        id: 'st-1',
        code: 'dine_in',
        displayName: 'Restoranda',
        iconKey: 'utensils',
        sortOrder: 30,
        isActive: false,
        createdAt: 't',
        updatedAt: 't',
      },
    });

    await expect(service.getServiceTypeByIdOrThrow('st-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('coerces numeric row fields when mapping', async () => {
    const { service } = makeService({
      all: [
        {
          id: 'currency-2',
          code: 'EUR',
          displayName: 'Euro',
          symbol: '€',
          numericCode: '978',
          decimalDigits: '2',
          sortOrder: '20',
          isActive: true,
          createdAt: 't',
          updatedAt: 't',
        },
      ],
    });

    const [eur] = await service.listActiveCurrencies();
    expect(eur.decimalDigits).toBe(2);
    expect(eur.sortOrder).toBe(20);
  });
});
