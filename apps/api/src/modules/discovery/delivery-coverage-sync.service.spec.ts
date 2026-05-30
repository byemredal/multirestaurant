import { ConflictException } from '@nestjs/common';
import { CH_PACK, TR_PACK } from '@lieferzonen/config';
import { DeliveryCoverageSyncService, LegacyDeliveryZoneInput } from './delivery-coverage-sync.service';

/**
 * MR-DELIVERY-ZONES-UX-AND-COVERAGE-01 — country-aware coverage postal validation.
 *
 * The sync layer must reject postal codes that don't match the active platform
 * country's regex (TR=5 digits, CH=4 digits 1000-9999). Unknown free-text store
 * country must fall back to the platform's country, never to a hardcoded 'CH'.
 */
describe('DeliveryCoverageSyncService — coverage postal validation', () => {
  type RunCall = { sql: string; params: Record<string, unknown> };

  function buildService(activeCountry: 'TR' | 'CH' | null) {
    const calls: RunCall[] = [];
    const prepare = jest.fn((sql: string) => ({
      run: jest.fn(async (params: Record<string, unknown>) => {
        calls.push({ sql, params });
      }),
      get: jest.fn(),
      all: jest.fn(),
    }));
    const databaseService = {
      isTransactionActive: jest.fn().mockReturnValue(true),
      prepare,
    };
    const installationProfile = {
      findActiveCountryPolicy: jest.fn().mockResolvedValue(
        activeCountry === 'TR'
          ? { countryCode: 'TR', pack: TR_PACK }
          : activeCountry === 'CH'
            ? { countryCode: 'CH', pack: CH_PACK }
            : null,
      ),
    };

    const service = new DeliveryCoverageSyncService(
      databaseService as any,
      installationProfile as any,
    );
    return { service, calls, prepare };
  }

  function zone(overrides: Partial<LegacyDeliveryZoneInput> = {}): LegacyDeliveryZoneInput {
    return {
      id: 'zone-1',
      name: 'Yakın çevre',
      postalCodes: [],
      radiusKm: null,
      minimumOrderAmount: null,
      deliveryFee: null,
      estimatedDeliveryMinutes: null,
      ...overrides,
    };
  }

  describe('resolveCountryCode', () => {
    it('returns the platform country fallback for empty input', () => {
      const { service } = buildService('TR');
      expect(service.resolveCountryCode('', 'TR')).toBe('TR');
      expect(service.resolveCountryCode(null, 'TR')).toBe('TR');
    });

    it('maps Switzerland aliases to CH', () => {
      const { service } = buildService('CH');
      expect(service.resolveCountryCode('Schweiz', 'CH')).toBe('CH');
      expect(service.resolveCountryCode('Suisse', 'CH')).toBe('CH');
    });

    it('does not fall back to hardcoded CH for unknown free text', () => {
      const { service } = buildService('TR');
      expect(service.resolveCountryCode('Atlantis', 'TR')).toBe('TR');
    });

    it('passes through 2-letter ISO codes', () => {
      const { service } = buildService('TR');
      expect(service.resolveCountryCode('TR', 'CH')).toBe('TR');
    });
  });

  describe('syncFromLegacyZones — TR platform', () => {
    it('accepts valid TR 5-digit postal codes', async () => {
      const { service } = buildService('TR');
      await expect(
        service.syncFromLegacyZones(
          'store-1',
          [zone({ postalCodes: ['34758', '34000'] })],
          'TR',
          new Date('2026-05-30T00:00:00Z'),
        ),
      ).resolves.toBeUndefined();
    });

    it('rejects CH-shaped postal codes with invalid_coverage_postal_code', async () => {
      const { service } = buildService('TR');
      const error = await service
        .syncFromLegacyZones(
          'store-1',
          [zone({ postalCodes: ['8003'] })],
          'TR',
          new Date(),
        )
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'invalid_coverage_postal_code',
      });
    });
  });

  describe('syncFromLegacyZones — CH platform', () => {
    it('accepts valid CH 4-digit postal codes', async () => {
      const { service } = buildService('CH');
      await expect(
        service.syncFromLegacyZones(
          'store-1',
          [zone({ postalCodes: ['8003', '8004'] })],
          'CH',
          new Date(),
        ),
      ).resolves.toBeUndefined();
    });

    it('rejects TR 5-digit codes', async () => {
      const { service } = buildService('CH');
      const error = await service
        .syncFromLegacyZones(
          'store-1',
          [zone({ postalCodes: ['34758'] })],
          'CH',
          new Date(),
        )
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'invalid_coverage_postal_code',
      });
    });
  });

  it('deduplicates postal codes and ignores empty entries', async () => {
    const { service, calls } = buildService('TR');
    await service.syncFromLegacyZones(
      'store-1',
      [zone({ postalCodes: ['34758', '', '34758', ' 34758 '] })],
      'TR',
      new Date(),
    );

    const postalInserts = calls.filter((c) => c.sql.includes('StoreCoveragePostalCode'));
    expect(postalInserts).toHaveLength(1);
    expect(postalInserts[0]?.params.$postalCode).toBe('34758');
  });
});
