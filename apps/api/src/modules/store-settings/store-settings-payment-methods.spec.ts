import { BadRequestException } from '@nestjs/common';
import { StoreSettingsService } from './store-settings.service';

/**
 * Covers the backward-compatible paymentMethod (code) resolution added to the
 * tenant payment-method save. The tenant dashboard sends canonical codes, not
 * catalog UUIDs.
 */
describe('StoreSettingsService.replacePaymentMethods — code resolution', () => {
  function makeService(catalog: Record<string, string>) {
    const store = {
      getCanonicalPaymentMethodIdMap: jest.fn().mockResolvedValue(catalog),
      replacePaymentMethods: jest.fn().mockResolvedValue([]),
    };
    const systemTaxonomyService = {
      getPaymentMethodByIdOrThrow: jest.fn().mockResolvedValue({ id: 'x' }),
    };
    const service = new StoreSettingsService(
      store as any,
      {} as any,
      systemTaxonomyService as any,
      {} as any,
    );
    // Bypass ownership guard (tested elsewhere).
    (service as any).ensureOwnedStore = jest.fn().mockResolvedValue(undefined);
    return { service, store };
  }

  const CATALOG = { cash: 'cash-id', credit_card: 'cc-id' };

  it('resolves a paymentMethod code to its catalog id', async () => {
    const { service, store } = makeService(CATALOG);
    await service.replacePaymentMethods('store-1', 'tenant-1', {
      paymentMethods: [{ paymentMethod: 'cash', isActive: true }],
    } as any);
    expect(store.replacePaymentMethods).toHaveBeenCalledWith('store-1', [
      expect.objectContaining({ paymentMethodId: 'cash-id', isActive: true }),
    ]);
  });

  it('rejects an unknown payment method code', async () => {
    const { service } = makeService(CATALOG);
    await expect(
      service.replacePaymentMethods('store-1', 'tenant-1', {
        paymentMethods: [{ paymentMethod: 'bitcoin', isActive: true }],
      } as any),
    ).rejects.toMatchObject(
      new BadRequestException({
        code: 'payment_method_unavailable',
        message: 'Seçilen ödeme yöntemi geçersiz veya kullanılamıyor.',
      }),
    );
  });

  it('rejects when no payment method is active', async () => {
    const { service } = makeService(CATALOG);
    await expect(
      service.replacePaymentMethods('store-1', 'tenant-1', {
        paymentMethods: [{ paymentMethod: 'cash', isActive: false }],
      } as any),
    ).rejects.toMatchObject(
      new BadRequestException({
        code: 'at_least_one_payment_method_required',
        message: 'En az bir ödeme yöntemi aktif olmalıdır.',
      }),
    );
  });

  it('still accepts a paymentMethodId UUID (legacy contract)', async () => {
    const { service, store } = makeService(CATALOG);
    await service.replacePaymentMethods('store-1', 'tenant-1', {
      paymentMethods: [{ paymentMethodId: 'cc-id', isActive: true }],
    } as any);
    expect(store.replacePaymentMethods).toHaveBeenCalledWith('store-1', [
      expect.objectContaining({ paymentMethodId: 'cc-id', isActive: true }),
    ]);
  });
});
