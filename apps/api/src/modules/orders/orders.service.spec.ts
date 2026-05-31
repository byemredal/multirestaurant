import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';
import { StaffOrderListScope } from './dto/list-staff-orders.dto';

describe('OrdersService payment-outcome handling', () => {
  function orderRow(
    status: OrderStatus,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id: 'order-1',
      customerAccountId: 'customer-1',
      storeId: 'store-1',
      status,
      rejectedReason: null,
      statusNote: null,
      lastStatusChangedAt: null,
      lastStatusChangedByType: null,
      subtotalAmount: 10,
      totalAmount: 10,
      currencyId: null,
      currencySnapshot: 'CHF',
      serviceTypeId: null,
      serviceTypeSnapshot: 'delivery',
      paymentMethodId: null,
      paymentMethodSnapshot: null,
      deliveryFeeAmount: 0,
      deliveryDistanceKm: null,
      createdAt: new Date('2026-05-19T00:00:00.000Z'),
      updatedAt: new Date('2026-05-19T00:00:00.000Z'),
      ...overrides,
    };
  }

  function createService(overrides: { legalConsentService?: any } = {}) {
    const run = jest.fn();
    const databaseService = {
      transaction: jest.fn(async (callback: () => unknown) => callback()),
      prepare: jest.fn(() => ({ run })),
    };
    const legalConsentService = overrides.legalConsentService ?? {
      ensureAcceptanceForConfirmation: jest.fn().mockResolvedValue(undefined),
      // Mirrors LegalConsentService.getCheckoutLegalReadiness() — checkout's
      // platform legal gate. Default to "ready" so flows that are not exercising
      // the gate (e.g. order-detail shaping) pass through it.
      getCheckoutLegalReadiness: jest
        .fn()
        .mockResolvedValue({ legalReady: true, missingLegalDocuments: [] }),
    };

    const service = new OrdersService(
      databaseService as any,
      {} as any,
      { recordCompletedOrderReward: jest.fn() } as any,
      {} as any,
      legalConsentService as any,
      {} as any,
    );
    const serviceInternal = service as any;
    jest.spyOn(serviceInternal, 'createOrderStatusEvent').mockResolvedValue(undefined);

    return { service, serviceInternal, databaseService, run, legalConsentService };
  }

  it("transitions pending_payment -> pending_confirmation on a 'succeeded' outcome", async () => {
    const { service, serviceInternal, run, legalConsentService } = createService();
    jest
      .spyOn(serviceInternal, 'findOrderById')
      .mockResolvedValue(orderRow(OrderStatus.PENDING_PAYMENT));

    const result = await service.applyPaymentOutcome(
      'order-1',
      'succeeded',
      'Stripe payment confirmed.',
    );

    expect(legalConsentService.ensureAcceptanceForConfirmation).toHaveBeenCalledWith(
      'order-1',
    );
    expect(result).toEqual({ changed: true, status: OrderStatus.PENDING_CONFIRMATION });
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        $id: 'order-1',
        $status: OrderStatus.PENDING_CONFIRMATION,
        $lastStatusChangedByType: 'system',
      }),
    );
    expect(serviceInternal.createOrderStatusEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.PENDING_CONFIRMATION,
        actorType: 'system',
      }),
    );
  });

  it("blocks a 'succeeded' outcome when legal acceptance is missing (J-12)", async () => {
    const ensureFn = jest
      .fn()
      .mockRejectedValue(new BadRequestException('Order legal acceptance is required.'));
    const { service, serviceInternal, run } = createService({
      legalConsentService: { ensureAcceptanceForConfirmation: ensureFn },
    });
    jest
      .spyOn(serviceInternal, 'findOrderById')
      .mockResolvedValue(orderRow(OrderStatus.PENDING_PAYMENT));

    await expect(
      service.applyPaymentOutcome('order-1', 'succeeded', 'Paid.'),
    ).rejects.toBeInstanceOf(BadRequestException);

    // No order UPDATE and no status event because the legal gate threw first.
    expect(run).not.toHaveBeenCalled();
    expect(serviceInternal.createOrderStatusEvent).not.toHaveBeenCalled();
  });

  it("transitions pending_payment -> payment_failed on a 'failed' outcome, skipping the legal gate", async () => {
    const ensureFn = jest.fn();
    const { service, serviceInternal, run } = createService({
      legalConsentService: { ensureAcceptanceForConfirmation: ensureFn },
    });
    jest
      .spyOn(serviceInternal, 'findOrderById')
      .mockResolvedValue(orderRow(OrderStatus.PENDING_PAYMENT));

    const result = await service.applyPaymentOutcome(
      'order-1',
      'failed',
      'Card was declined.',
    );

    expect(result).toEqual({ changed: true, status: OrderStatus.PAYMENT_FAILED });
    expect(ensureFn).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ $status: OrderStatus.PAYMENT_FAILED }),
    );
  });

  it("transitions pending_payment -> payment_processing on a 'processing' outcome", async () => {
    const { service, serviceInternal } = createService();
    jest
      .spyOn(serviceInternal, 'findOrderById')
      .mockResolvedValue(orderRow(OrderStatus.PENDING_PAYMENT));

    const result = await service.applyPaymentOutcome(
      'order-1',
      'processing',
      'Async payment started.',
    );

    expect(result).toEqual({ changed: true, status: OrderStatus.PAYMENT_PROCESSING });
  });

  it('is idempotent — a duplicate succeeded outcome on an already-confirmed order is a no-op', async () => {
    const { service, serviceInternal, run } = createService();
    jest
      .spyOn(serviceInternal, 'findOrderById')
      .mockResolvedValue(orderRow(OrderStatus.PENDING_CONFIRMATION));

    const result = await service.applyPaymentOutcome(
      'order-1',
      'succeeded',
      'Duplicate webhook delivery.',
    );

    expect(result).toEqual({ changed: false, status: OrderStatus.PENDING_CONFIRMATION });
    expect(run).not.toHaveBeenCalled();
    expect(serviceInternal.createOrderStatusEvent).not.toHaveBeenCalled();
  });

  it('ignores a stale failed outcome once the order is operational', async () => {
    const { service, serviceInternal, run } = createService();
    jest
      .spyOn(serviceInternal, 'findOrderById')
      .mockResolvedValue(orderRow(OrderStatus.CONFIRMED));

    const result = await service.applyPaymentOutcome(
      'order-1',
      'failed',
      'Late/stale failure event.',
    );

    expect(result).toEqual({ changed: false, status: OrderStatus.CONFIRMED });
    expect(run).not.toHaveBeenCalled();
  });

  it('recovers a payment_failed order when a late succeeded outcome arrives', async () => {
    const { service, serviceInternal } = createService();
    jest
      .spyOn(serviceInternal, 'findOrderById')
      .mockResolvedValue(orderRow(OrderStatus.PAYMENT_FAILED));

    const result = await service.applyPaymentOutcome(
      'order-1',
      'succeeded',
      'Payment completed at the expiry edge.',
    );

    expect(result).toEqual({ changed: true, status: OrderStatus.PENDING_CONFIRMATION });
  });

  it('returns changed:false when the webhook references an unknown order', async () => {
    const { service, serviceInternal } = createService();
    jest.spyOn(serviceInternal, 'findOrderById').mockResolvedValue(undefined);

    const result = await service.applyPaymentOutcome('missing', 'succeeded', 'x');

    expect(result).toEqual({ changed: false, status: null });
  });
});

describe('OrdersService mutation response shaping', () => {
  function createService() {
    const run = jest.fn();
    const loyaltyStore = {
      recordCompletedOrderReward: jest.fn().mockResolvedValue(undefined),
    };
    const databaseService = {
      transaction: jest.fn(async (callback) => callback()),
      prepare: jest.fn(() => ({
        run,
        // createFromActiveCart reads the customer phone snapshot via .get and may
        // probe collections via .all; safe empty defaults keep this unit test on
        // the in-memory path (DB persistence is asserted via the spied getOrder).
        get: jest.fn().mockResolvedValue(undefined),
        all: jest.fn().mockResolvedValue([]),
      })),
    };

    const legalConsentService = {
      ensureAcceptanceForConfirmation: jest.fn().mockResolvedValue(undefined),
      // Mirrors LegalConsentService.getCheckoutLegalReadiness(); default to
      // "ready" so createFromActiveCart passes the platform legal gate here.
      getCheckoutLegalReadiness: jest.fn().mockResolvedValue({
        legalReady: true,
        missingLegalDocuments: [],
        placeholderLegalDocuments: [],
      }),
    };

    const service = new OrdersService(
      databaseService as any,
      {} as any,
      loyaltyStore as any,
      {} as any,
      legalConsentService as any,
      {} as any,
    );
    const serviceInternal = service as any;

    return { service, serviceInternal, databaseService, loyaltyStore, run, legalConsentService };
  }

  it('blocks createFromActiveCart when checkout legal documents are not ready (placeholder/missing)', async () => {
    const { service, serviceInternal, legalConsentService } = createService();

    jest
      .spyOn(serviceInternal, 'expireStalePendingPaymentOrdersForCustomer')
      .mockResolvedValue(undefined);
    jest.spyOn(serviceInternal, 'findCartByCustomerForUpdate').mockResolvedValue({
      id: 'cart-1',
      customerAccountId: 'customer-1',
      storeId: 'store-1',
      subtotalAmount: 18,
      totalAmount: 18,
      currencyId: null,
      currencySnapshot: 'CHF',
      createdAt: new Date('2026-04-11T00:00:00.000Z'),
      updatedAt: new Date('2026-04-11T00:00:00.000Z'),
    });
    // Simulate a required document that exists but carries placeholder content:
    // the readiness gate reports it as not-ready, so the order must be refused.
    legalConsentService.getCheckoutLegalReadiness.mockResolvedValue({
      legalReady: false,
      missingLegalDocuments: ['distance_sales_contract'],
      placeholderLegalDocuments: ['distance_sales_contract'],
    });

    await expect(service.createFromActiveCart('customer-1')).rejects.toMatchObject({
      response: { code: 'legal_documents_missing' },
    });
  });

  it('returns customer-shaped order detail after createFromActiveCart', async () => {
    const { service, serviceInternal } = createService();

    jest
      .spyOn(serviceInternal, 'expireStalePendingPaymentOrdersForCustomer')
      .mockResolvedValue(undefined);
    jest.spyOn(serviceInternal, 'findCartByCustomerForUpdate').mockResolvedValue({
      id: 'cart-1',
      customerAccountId: 'customer-1',
      storeId: 'store-1',
      subtotalAmount: 18,
      totalAmount: 18,
      currencyId: null,
      currencySnapshot: 'CHF',
      createdAt: new Date('2026-04-11T00:00:00.000Z'),
      updatedAt: new Date('2026-04-11T00:00:00.000Z'),
    });
    jest.spyOn(serviceInternal, 'findActivePendingPaymentOrder').mockResolvedValue(null);
    jest.spyOn(serviceInternal, 'buildValidationResult').mockResolvedValue({
      isValid: true,
      issues: [],
      blockingIssues: [],
      canCheckout: true,
      canUpdateCart: true,
      canRetryCheckout: true,
      nextAction: 'checkout',
      cart: null,
      cartItems: [
        {
          id: 'cart-item-1',
          menuItemId: 'menu-item-1',
          itemNameSnapshot: 'Bowl',
          unitBasePriceSnapshot: 18,
          currencySnapshot: 'CHF',
          quantity: 1,
          lineBaseTotal: 18,
          lineOptionsTotal: 0,
          lineTotal: 18,
          selectionSignature: '',
          selectedOptions: [],
        },
      ],
      totals: {
        subtotalAmount: 18,
        totalAmount: 18,
        currency: 'CHF',
      },
    });
    jest.spyOn(serviceInternal, 'loadCommerceContext').mockResolvedValue({
      orderingPolicy: {
        minOrderAmount: 0,
        acceptsDelivery: true,
        acceptsPickup: true,
        currencyCode: 'CHF',
      },
      paymentMethods: [{ paymentMethodId: 'pm-1', code: 'cash' }],
      deliveryFeeTiers: [],
    });
    jest.spyOn(serviceInternal, 'createOrderStatusEvent').mockResolvedValue(undefined);
    jest.spyOn(serviceInternal, 'deleteCart').mockResolvedValue(undefined);

    const getOrderSpy = jest.spyOn(service, 'getOrder').mockResolvedValue({
      order: {
        id: 'created-order',
        storeName: 'Harbor Kitchen',
        canCustomerCancel: true,
      },
    } as any);

    const result = await service.createFromActiveCart('customer-1');

    expect(getOrderSpy).toHaveBeenCalledWith('customer-1', expect.any(String));
    expect(result).toEqual({
      order: {
        id: 'created-order',
        storeName: 'Harbor Kitchen',
        canCustomerCancel: true,
      },
    });
  });

  it('returns tenant-shaped order detail after updateStatusForTenant', async () => {
    const { service, serviceInternal, run } = createService();

    jest.spyOn(serviceInternal, 'expirePendingPaymentOrderById').mockResolvedValue(undefined);
    jest.spyOn(serviceInternal, 'findOrderForOwnedStore').mockResolvedValue({
      id: 'order-1',
      customerAccountId: 'customer-1',
      storeId: 'store-1',
      status: OrderStatus.PENDING_CONFIRMATION,
      rejectedReason: null,
      statusNote: null,
      lastStatusChangedAt: null,
      lastStatusChangedByType: null,
      subtotalAmount: 18,
      totalAmount: 18,
      currencyId: null,
      currencySnapshot: 'CHF',
      createdAt: new Date('2026-04-11T00:00:00.000Z'),
      updatedAt: new Date('2026-04-11T00:00:00.000Z'),
    });
    jest.spyOn(serviceInternal, 'createOrderStatusEvent').mockResolvedValue(undefined);

    const getOrderForTenantSpy = jest.spyOn(service, 'getOrderForTenant').mockResolvedValue({
      order: {
        id: 'order-1',
        storeName: 'Harbor Kitchen',
        customerSummary: {
          fullName: 'Ada Lovelace',
        },
      },
    } as any);

    const result = await service.updateStatusForTenant('tenant-1', 'order-1', {
      status: OrderStatus.CONFIRMED,
    });

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        $id: 'order-1',
        $status: OrderStatus.CONFIRMED,
      }),
    );
    expect(getOrderForTenantSpy).toHaveBeenCalledWith('tenant-1', 'order-1');
    expect(result).toEqual({
      order: {
        id: 'order-1',
        storeName: 'Harbor Kitchen',
        customerSummary: {
          fullName: 'Ada Lovelace',
        },
      },
    });
  });

  it('records loyalty activity when a tenant completes an order', async () => {
    const { service, serviceInternal, loyaltyStore } = createService();

    jest.spyOn(serviceInternal, 'expirePendingPaymentOrderById').mockResolvedValue(undefined);
    jest.spyOn(serviceInternal, 'findOrderForOwnedStore').mockResolvedValue({
      id: 'order-2',
      customerAccountId: 'customer-7',
      storeId: 'store-3',
      status: OrderStatus.READY,
      rejectedReason: null,
      statusNote: null,
      lastStatusChangedAt: null,
      lastStatusChangedByType: null,
      subtotalAmount: 26,
      totalAmount: 26,
      currencyId: null,
      currencySnapshot: 'CHF',
      createdAt: new Date('2026-04-11T00:00:00.000Z'),
      updatedAt: new Date('2026-04-11T00:00:00.000Z'),
    });
    jest.spyOn(serviceInternal, 'createOrderStatusEvent').mockResolvedValue(undefined);
    jest.spyOn(service, 'getOrderForTenant').mockResolvedValue({ order: { id: 'order-2' } } as any);

    await service.updateStatusForTenant('tenant-1', 'order-2', {
      status: OrderStatus.COMPLETED,
    });

    expect(loyaltyStore.recordCompletedOrderReward).toHaveBeenCalledWith({
      customerAccountId: 'customer-7',
      storeId: 'store-3',
      orderId: 'order-2',
      totalAmount: 26,
      currency: 'CHF',
    });
  });
});

describe('OrdersService admin operational listing', () => {
  function adminOrderRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'order-9',
      customerAccountId: 'customer-9',
      storeId: 'store-9',
      status: OrderStatus.PREPARING,
      rejectedReason: null,
      statusNote: null,
      lastStatusChangedAt: null,
      lastStatusChangedByType: null,
      subtotalAmount: 42,
      totalAmount: 42,
      currencyId: null,
      currencySnapshot: 'CHF',
      serviceTypeId: null,
      serviceTypeSnapshot: 'delivery',
      paymentMethodId: null,
      paymentMethodSnapshot: null,
      deliveryFeeAmount: 0,
      deliveryDistanceKm: null,
      createdAt: '2026-05-19T00:00:00.000Z',
      updatedAt: '2026-05-19T00:00:00.000Z',
      storeName: 'Harbor Kitchen',
      customerFirstName: 'Ada',
      customerLastName: 'Lovelace',
      customerEmail: 'ada@example.io',
      itemCount: 3,
      ...overrides,
    };
  }

  function createService(rows: Array<Record<string, unknown>>) {
    const all = jest.fn().mockResolvedValue(rows);
    const databaseService = {
      transaction: jest.fn(async (callback: () => unknown) => callback()),
      prepare: jest.fn(() => ({ all })),
    };
    const service = new OrdersService(
      databaseService as any,
      {} as any,
      { recordCompletedOrderReward: jest.fn() } as any,
      {} as any,
      { ensureAcceptanceForConfirmation: jest.fn() } as any,
      {} as any,
    );
    return { service, all };
  }

  it('maps platform-wide orders into admin oversight rows', async () => {
    const { service } = createService([adminOrderRow()]);

    const result = await service.listForAdmin({});

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'order-9',
        status: OrderStatus.PREPARING,
        storeName: 'Harbor Kitchen',
        itemCount: 3,
        isActionable: true,
      }),
    );
    expect(result[0].customerSummary).toEqual(
      expect.objectContaining({ fullName: 'Ada Lovelace', email: 'ada@example.io' }),
    );
  });

  it('passes an explicit status filter through to the query', async () => {
    const { service, all } = createService([]);

    await service.listForAdmin({ status: OrderStatus.COMPLETED });

    expect(all).toHaveBeenCalledWith(
      expect.objectContaining({ $status: OrderStatus.COMPLETED }),
    );
  });
});

describe('OrdersService staff-scoped listing', () => {
  function staffOrderRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'order-staff-1',
      customerAccountId: 'customer-1',
      storeId: 'store-A',
      status: OrderStatus.PENDING_CONFIRMATION,
      rejectedReason: null,
      statusNote: null,
      lastStatusChangedAt: null,
      lastStatusChangedByType: null,
      subtotalAmount: 32,
      totalAmount: 32,
      currencyId: null,
      currencySnapshot: 'CHF',
      serviceTypeId: null,
      serviceTypeSnapshot: 'delivery',
      paymentMethodId: null,
      paymentMethodSnapshot: null,
      deliveryFeeAmount: 0,
      deliveryDistanceKm: null,
      createdAt: '2026-05-25T00:00:00.000Z',
      updatedAt: '2026-05-25T00:00:00.000Z',
      storeName: 'Harbor Kitchen',
      customerFirstName: 'Ada',
      customerLastName: 'Lovelace',
      customerEmail: 'ada@example.io',
      itemCount: 2,
      ...overrides,
    };
  }

  function createService(rows: Array<Record<string, unknown>> = []) {
    const all = jest.fn().mockResolvedValue(rows);
    const databaseService = {
      transaction: jest.fn(async (callback: () => unknown) => callback()),
      prepare: jest.fn(() => ({ all })),
    };
    const service = new OrdersService(
      databaseService as any,
      {} as any,
      { recordCompletedOrderReward: jest.fn() } as any,
      {} as any,
      { ensureAcceptanceForConfirmation: jest.fn() } as any,
      {} as any,
    );
    return { service, all };
  }

  it('fails closed when the staff scope is empty', async () => {
    const { service, all } = createService();

    await expect(service.listForStaff([], {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(all).not.toHaveBeenCalled();
  });

  it('lists orders only for stores in the assigned scope (default scope = operational)', async () => {
    const { service, all } = createService([staffOrderRow()]);

    const result = await service.listForStaff(['store-A', 'store-B'], {});

    expect(all).toHaveBeenCalledWith(
      expect.objectContaining({ $storeIds: ['store-A', 'store-B'] }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: 'order-staff-1',
        storeId: 'store-A',
        storeName: 'Harbor Kitchen',
        itemCount: 2,
        isActionable: true,
      }),
    );
    expect(result[0].customerSummary).toEqual(
      expect.objectContaining({ fullName: 'Ada Lovelace', email: 'ada@example.io' }),
    );
  });

  it('denies a storeId filter that lies outside the assigned scope', async () => {
    const { service, all } = createService();

    await expect(
      service.listForStaff(['store-A'], { storeId: 'store-OTHER' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(all).not.toHaveBeenCalled();
  });

  it('narrows the query to a single storeId when it is in scope', async () => {
    const { service, all } = createService([]);

    await service.listForStaff(['store-A', 'store-B'], { storeId: 'store-A' });

    expect(all).toHaveBeenCalledWith(
      expect.objectContaining({ $storeIds: ['store-A'] }),
    );
  });

  it('applies the history scope status set when scope=history is requested', async () => {
    const { service, all } = createService([]);

    await service.listForStaff(['store-A'], { scope: StaffOrderListScope.HISTORY });

    expect(all).toHaveBeenCalledWith(
      expect.objectContaining({
        $storeIds: ['store-A'],
        $completedStatus: OrderStatus.COMPLETED,
        $rejectedStatus: OrderStatus.REJECTED,
        $cancelledStatus: OrderStatus.CANCELLED,
        $paymentFailedStatus: OrderStatus.PAYMENT_FAILED,
        $pendingPaymentStatus: OrderStatus.PENDING_PAYMENT,
      }),
    );
  });

  it('passes an explicit status filter through to the query', async () => {
    const { service, all } = createService([]);

    await service.listForStaff(['store-A'], { status: OrderStatus.READY });

    expect(all).toHaveBeenCalledWith(
      expect.objectContaining({
        $storeIds: ['store-A'],
        $status: OrderStatus.READY,
      }),
    );
  });

  it('rejects an inverted createdFrom/createdTo window', async () => {
    const { service } = createService();

    await expect(
      service.listForStaff(['store-A'], {
        createdFrom: '2026-05-25T18:00:00.000Z',
        createdTo: '2026-05-25T09:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not include passwordHash / tokenHash columns in returned rows', async () => {
    const { service } = createService([staffOrderRow()]);

    const result = await service.listForStaff(['store-A'], {});

    const exposed = Object.keys(result[0]);
    expect(exposed).not.toContain('passwordHash');
    expect(exposed).not.toContain('tokenHash');
    const customerSummaryKeys = Object.keys(result[0].customerSummary);
    expect(customerSummaryKeys).not.toContain('passwordHash');
    expect(customerSummaryKeys).not.toContain('tokenHash');
  });
});
