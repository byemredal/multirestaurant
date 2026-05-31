import { SetupStore } from './setup.store';

/**
 * MR-DB-HARDENING-01 Slice 7B — setup initialization must no longer write to the
 * legacy "LegalDocument" table (a dead write with no runtime reader). It must
 * still complete normally, seeding AdminAccount / PlatformSetup /
 * InstallationProfile. See docs/architecture/legacy-legal-profile-migration.md.
 */
describe('SetupStore.initialize legacy LegalDocument write removal', () => {
  function buildStore() {
    const preparedSql: string[] = [];
    const run = jest.fn().mockResolvedValue({ rowCount: 1 });
    const get = jest.fn().mockResolvedValue(undefined);
    const databaseService = {
      transaction: jest.fn(async (cb: () => unknown) => cb()),
      prepare: jest.fn((sql: string) => {
        preparedSql.push(sql);
        return { run, get };
      }),
    };
    const store = new SetupStore(databaseService as any);
    return { store, preparedSql };
  }

  const input = {
    adminId: 'admin-1',
    adminEmail: 'admin@example.io',
    passwordHash: 'hash',
    adminFirstName: 'Admin',
    adminLastName: 'Owner',
    platformName: 'Platform',
    supportEmail: 'support@example.io',
    logoUrl: null,
    primaryCountry: 'CH',
    defaultLanguage: 'de',
    defaultCurrency: 'CHF',
    defaultTimezone: 'Europe/Zurich',
    packVersion: '1.0.0',
  } as any;

  it('prepares no INSERT INTO "LegalDocument" statement', async () => {
    const { store, preparedSql } = buildStore();

    await store.initialize(input);

    const legalWrites = preparedSql.filter((sql) => sql.includes('"LegalDocument"'));
    expect(legalWrites).toHaveLength(0);
  });

  it('still seeds AdminAccount, PlatformSetup and InstallationProfile', async () => {
    const { store, preparedSql } = buildStore();

    await store.initialize(input);

    const joined = preparedSql.join('\n');
    expect(joined).toContain('INSERT INTO "AdminAccount"');
    expect(joined).toContain('INSERT INTO "PlatformSetup"');
    expect(joined).toContain('INSERT INTO "InstallationProfile"');
  });
});
