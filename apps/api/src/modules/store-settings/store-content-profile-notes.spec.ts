import { StoreSettingsStore } from './store-settings.store';

/**
 * MR-DB-HARDENING-01 Slice 7C — profile notes now live on
 * StoreContentSetting.profileNotesJson (content model), not the legacy
 * StoreProfileNote(+Translation) tables. Reads are content-first with a
 * read-only legacy fallback; writes go to content only (no legacy write).
 * The returned shape stays backward-compatible.
 */
describe('StoreSettingsStore profile notes (content-backed, Slice 7C)', () => {
  const storeId = 'store-1';

  const contentRow = {
    id: 'content-1',
    storeId,
    defaultLocale: 'tr',
    socialLinksJson: {},
    marketingHeadline: 'Hi',
    marketingDescription: null,
    profileNotesJson: {},
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  };

  function buildStore(opts: {
    contentRow?: any;
    legacyRows?: any[];
    legacyTranslations?: any[];
  }) {
    const sql: string[] = [];
    const databaseService = {
      transaction: jest.fn(async (cb: () => unknown) => cb()),
      prepare: jest.fn((text: string) => {
        sql.push(text);
        return {
          get: jest.fn().mockImplementation(() => {
            if (text.includes('FROM "StoreContentSetting"')) {
              return Promise.resolve(opts.contentRow ?? null);
            }
            if (text.includes('UPDATE "StoreContentSetting"')) {
              return Promise.resolve(opts.contentRow ?? contentRow);
            }
            return Promise.resolve(undefined);
          }),
          all: jest.fn().mockImplementation(() => {
            if (text.includes('FROM "StoreProfileNoteTranslation"')) {
              return Promise.resolve(opts.legacyTranslations ?? []);
            }
            if (text.includes('FROM "StoreProfileNote"')) {
              return Promise.resolve(opts.legacyRows ?? []);
            }
            return Promise.resolve([]);
          }),
          run: jest.fn().mockResolvedValue({ rowCount: 1 }),
        };
      }),
    };
    const installationProfile = {
      findActiveCountryPolicy: jest.fn().mockResolvedValue(null),
    };
    const store = new StoreSettingsStore(
      databaseService as any,
      installationProfile as any,
    );
    return { store, sql };
  }

  it('reads profile notes from the content model (backward-compatible shape)', async () => {
    const { store, sql } = buildStore({
      contentRow: {
        ...contentRow,
        profileNotesJson: {
          profile: {
            isPublished: true,
            translations: [{ locale: 'tr', title: 'Hakkımızda', body: 'Metin' }],
            updatedAt: '2026-05-02T00:00:00.000Z',
          },
        },
      },
    });

    const notes = await store.listProfileNotes(storeId);

    expect(notes).toHaveLength(1);
    expect(notes[0]).toEqual(
      expect.objectContaining({
        id: 'store-1:profile',
        storeId,
        noteType: 'profile',
        isPublished: true,
      }),
    );
    expect(notes[0]?.translations[0]).toEqual(
      expect.objectContaining({ locale: 'tr', title: 'Hakkımızda', body: 'Metin' }),
    );
    // Read did not touch the legacy table when content has notes.
    expect(sql.some((s) => s.includes('FROM "StoreProfileNote"'))).toBe(false);
  });

  it('falls back to legacy (read-only) when content has no notes', async () => {
    const { store, sql } = buildStore({
      contentRow: { ...contentRow, profileNotesJson: {} },
      legacyRows: [
        {
          id: 'legacy-1',
          storeId,
          noteType: 'story',
          isPublished: true,
          createdAt: '2026-04-01T00:00:00.000Z',
          updatedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
      legacyTranslations: [],
    });

    const notes = await store.listProfileNotes(storeId);

    expect(notes).toHaveLength(1);
    expect(notes[0]?.noteType).toBe('story');
    expect(sql.some((s) => s.includes('FROM "StoreProfileNote"'))).toBe(true);
  });

  it('writes profile notes to content and never to the legacy table', async () => {
    const { store, sql } = buildStore({ contentRow });

    await store.upsertProfileNote(storeId, 'profile', {
      isPublished: true,
      translations: [{ locale: 'tr', title: 'Başlık', body: 'Gövde' }],
    });

    // Persisted via a targeted StoreContentSetting update...
    expect(sql.some((s) => s.includes('UPDATE "StoreContentSetting"'))).toBe(true);
    expect(
      sql.some((s) => /UPDATE "StoreContentSetting"[\s\S]*"profileNotesJson"/.test(s)),
    ).toBe(true);
    // ...and NOT through any legacy StoreProfileNote write.
    expect(sql.some((s) => s.includes('INSERT INTO "StoreProfileNote"'))).toBe(false);
    expect(sql.some((s) => s.includes('UPDATE "StoreProfileNote"'))).toBe(false);
    expect(sql.some((s) => s.includes('StoreProfileNoteTranslation'))).toBe(false);
  });
});
