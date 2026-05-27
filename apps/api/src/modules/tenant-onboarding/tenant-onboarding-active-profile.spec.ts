import { CH_PACK, TR_PACK } from '@lieferzonen/config';
import { BadRequestException } from '@nestjs/common';
import { TenantOnboardingService } from './tenant-onboarding.service';
import { getTenantOnboardingPlanCatalog } from './tenant-onboarding-plan-catalog';
import { getTenantOnboardingComplianceCatalog } from './tenant-onboarding-compliance-catalog';

/**
 * MR-ARCH-03B consumer wiring: the onboarding service must read locale,
 * currency and country from the active InstallationProfile rather than the
 * old `country === 'CH' ? 'de-CH' : 'de-CH'` ternaries.
 */
describe('TenantOnboardingService active CountryPack resolution', () => {
  function makeService(activeCountry: 'CH' | 'TR' | null) {
    const installationProfileService = {
      findActiveCountryPolicy: jest.fn().mockResolvedValue(
        activeCountry === 'TR'
          ? {
              countryCode: 'TR',
              locale: 'tr-TR',
              currencyCode: 'TRY',
              timezone: 'Europe/Istanbul',
              pack: TR_PACK,
            }
          : activeCountry === 'CH'
            ? {
                countryCode: 'CH',
                locale: 'de-CH',
                currencyCode: 'CHF',
                timezone: 'Europe/Zurich',
                pack: CH_PACK,
              }
            : null,
      ),
    };
    const service = new TenantOnboardingService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      installationProfileService as any,
      {} as any,
      {} as any,
    );
    return { service, installationProfileService };
  }

  function resolveTriple(service: TenantOnboardingService) {
    return (service as any).resolveActiveCountryPack() as Promise<{
      country: string;
      language: string;
      currency: string;
    }>;
  }

  async function assertIban(service: TenantOnboardingService, iban: string) {
    return (service as any).assertIbanMatchesActiveCountry(iban) as Promise<void>;
  }

  it('returns TR/tr-TR/TRY for a TR installation, not the de-CH fallback', async () => {
    const { service } = makeService('TR');
    await expect(resolveTriple(service)).resolves.toEqual({
      country: 'TR',
      language: 'tr-TR',
      currency: 'TRY',
    });
  });

  it('returns CH/de-CH/CHF for a CH installation (regression check)', async () => {
    const { service } = makeService('CH');
    await expect(resolveTriple(service)).resolves.toEqual({
      country: 'CH',
      language: 'de-CH',
      currency: 'CHF',
    });
  });

  it('falls back to CH/de-CH/CHF only when no install profile exists', async () => {
    const { service } = makeService(null);
    await expect(resolveTriple(service)).resolves.toEqual({
      country: 'CH',
      language: 'de-CH',
      currency: 'CHF',
    });
  });

  it('IBAN validation rejects a CH IBAN on a TR install', async () => {
    const { service } = makeService('TR');
    await expect(
      assertIban(service, 'CH9300762011623852957'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('IBAN validation rejects a wrong-length IBAN even with the right prefix', async () => {
    const { service } = makeService('CH');
    // CH IBAN must be 21 chars per the pack — 18 chars must fail.
    await expect(assertIban(service, 'CH9300762011623852')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('IBAN validation accepts a valid CH IBAN on a CH install', async () => {
    const { service } = makeService('CH');
    await expect(assertIban(service, 'CH9300762011623852957')).resolves.toBeUndefined();
  });

  it('IBAN validation accepts a valid TR-shaped IBAN on a TR install', async () => {
    const { service } = makeService('TR');
    // 26 chars, TR prefix.
    await expect(assertIban(service, 'TR330006100519786457841326')).resolves.toBeUndefined();
  });

  it('IBAN validation is skipped silently when no install profile exists', async () => {
    const { service } = makeService(null);
    await expect(assertIban(service, 'CH9300762011623852957')).resolves.toBeUndefined();
  });
});

describe('Tenant onboarding plan + compliance catalogs', () => {
  it('plan catalog reflects the supplied country/currency (TR install)', () => {
    const plans = getTenantOnboardingPlanCatalog('TR', 'TRY');
    expect(plans).not.toHaveLength(0);
    for (const plan of plans) {
      expect(plan.country).toBe('TR');
      expect(plan.currency).toBe('TRY');
    }
  });

  it('plan catalog reflects the supplied country/currency (CH install)', () => {
    const plans = getTenantOnboardingPlanCatalog('CH', 'CHF');
    for (const plan of plans) {
      expect(plan.country).toBe('CH');
      expect(plan.currency).toBe('CHF');
    }
  });

  it('compliance catalog passes the supplied country/locale through', () => {
    const tr = getTenantOnboardingComplianceCatalog('TR', 'tr-TR');
    expect(tr.country).toBe('TR');
    expect(tr.language).toBe('tr-TR');
    for (const consent of tr.consents) {
      expect(consent.language).toBe('tr-TR');
    }
  });
});
