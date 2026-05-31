import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LegalConsentService } from './legal-consent.service';

/**
 * MR-DB-HARDENING-01 Slice 7E-c-prep — the tenant-facing createStoreAddendum now
 * keyed-upserts on (storeId, parentDocumentVersionId, locale) instead of a plain
 * INSERT, so repeated saves update the existing row rather than creating
 * duplicates. This makes the table safe for a future
 * UNIQUE(storeId, parentDocumentVersionId, locale). Ownership + parent
 * validation + response shape are preserved.
 */
describe('LegalConsentService.createStoreAddendum keyed-upsert', () => {
  const storeId = 'store-1';
  const tenantId = 'tenant-1';
  const parentId = 'ver-1';

  function buildService(opts: {
    owned?: boolean;
    parentExists?: boolean;
    existingAddendum?: boolean;
  } = {}) {
    const sqls: string[] = [];

    const makeRow = (params: Record<string, any>, id: string) => ({
      id,
      storeId,
      parentDocumentVersionId: params.$parentVersionId ?? parentId,
      title: params.$title ?? 'T',
      body: params.$body ?? 'B',
      locale: params.$locale ?? 'tr',
      isActive: params.$isActive ?? true,
      createdAt: new Date('2026-05-20T00:00:00.000Z'),
      updatedAt: new Date('2026-05-20T00:00:00.000Z'),
    });

    const prepare = jest.fn((sql: string) => {
      sqls.push(sql);
      return {
        get: jest.fn(async (params: Record<string, any> = {}) => {
          if (sql.includes('FROM "PlatformLegalDocumentVersion"')) {
            return opts.parentExists === false ? undefined : { id: params.$id };
          }
          if (sql.includes('SELECT "id" FROM "StoreTermsAddendum"')) {
            return opts.existingAddendum ? { id: 'existing-1' } : undefined;
          }
          if (sql.includes('UPDATE "StoreTermsAddendum"')) {
            return makeRow(params, 'existing-1');
          }
          if (sql.includes('INSERT INTO "StoreTermsAddendum"')) {
            return makeRow(params, 'new-1');
          }
          return undefined;
        }),
        all: jest.fn().mockResolvedValue([]),
        run: jest.fn().mockResolvedValue({ rowCount: 1 }),
      };
    });

    const databaseService = { prepare, transaction: jest.fn() } as any;
    const auditLogService = { log: jest.fn().mockResolvedValue(undefined) } as any;
    const storesService = {
      findOwnedStore: jest
        .fn()
        .mockResolvedValue(opts.owned === false ? null : { id: storeId }),
    } as any;

    const installationProfileService = {
      findActiveCountryPolicy: jest.fn().mockResolvedValue({ countryCode: 'TR' }),
    } as any;

    const service = new LegalConsentService(
      databaseService,
      auditLogService,
      storesService,
      installationProfileService,
    );
    return { service, sqls, storesService };
  }

  const dto = (over: Record<string, any> = {}) => ({
    parentDocumentVersionId: parentId,
    title: 'Şartlar',
    body: 'Gövde',
    locale: 'tr',
    isActive: true,
    ...over,
  });

  const has = (sqls: string[], fragment: string) =>
    sqls.some((sql) => sql.includes(fragment));

  it('inserts on the first call (no existing keyed row)', async () => {
    const { service, sqls } = buildService({ existingAddendum: false });

    const result = await service.createStoreAddendum(storeId, tenantId, dto() as any);

    expect(has(sqls, 'INSERT INTO "StoreTermsAddendum"')).toBe(true);
    expect(has(sqls, 'UPDATE "StoreTermsAddendum"')).toBe(false);
    expect(result.id).toBe('new-1');
    expect(result.locale).toBe('tr');
  });

  it('updates the existing row on a repeated save (same store+parent+locale) — no duplicate', async () => {
    const { service, sqls } = buildService({ existingAddendum: true });

    const result = await service.createStoreAddendum(storeId, tenantId, dto() as any);

    expect(has(sqls, 'UPDATE "StoreTermsAddendum"')).toBe(true);
    expect(has(sqls, 'INSERT INTO "StoreTermsAddendum"')).toBe(false);
    expect(result.id).toBe('existing-1');
  });

  it('inserts a separate row for a different locale', async () => {
    // No keyed row exists for the new locale → insert path.
    const { service, sqls } = buildService({ existingAddendum: false });

    await service.createStoreAddendum(storeId, tenantId, dto({ locale: 'de' }) as any);

    expect(has(sqls, 'INSERT INTO "StoreTermsAddendum"')).toBe(true);
  });

  it('inserts a separate row for a different parentDocumentVersionId', async () => {
    const { service, sqls } = buildService({ existingAddendum: false });

    await service.createStoreAddendum(
      storeId,
      tenantId,
      dto({ parentDocumentVersionId: 'ver-2' }) as any,
    );

    expect(has(sqls, 'INSERT INTO "StoreTermsAddendum"')).toBe(true);
  });

  it('rejects a cross-tenant store and writes nothing', async () => {
    const { service, sqls } = buildService({ owned: false });

    await expect(
      service.createStoreAddendum(storeId, tenantId, dto() as any),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(has(sqls, 'INSERT INTO "StoreTermsAddendum"')).toBe(false);
    expect(has(sqls, 'UPDATE "StoreTermsAddendum"')).toBe(false);
  });

  it('rejects an unknown parentDocumentVersionId', async () => {
    const { service, sqls } = buildService({ parentExists: false });

    await expect(
      service.createStoreAddendum(storeId, tenantId, dto() as any),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(has(sqls, 'INSERT INTO "StoreTermsAddendum"')).toBe(false);
    expect(has(sqls, 'UPDATE "StoreTermsAddendum"')).toBe(false);
  });
});
