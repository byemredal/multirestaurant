import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../../database/database.service';
import { CustomerLoyaltyStore } from '../auth/customer-loyalty.store';
import { LegalConsentService } from '../legal-consent/legal-consent.service';
import { StoresService } from '../stores/stores.service';
import { StoreSettingsStore } from '../store-settings/store-settings.store';
import {
  StoreDeliveryFeeTier,
  StoreOrderingPolicy,
  StorePaymentMethodView,
} from '../store-settings/entities/commerce.entity';
import { SystemTaxonomyService } from '../system-taxonomy/system-taxonomy.service';
import {
  CustomerOrderListScope,
  ListCustomerOrdersDto,
} from './dto/list-customer-orders.dto';
import { CancelCustomerOrderDto } from './dto/cancel-customer-order.dto';
import { CreateCustomerOrderDto } from './dto/create-customer-order.dto';
import { ListAdminOrdersDto } from './dto/list-admin-orders.dto';
import {
  ListTenantOrdersDto,
  TenantOrderListScope,
} from './dto/list-tenant-orders.dto';
import { UpdateTenantOrderStatusDto } from './dto/update-tenant-order-status.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemOptionSelection } from './entities/order-item-option-selection.entity';
import { OrderStatusEvent } from './entities/order-status-event.entity';

/**
 * Synthetic actor id recorded on order-status events that are driven by the
 * system rather than a human — payment webhooks and the pending-payment
 * expiry sweeper. It is a nil UUID so it never collides with a real account.
 */
export const SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

/** Outcome of a payment as reported by an authoritative Stripe webhook event. */
export type PaymentOutcome =
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'expired';

@Injectable()
export class OrdersService {
  private readonly pendingPaymentTtlMs = 30 * 60 * 1000;
  private readonly tenantDefaultOperationalStatuses: OrderStatus[] = [
    OrderStatus.PENDING_CONFIRMATION,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
  ];
  private readonly customerActiveStatuses: OrderStatus[] = [
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.PAYMENT_PROCESSING,
    OrderStatus.PENDING_CONFIRMATION,
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.READY,
  ];
  private readonly customerHistoryStatuses: OrderStatus[] = [
    OrderStatus.COMPLETED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
    OrderStatus.PAYMENT_FAILED,
  ];
  private readonly tenantTransitionMap: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING_PAYMENT]: [],
    [OrderStatus.PAYMENT_PROCESSING]: [],
    [OrderStatus.PAYMENT_FAILED]: [],
    [OrderStatus.PENDING_CONFIRMATION]: [
      OrderStatus.CONFIRMED,
      OrderStatus.REJECTED,
      OrderStatus.CANCELLED,
    ],
    [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
    [OrderStatus.READY]: [OrderStatus.COMPLETED],
    [OrderStatus.COMPLETED]: [],
    [OrderStatus.REJECTED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  private readonly validationNextActions = {
    checkout: 'checkout',
    updateCart: 'update_cart',
    waitForPayment: 'wait_for_payment',
    startCart: 'start_cart',
  } as const;

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storesService: StoresService,
    private readonly customerLoyaltyStore: CustomerLoyaltyStore,
    private readonly storeSettingsStore: StoreSettingsStore,
    private readonly legalConsentService: LegalConsentService,
    private readonly systemTaxonomyService: SystemTaxonomyService,
  ) {}

  private resolveDeliveryFee(
    tiers: StoreDeliveryFeeTier[],
    distanceKm: number | null,
  ): number {
    if (distanceKm === null || distanceKm === undefined) {
      return 0;
    }
    const activeTiers = tiers.filter((tier) => tier.isActive);
    const match = activeTiers.find(
      (tier) => distanceKm >= tier.minDistanceKm && distanceKm <= tier.maxDistanceKm,
    );
    return match ? match.feeAmount : 0;
  }

  private async loadCommerceContext(storeId: string) {
    const [orderingPolicy, paymentMethods, deliveryFeeTiers] = await Promise.all([
      this.storeSettingsStore.getOrCreateOrderingPolicy(storeId),
      this.storeSettingsStore.listActivePaymentMethods(storeId),
      this.storeSettingsStore.listDeliveryFeeTiers(storeId),
    ]);
    return { orderingPolicy, paymentMethods, deliveryFeeTiers };
  }

  private buildCommerceBlockingIssues(args: {
    orderingPolicy: StoreOrderingPolicy;
    paymentMethods: StorePaymentMethodView[];
    deliveryFeeTiers: StoreDeliveryFeeTier[];
    subtotalAmount: number;
    serviceType: string;
    deliveryDistanceKm: number | null;
  }) {
    const issues: ReturnType<typeof this.createBlockingIssue>[] = [];
    const { orderingPolicy, paymentMethods, deliveryFeeTiers } = args;

    if (paymentMethods.length === 0) {
      issues.push(
        this.createBlockingIssue({
          code: 'NO_ACTIVE_PAYMENT_METHOD',
          message:
            'Bu restoran şu anda hiçbir ödeme yöntemini desteklemiyor. Lütfen daha sonra tekrar deneyin.',
          entityType: 'store',
          canRetry: false,
        }),
      );
    }

    if (args.subtotalAmount < orderingPolicy.minOrderAmount) {
      issues.push(
        this.createBlockingIssue({
          code: 'MIN_ORDER_AMOUNT_NOT_MET',
          message: `Minimum sipariş tutarı ${orderingPolicy.minOrderAmount} ${orderingPolicy.currencyCode}. Sepetinizdeki tutar yetersiz.`,
          entityType: 'cart',
          canRetry: true,
        }),
      );
    }

    if (args.serviceType === 'delivery' && !orderingPolicy.acceptsDelivery) {
      issues.push(
        this.createBlockingIssue({
          code: 'DELIVERY_NOT_ACCEPTED',
          message: 'Bu restoran şu anda teslimat siparişi kabul etmiyor.',
          entityType: 'store',
          canRetry: false,
        }),
      );
    }

    if (args.serviceType === 'pickup' && !orderingPolicy.acceptsPickup) {
      issues.push(
        this.createBlockingIssue({
          code: 'PICKUP_NOT_ACCEPTED',
          message: 'Bu restoran şu anda gel-al siparişi kabul etmiyor.',
          entityType: 'store',
          canRetry: false,
        }),
      );
    }

    if (
      args.serviceType === 'delivery' &&
      deliveryFeeTiers.filter((tier) => tier.isActive).length > 0 &&
      args.deliveryDistanceKm !== null
    ) {
      const match = deliveryFeeTiers
        .filter((tier) => tier.isActive)
        .find(
          (tier) =>
            args.deliveryDistanceKm! >= tier.minDistanceKm &&
            args.deliveryDistanceKm! <= tier.maxDistanceKm,
        );
      if (!match) {
        issues.push(
          this.createBlockingIssue({
            code: 'DELIVERY_OUT_OF_RANGE',
            message: 'Adresiniz tanımlı teslimat bölgesi dışında. Lütfen gel-al seçeneğini değerlendirin.',
            entityType: 'cart',
            canRetry: true,
          }),
        );
      }
    }

    return issues;
  }

  async getCheckoutReadiness(customerAccountId: string) {
    await this.expireStalePendingPaymentOrdersForCustomer(customerAccountId);

    const cart = await this.findCartByCustomer(customerAccountId);
    if (!cart) {
      return {
        isReady: false,
        hasBlockingIssues: true,
        canCheckout: false,
        canUpdateCart: false,
        canRetryCheckout: false,
        nextAction: this.validationNextActions.startCart,
        reasons: ['Your active cart is empty.'],
        blockingIssues: [
          this.createBlockingIssue({
            code: 'CART_EMPTY',
            message: 'Your active cart is empty.',
            entityType: 'cart',
            canRetry: false,
          }),
        ],
        subtotalAmount: null,
        totalAmount: null,
        currency: null,
        existingPendingPaymentOrderId: null,
        pendingPaymentExpiresAt: null,
        cart: null,
        cartItems: [],
      };
    }

    const validation = await this.buildValidationResult(cart);
    const pendingPaymentOrder = await this.findActivePendingPaymentOrder(
      customerAccountId,
      cart.storeId,
    );
    const blockingIssues = [...validation.blockingIssues];
    const reasons = [...validation.issues];

    if (pendingPaymentOrder) {
      const issue = this.createBlockingIssue({
        code: 'PENDING_PAYMENT_ORDER_EXISTS',
        message: 'A checkout is already pending payment for this store.',
        entityType: 'order',
        entityId: pendingPaymentOrder.id,
        entityName: pendingPaymentOrder.id,
        canRetry: true,
      });
      blockingIssues.push(issue);
      reasons.push(issue.message);
    }

    const commerce = await this.loadCommerceContext(cart.storeId);
    const subtotalForGate = validation.totals?.subtotalAmount ?? Number(cart.subtotalAmount);
    const serviceType = cart.serviceTypeSnapshot ?? 'delivery';
    const deliveryDistanceKm =
      cart.deliveryDistanceKm === null || cart.deliveryDistanceKm === undefined
        ? null
        : Number(cart.deliveryDistanceKm);
    const commerceIssues = this.buildCommerceBlockingIssues({
      orderingPolicy: commerce.orderingPolicy,
      paymentMethods: commerce.paymentMethods,
      deliveryFeeTiers: commerce.deliveryFeeTiers,
      subtotalAmount: subtotalForGate,
      serviceType,
      deliveryDistanceKm,
    });
    for (const issue of commerceIssues) {
      blockingIssues.push(issue);
      reasons.push(issue.message);
    }

    const deliveryFeeAmount =
      serviceType === 'delivery'
        ? this.resolveDeliveryFee(commerce.deliveryFeeTiers, deliveryDistanceKm)
        : 0;

    const computedTotal = this.roundPrice(subtotalForGate + deliveryFeeAmount);
    const nextAction = pendingPaymentOrder
      ? this.validationNextActions.waitForPayment
      : validation.nextAction;

    return {
      isReady: reasons.length === 0,
      hasBlockingIssues: reasons.length > 0,
      canCheckout: reasons.length === 0,
      canUpdateCart: true,
      canRetryCheckout: pendingPaymentOrder ? true : validation.canRetryCheckout,
      nextAction,
      reasons,
      blockingIssues,
      subtotalAmount: subtotalForGate,
      totalAmount: computedTotal,
      currency: validation.totals?.currency ?? cart.currencySnapshot,
      existingPendingPaymentOrderId: pendingPaymentOrder?.id ?? null,
      pendingPaymentExpiresAt: pendingPaymentOrder
        ? this.getPendingPaymentExpiryDate(pendingPaymentOrder.createdAt).toISOString()
        : null,
      cart: validation.cart,
      cartItems: validation.cartItems,
      commerce: {
        orderingPolicy: commerce.orderingPolicy,
        paymentMethods: commerce.paymentMethods,
        deliveryFeeTiers: commerce.deliveryFeeTiers,
        serviceType,
        deliveryDistanceKm,
        deliveryFeeAmount,
      },
    };
  }

  async validateActiveCart(customerAccountId: string) {
    const cart = await this.findCartByCustomer(customerAccountId);
    if (!cart) {
      return {
        validation: this.buildEmptyCartValidationResult(),
      };
    }

    return {
      validation: await this.buildValidationResult(cart),
    };
  }

  async createFromActiveCart(
    customerAccountId: string,
    dto: CreateCustomerOrderDto = {},
  ) {
    const createdOrder = await this.databaseService.transaction(async () => {
      await this.expireStalePendingPaymentOrdersForCustomer(customerAccountId);

      const cart = await this.findCartByCustomerForUpdate(customerAccountId);
      if (!cart) {
        throw new BadRequestException('Your active cart is empty.');
      }

      const existingPendingPaymentOrder = await this.findActivePendingPaymentOrder(
        customerAccountId,
        cart.storeId,
      );
      if (existingPendingPaymentOrder) {
        throw new ConflictException({
          message: 'A checkout is already pending payment for this store.',
          existingOrderId: existingPendingPaymentOrder.id,
          pendingPaymentExpiresAt: this.getPendingPaymentExpiryDate(
            existingPendingPaymentOrder.createdAt,
          ).toISOString(),
        });
      }

      const validation = await this.buildValidationResult(cart);
      if (!validation.isValid) {
        throw new ConflictException({
          message: 'Cart revalidation failed.',
          issues: validation.issues,
        });
      }

      const commerce = await this.loadCommerceContext(cart.storeId);

      const cartDistance =
        cart.deliveryDistanceKm === null || cart.deliveryDistanceKm === undefined
          ? null
          : Number(cart.deliveryDistanceKm);

      let serviceTypeId: string | null = cart.serviceTypeId;
      let serviceTypeSnapshot = cart.serviceTypeSnapshot;
      if (dto.serviceTypeId) {
        const stAssignment = await this.storeSettingsStore.findActiveServiceTypeAssignment(
          cart.storeId,
          dto.serviceTypeId,
        );
        if (!stAssignment) {
          throw new BadRequestException(
            'Seçtiğiniz servis tipi bu restoran tarafından desteklenmiyor.',
          );
        }
        serviceTypeId = stAssignment.serviceTypeId;
        serviceTypeSnapshot = stAssignment.code;
      }

      const deliveryDistanceKm =
        dto.deliveryDistanceKm === undefined ? cartDistance : dto.deliveryDistanceKm;

      const subtotalAmount = Number(cart.subtotalAmount);
      if (subtotalAmount < commerce.orderingPolicy.minOrderAmount) {
        throw new BadRequestException(
          `Minimum sipariş tutarı ${commerce.orderingPolicy.minOrderAmount} ${commerce.orderingPolicy.currencyCode}.`,
        );
      }

      if (commerce.paymentMethods.length === 0) {
        throw new ConflictException(
          'Bu restoran şu anda hiçbir ödeme yöntemini desteklemiyor.',
        );
      }

      let resolvedPaymentMethodId: string | null = null;
      let resolvedPaymentMethodSnapshot: string | null = null;
      if (dto.paymentMethodId) {
        const supported = commerce.paymentMethods.find(
          (entry) => entry.paymentMethodId === dto.paymentMethodId,
        );
        if (!supported) {
          throw new BadRequestException(
            'Seçtiğiniz ödeme yöntemi bu restoran tarafından desteklenmiyor.',
          );
        }
        resolvedPaymentMethodId = supported.paymentMethodId;
        resolvedPaymentMethodSnapshot = supported.code;
      } else if (cart.paymentMethodId) {
        const supported = commerce.paymentMethods.find(
          (entry) => entry.paymentMethodId === cart.paymentMethodId,
        );
        if (supported) {
          resolvedPaymentMethodId = supported.paymentMethodId;
          resolvedPaymentMethodSnapshot = supported.code;
        }
      }
      if (!resolvedPaymentMethodId) {
        resolvedPaymentMethodId = commerce.paymentMethods[0].paymentMethodId;
        resolvedPaymentMethodSnapshot = commerce.paymentMethods[0].code;
      }

      const deliveryFeeAmount =
        serviceTypeSnapshot === 'delivery'
          ? this.resolveDeliveryFee(commerce.deliveryFeeTiers, deliveryDistanceKm)
          : 0;

      // Snapshot: sipariş anındaki müşteri telefonu ve teslimat adresi.
      // DTO'da gelmezse CustomerAccount.phoneNumber fallback olarak yazılır;
      // adres için fallback yok (snapshot olmazsa NULL kalır — UI kart gizler).
      const customerProfile = (await this.databaseService
        .prepare(
          `SELECT "phoneNumber" FROM "CustomerAccount" WHERE "id" = $id LIMIT 1`,
        )
        .get({ $id: customerAccountId })) as { phoneNumber: string | null } | undefined;
      const customerPhoneSnapshot =
        dto.customerPhone ?? customerProfile?.phoneNumber ?? null;
      const deliveryAddressSnapshotJson = dto.deliveryAddress
        ? JSON.stringify(dto.deliveryAddress)
        : null;
      const courierNotes = dto.courierNotes ?? null;

      const now = new Date();
      const order: Order = {
        id: randomUUID(),
        customerAccountId,
        storeId: cart.storeId,
        status: OrderStatus.PENDING_PAYMENT,
        rejectedReason: null,
        statusNote: null,
        lastStatusChangedAt: now,
        lastStatusChangedByType: 'customer',
        subtotalAmount: cart.subtotalAmount,
        totalAmount: cart.totalAmount,
        currencyId: cart.currencyId,
        currencySnapshot: cart.currencySnapshot,
        serviceTypeId,
        serviceTypeSnapshot,
        paymentMethodId: resolvedPaymentMethodId,
        paymentMethodSnapshot: resolvedPaymentMethodSnapshot,
        deliveryFeeAmount,
        deliveryDistanceKm,
        createdAt: now,
        updatedAt: now,
      };
      const totals = this.calculateOrderTotals(validation.cartItems);

      if (totals.currency !== cart.currencySnapshot) {
        throw new ConflictException('Cart currency is inconsistent and cannot be ordered.');
      }

      const finalTotalAmount = this.roundPrice(totals.subtotalAmount + deliveryFeeAmount);

      await this.databaseService
        .prepare(
          `INSERT INTO "Order" (
            "id", "customerAccountId", "storeId", "status",
            "rejectedReason", "statusNote", "lastStatusChangedAt", "lastStatusChangedByType",
            "subtotalAmount", "totalAmount", "currencyId", "currencySnapshot",
            "serviceTypeId", "serviceTypeSnapshot",
            "paymentMethodId", "paymentMethodSnapshot",
            "deliveryFeeAmount", "deliveryDistanceKm",
            "deliveryAddressSnapshotJson", "customerPhoneSnapshot", "courierNotes",
            "createdAt", "updatedAt"
          ) VALUES (
            $id, $customerAccountId, $storeId, $status,
            $rejectedReason, $statusNote, $lastStatusChangedAt, $lastStatusChangedByType,
            $subtotalAmount, $totalAmount, $currencyId, $currencySnapshot,
            $serviceTypeId, $serviceTypeSnapshot,
            $paymentMethodId, $paymentMethodSnapshot,
            $deliveryFeeAmount, $deliveryDistanceKm,
            $deliveryAddressSnapshotJson, $customerPhoneSnapshot, $courierNotes,
            $createdAt, $updatedAt
          )`,
        )
        .run({
          $id: order.id,
          $customerAccountId: order.customerAccountId,
          $storeId: order.storeId,
          $status: order.status,
          $rejectedReason: order.rejectedReason,
          $statusNote: order.statusNote,
          $lastStatusChangedAt: order.lastStatusChangedAt?.toISOString() ?? null,
          $lastStatusChangedByType: order.lastStatusChangedByType,
          $subtotalAmount: totals.subtotalAmount,
          $totalAmount: finalTotalAmount,
          $currencyId: cart.currencyId,
          $currencySnapshot: totals.currency,
          $serviceTypeId: serviceTypeId,
          $serviceTypeSnapshot: serviceTypeSnapshot,
          $paymentMethodId: resolvedPaymentMethodId,
          $paymentMethodSnapshot: resolvedPaymentMethodSnapshot,
          $deliveryFeeAmount: deliveryFeeAmount,
          $deliveryDistanceKm: deliveryDistanceKm,
          $deliveryAddressSnapshotJson: deliveryAddressSnapshotJson,
          $customerPhoneSnapshot: customerPhoneSnapshot,
          $courierNotes: courierNotes,
          $createdAt: order.createdAt.toISOString(),
          $updatedAt: order.updatedAt.toISOString(),
        });

      for (const cartItem of validation.cartItems) {
        const orderItemId = randomUUID();
        await this.databaseService
          .prepare(
            `INSERT INTO "OrderItem" (
              "id", "orderId", "menuItemId", "itemNameSnapshot", "unitBasePriceSnapshot",
              "currencySnapshot", "quantity", "lineBaseTotal", "lineOptionsTotal",
              "lineTotal", "selectionSignature", "createdAt", "updatedAt"
            ) VALUES (
              $id, $orderId, $menuItemId, $itemNameSnapshot, $unitBasePriceSnapshot,
              $currencySnapshot, $quantity, $lineBaseTotal, $lineOptionsTotal,
              $lineTotal, $selectionSignature, $createdAt, $updatedAt
            )`,
          )
          .run({
            $id: orderItemId,
            $orderId: order.id,
            $menuItemId: cartItem.menuItemId,
            $itemNameSnapshot: cartItem.itemNameSnapshot,
            $unitBasePriceSnapshot: cartItem.unitBasePriceSnapshot,
            $currencySnapshot: cartItem.currencySnapshot,
            $quantity: cartItem.quantity,
            $lineBaseTotal: cartItem.lineBaseTotal,
            $lineOptionsTotal: cartItem.lineOptionsTotal,
            $lineTotal: cartItem.lineTotal,
            $selectionSignature: cartItem.selectionSignature,
            $createdAt: now.toISOString(),
            $updatedAt: now.toISOString(),
          });

        for (const selection of cartItem.selectedOptions) {
          await this.databaseService
            .prepare(
              `INSERT INTO "OrderItemOptionSelection" (
                "id", "orderItemId", "optionGroupId", "optionItemId",
                "optionGroupNameSnapshot", "optionItemNameSnapshot",
                "optionPriceDeltaSnapshot", "createdAt", "updatedAt"
              ) VALUES (
                $id, $orderItemId, $optionGroupId, $optionItemId,
                $optionGroupNameSnapshot, $optionItemNameSnapshot,
                $optionPriceDeltaSnapshot, $createdAt, $updatedAt
              )`,
            )
            .run({
              $id: randomUUID(),
              $orderItemId: orderItemId,
              $optionGroupId: selection.optionGroupId,
              $optionItemId: selection.optionItemId,
              $optionGroupNameSnapshot: selection.optionGroupNameSnapshot,
              $optionItemNameSnapshot: selection.optionItemNameSnapshot,
              $optionPriceDeltaSnapshot: selection.optionPriceDeltaSnapshot,
              $createdAt: now.toISOString(),
              $updatedAt: now.toISOString(),
            });
        }
      }

      await this.createOrderStatusEvent({
        orderId: order.id,
        fromStatus: null,
        toStatus: OrderStatus.PENDING_PAYMENT,
        actorType: 'customer',
        actorId: customerAccountId,
        note: 'Checkout created from active cart and is awaiting payment completion.',
      });

      await this.deleteCart(cart.id);
      return order;
    });

    return this.getOrder(customerAccountId, createdOrder.id);
  }

  /**
   * Faz D — tenant operational test tooling. Sahip olunan store'a, lazy
   * yaratılan tenant'a-özel test customer üzerinden gerçek Order yazar.
   * Cart akışı es geçilir; siparişe doğrudan PENDING_CONFIRMATION statüsü
   * verilir ki realtime stream + dashboard + audio pulse zinciri gerçek
   * lifecycle üzerinden tetiklensin. Stripe çağrılmaz.
   */
  async createTestOrderForTenant(
    tenantId: string,
    dto: {
      storeId: string;
      menuItemIds: string[];
      serviceType?: 'pickup' | 'delivery';
      note?: string;
    },
  ) {
    const ownedStore = await this.storesService.findOwnedStore(dto.storeId, tenantId);
    if (!ownedStore) {
      throw new NotFoundException('Store not found for this tenant.');
    }

    const rows = (await this.databaseService
      .prepare(
        `SELECT mi."id" AS "id",
                mi."storeId" AS "storeId",
                mi."name" AS "name",
                mi."basePrice" AS "basePrice",
                mi."currencyId" AS "currencyId",
                mi."isActive" AS "isActive",
                c."code" AS "currencyCode"
         FROM "MenuItem" mi
         JOIN "Currency" c ON c."id" = mi."currencyId"
         WHERE mi."storeId" = $storeId
           AND mi."id" = ANY($ids::uuid[])`,
      )
      .all({
        $storeId: dto.storeId,
        $ids: dto.menuItemIds,
      })) as unknown as Array<{
      id: string;
      storeId: string;
      name: string;
      basePrice: number | string;
      currencyId: string;
      isActive: boolean | number;
      currencyCode: string;
    }>;

    if (rows.length === 0) {
      throw new BadRequestException('Hiçbir menü ürünü bu restorana ait değil.');
    }
    if (rows.length !== dto.menuItemIds.length) {
      throw new BadRequestException(
        'Seçilen menü ürünlerinin bazıları bu restorana ait değil veya bulunamadı.',
      );
    }
    if (rows.some((row) => !Boolean(row.isActive))) {
      throw new BadRequestException(
        'Seçilen menü ürünlerinin en az biri pasif — test siparişi oluşturulamaz.',
      );
    }

    const currencyCodes = new Set(rows.map((row) => row.currencyCode));
    if (currencyCodes.size > 1) {
      throw new ConflictException('Seçilen ürünler aynı para birimine sahip olmalı.');
    }
    const currencyCode = rows[0].currencyCode;
    const currencyId = rows[0].currencyId;

    const testCustomerId = await this.ensureTenantTestCustomer(tenantId);

    const serviceTypeSnapshot: 'pickup' | 'delivery' = dto.serviceType ?? 'pickup';
    const items = rows.map((row) => {
      const unitPrice = this.roundPrice(Number(row.basePrice));
      return {
        menuItemId: row.id,
        itemNameSnapshot: row.name,
        unitBasePriceSnapshot: unitPrice,
        currencySnapshot: row.currencyCode,
        quantity: 1,
        lineBaseTotal: unitPrice,
        lineOptionsTotal: 0,
        lineTotal: unitPrice,
      };
    });
    const subtotal = this.roundPrice(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const deliveryFeeAmount = 0;
    const totalAmount = this.roundPrice(subtotal + deliveryFeeAmount);

    const now = new Date();
    const orderId = randomUUID();
    const note = dto.note?.trim() || 'Tenant tarafından oluşturulan test siparişi.';

    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `INSERT INTO "Order" (
            "id", "customerAccountId", "storeId", "status",
            "rejectedReason", "statusNote", "lastStatusChangedAt", "lastStatusChangedByType",
            "subtotalAmount", "totalAmount", "currencyId", "currencySnapshot",
            "serviceTypeId", "serviceTypeSnapshot",
            "paymentMethodId", "paymentMethodSnapshot",
            "deliveryFeeAmount", "deliveryDistanceKm",
            "deliveryAddressSnapshotJson", "customerPhoneSnapshot", "courierNotes",
            "createdAt", "updatedAt"
          ) VALUES (
            $id, $customerAccountId, $storeId, $status,
            $rejectedReason, $statusNote, $lastStatusChangedAt, $lastStatusChangedByType,
            $subtotalAmount, $totalAmount, $currencyId, $currencySnapshot,
            $serviceTypeId, $serviceTypeSnapshot,
            $paymentMethodId, $paymentMethodSnapshot,
            $deliveryFeeAmount, $deliveryDistanceKm,
            $deliveryAddressSnapshotJson, $customerPhoneSnapshot, $courierNotes,
            $createdAt, $updatedAt
          )`,
        )
        .run({
          $id: orderId,
          $customerAccountId: testCustomerId,
          $storeId: dto.storeId,
          $status: OrderStatus.PENDING_CONFIRMATION,
          $rejectedReason: null,
          $statusNote: note,
          $lastStatusChangedAt: now.toISOString(),
          $lastStatusChangedByType: 'tenant',
          $subtotalAmount: subtotal,
          $totalAmount: totalAmount,
          $currencyId: currencyId,
          $currencySnapshot: currencyCode,
          $serviceTypeId: null,
          $serviceTypeSnapshot: serviceTypeSnapshot,
          $paymentMethodId: null,
          $paymentMethodSnapshot: 'cash_on_delivery',
          $deliveryFeeAmount: deliveryFeeAmount,
          $deliveryDistanceKm: null,
          $deliveryAddressSnapshotJson: null,
          $customerPhoneSnapshot: null,
          $courierNotes: null,
          $createdAt: now.toISOString(),
          $updatedAt: now.toISOString(),
        });

      for (const item of items) {
        await this.databaseService
          .prepare(
            `INSERT INTO "OrderItem" (
              "id", "orderId", "menuItemId", "itemNameSnapshot", "unitBasePriceSnapshot",
              "currencySnapshot", "quantity", "lineBaseTotal", "lineOptionsTotal",
              "lineTotal", "selectionSignature", "createdAt", "updatedAt"
            ) VALUES (
              $id, $orderId, $menuItemId, $itemNameSnapshot, $unitBasePriceSnapshot,
              $currencySnapshot, $quantity, $lineBaseTotal, $lineOptionsTotal,
              $lineTotal, $selectionSignature, $createdAt, $updatedAt
            )`,
          )
          .run({
            $id: randomUUID(),
            $orderId: orderId,
            $menuItemId: item.menuItemId,
            $itemNameSnapshot: item.itemNameSnapshot,
            $unitBasePriceSnapshot: item.unitBasePriceSnapshot,
            $currencySnapshot: item.currencySnapshot,
            $quantity: item.quantity,
            $lineBaseTotal: item.lineBaseTotal,
            $lineOptionsTotal: item.lineOptionsTotal,
            $lineTotal: item.lineTotal,
            $selectionSignature: '',
            $createdAt: now.toISOString(),
            $updatedAt: now.toISOString(),
          });
      }

      await this.createOrderStatusEvent({
        orderId,
        fromStatus: null,
        toStatus: OrderStatus.PENDING_CONFIRMATION,
        actorType: 'tenant',
        actorId: tenantId,
        note,
      });
    });

    return {
      orderId,
      storeId: dto.storeId,
      status: OrderStatus.PENDING_CONFIRMATION,
      totalAmount,
      currency: currencyCode,
      itemCount: items.length,
      createdAt: now.toISOString(),
    };
  }

  /**
   * Tenant-bazlı, lazy yaratılan operasyonel test customer'ı. Aynı tenant
   * tekrar test siparişi oluşturduğunda mevcut hesap yeniden kullanılır.
   * isActive=false + isVerified=false: müşteri akışlarına sızmaz.
   */
  private async ensureTenantTestCustomer(tenantId: string): Promise<string> {
    const email = `tenant-test-${tenantId}@lieferzonen.internal`;
    const existing = (await this.databaseService
      .prepare(`SELECT "id" FROM "CustomerAccount" WHERE "email" = $email LIMIT 1`)
      .get({ $email: email })) as { id: string } | undefined;
    if (existing) return existing.id;

    const id = randomUUID();
    const nowIso = new Date().toISOString();
    await this.databaseService
      .prepare(
        `INSERT INTO "CustomerAccount" (
          "id", "email", "firstName", "lastName", "passwordHash", "loginPreference",
          "phoneNumber", "birthDate", "isActive", "isVerified", "lastLoginAt",
          "createdAt", "updatedAt"
        ) VALUES (
          $id, $email, $firstName, $lastName, $passwordHash, $loginPreference,
          $phoneNumber, $birthDate, $isActive, $isVerified, $lastLoginAt,
          $createdAt, $updatedAt
        )`,
      )
      .run({
        $id: id,
        $email: email,
        $firstName: 'Test',
        $lastName: 'Customer',
        $passwordHash: null,
        $loginPreference: false,
        $phoneNumber: null,
        $birthDate: null,
        $isActive: false,
        $isVerified: false,
        $lastLoginAt: null,
        $createdAt: nowIso,
        $updatedAt: nowIso,
      });
    return id;
  }

  async listForCustomer(customerAccountId: string, query: ListCustomerOrdersDto) {
    await this.expireStalePendingPaymentOrdersForCustomer(customerAccountId);

    if (query.createdFrom && query.createdTo) {
      const createdFrom = new Date(query.createdFrom);
      const createdTo = new Date(query.createdTo);
      if (createdFrom.getTime() > createdTo.getTime()) {
        throw new BadRequestException(
          'createdFrom must be earlier than or equal to createdTo.',
        );
      }
    }

    const clauses = [`o."customerAccountId" = $customerAccountId`];
    const params: Record<string, string> = {
      $customerAccountId: customerAccountId,
    };

    if (query.status) {
      clauses.push(`o."status" = $status`);
      params.$status = query.status;
    } else {
      const scope = query.scope ?? CustomerOrderListScope.ACTIVE;
      if (scope === CustomerOrderListScope.ACTIVE) {
        clauses.push(
          `o."status" IN ($pendingPaymentStatus, $pendingConfirmationStatus, $confirmedStatus, $preparingStatus, $readyStatus)`,
        );
        params.$pendingPaymentStatus = OrderStatus.PENDING_PAYMENT;
        params.$pendingConfirmationStatus = OrderStatus.PENDING_CONFIRMATION;
        params.$confirmedStatus = OrderStatus.CONFIRMED;
        params.$preparingStatus = OrderStatus.PREPARING;
        params.$readyStatus = OrderStatus.READY;
      } else if (scope === CustomerOrderListScope.HISTORY) {
        clauses.push(
          `o."status" IN ($completedStatus, $rejectedStatus, $cancelledStatus, $paymentFailedStatus)`,
        );
        params.$completedStatus = OrderStatus.COMPLETED;
        params.$rejectedStatus = OrderStatus.REJECTED;
        params.$cancelledStatus = OrderStatus.CANCELLED;
        params.$paymentFailedStatus = OrderStatus.PAYMENT_FAILED;
      }
    }

    if (query.createdFrom) {
      clauses.push(`o."createdAt" >= $createdFrom`);
      params.$createdFrom = new Date(query.createdFrom).toISOString();
    }

    if (query.createdTo) {
      clauses.push(`o."createdAt" <= $createdTo`);
      params.$createdTo = new Date(query.createdTo).toISOString();
    }

    const rows = (await this.databaseService
      .prepare(
        `SELECT o.*,
                r."name" AS "storeName",
                COUNT(oi."id") AS "itemCount"
         FROM "Order" o
         INNER JOIN "Store" r ON r."id" = o."storeId"
         LEFT JOIN "OrderItem" oi ON oi."orderId" = o."id"
         WHERE ${clauses.join(' AND ')}
         GROUP BY o."id", r."name"
         ORDER BY
           CASE
             WHEN o."status" IN ($activePendingPaymentStatus, $activePendingConfirmationStatus, $activeConfirmedStatus, $activePreparingStatus, $activeReadyStatus) THEN 0
             ELSE 1
           END ASC,
           COALESCE(o."lastStatusChangedAt", o."createdAt") DESC,
           o."createdAt" DESC`,
      )
      .all({
        ...params,
        $activePendingPaymentStatus: OrderStatus.PENDING_PAYMENT,
        $activePendingConfirmationStatus: OrderStatus.PENDING_CONFIRMATION,
        $activeConfirmedStatus: OrderStatus.CONFIRMED,
        $activePreparingStatus: OrderStatus.PREPARING,
        $activeReadyStatus: OrderStatus.READY,
      })) as unknown as CustomerOrderListRow[];

    return {
      orders: rows.map((row) => {
        const order = this.mapOrder(row);
        return {
          ...order,
          storeName: row.storeName,
          itemCount: Number(row.itemCount ?? 0),
          isActive: this.isCustomerActiveStatus(order.status),
          canCustomerCancel: this.canCustomerCancel(order),
        };
      }),
    };
  }

  async getOrder(customerAccountId: string, orderId: string) {
    await this.expirePendingPaymentOrderById(orderId);

    const order = await this.findCustomerOrderRow(customerAccountId, orderId);
    if (!order) {
      throw new NotFoundException('Order could not be found for this customer.');
    }

    return this.buildCustomerOrderDetail(order);
  }

  async cancelOrder(
    customerAccountId: string,
    orderId: string,
    dto: CancelCustomerOrderDto,
  ) {
    await this.expirePendingPaymentOrderById(orderId);

    const order = await this.findOrderForCustomerMutation(customerAccountId, orderId);
    if (!order) {
      throw new NotFoundException('Order could not be found for this customer.');
    }

    if (!this.canCustomerCancel(order)) {
      throw new ConflictException(
        `Order cannot be cancelled when status is ${order.status}.`,
      );
    }

    const note = dto.note?.trim() || 'Customer cancelled the order before payment completion.';
    const now = new Date();

    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `UPDATE "Order"
           SET "status" = $status,
               "statusNote" = $statusNote,
               "lastStatusChangedAt" = $lastStatusChangedAt,
               "lastStatusChangedByType" = $lastStatusChangedByType,
               "updatedAt" = $updatedAt
           WHERE "id" = $id`,
        )
        .run({
          $id: orderId,
          $status: OrderStatus.CANCELLED,
          $statusNote: note,
          $lastStatusChangedAt: now.toISOString(),
          $lastStatusChangedByType: 'customer',
          $updatedAt: now.toISOString(),
        });

      await this.createOrderStatusEvent({
        orderId,
        fromStatus: order.status,
        toStatus: OrderStatus.CANCELLED,
        actorType: 'customer',
        actorId: customerAccountId,
        note,
      });
    });

    return this.getOrder(customerAccountId, orderId);
  }

  async listForTenant(ownerTenantId: string, query: ListTenantOrdersDto) {
    await this.expireStalePendingPaymentOrdersForTenant(ownerTenantId);

    if (query.createdFrom && query.createdTo) {
      const createdFrom = new Date(query.createdFrom);
      const createdTo = new Date(query.createdTo);
      if (createdFrom.getTime() > createdTo.getTime()) {
        throw new BadRequestException(
          'createdFrom must be earlier than or equal to createdTo.',
        );
      }
    }

    if (query.storeId) {
      const ownedStore = await this.storesService.findOwnedStore(
        query.storeId,
        ownerTenantId,
      );
      if (!ownedStore) {
        throw new ForbiddenException('You can only access orders for your own stores.');
      }
    }

    const clauses = [`r."ownerTenantId" = $ownerTenantId`];
    const params: Record<string, string> = {
      $ownerTenantId: ownerTenantId,
    };

    if (query.status) {
      clauses.push(`o."status" = $status`);
      params.$status = query.status;
    } else if (query.scope === TenantOrderListScope.HISTORY) {
      clauses.push(
        `o."status" IN ($completedStatus, $rejectedStatus, $cancelledStatus, $paymentFailedStatus, $pendingPaymentStatus)`,
      );
      params.$completedStatus = OrderStatus.COMPLETED;
      params.$rejectedStatus = OrderStatus.REJECTED;
      params.$cancelledStatus = OrderStatus.CANCELLED;
      params.$paymentFailedStatus = OrderStatus.PAYMENT_FAILED;
      params.$pendingPaymentStatus = OrderStatus.PENDING_PAYMENT;
    } else {
      clauses.push(
        `o."status" IN ($pendingConfirmationStatus, $confirmedStatus, $preparingStatus, $readyStatus)`,
      );
      params.$pendingConfirmationStatus = OrderStatus.PENDING_CONFIRMATION;
      params.$confirmedStatus = OrderStatus.CONFIRMED;
      params.$preparingStatus = OrderStatus.PREPARING;
      params.$readyStatus = OrderStatus.READY;
    }

    if (query.storeId) {
      clauses.push(`o."storeId" = $storeId`);
      params.$storeId = query.storeId;
    }

    if (query.createdFrom) {
      clauses.push(`o."createdAt" >= $createdFrom`);
      params.$createdFrom = new Date(query.createdFrom).toISOString();
    }

    if (query.createdTo) {
      clauses.push(`o."createdAt" <= $createdTo`);
      params.$createdTo = new Date(query.createdTo).toISOString();
    }

    const rows = (await this.databaseService
      .prepare(
        `SELECT o.*, r."name" AS "storeName",
                c."firstName" AS "customerFirstName",
                c."lastName" AS "customerLastName",
                c."email" AS "customerEmail",
                COUNT(oi."id") AS "itemCount"
         FROM "Order" o
         INNER JOIN "Store" r ON r."id" = o."storeId"
         INNER JOIN "CustomerAccount" c ON c."id" = o."customerAccountId"
         LEFT JOIN "OrderItem" oi ON oi."orderId" = o."id"
         WHERE ${clauses.join(' AND ')}
         GROUP BY o."id", r."name", c."firstName", c."lastName", c."email"
         ORDER BY
           CASE
             WHEN o."status" = $pendingConfirmationPriority THEN 0
             WHEN o."status" = $confirmedPriority THEN 1
             WHEN o."status" = $preparingPriority THEN 2
             WHEN o."status" = $readyPriority THEN 3
             WHEN o."status" = $completedPriority THEN 4
             WHEN o."status" = $rejectedPriority THEN 5
             WHEN o."status" = $cancelledPriority THEN 6
             WHEN o."status" = $paymentFailedPriority THEN 7
             WHEN o."status" = $pendingPaymentPriority THEN 8
             ELSE 99
           END ASC,
           COALESCE(o."lastStatusChangedAt", o."createdAt") ASC,
           o."createdAt" ASC`,
      )
      .all({
        ...params,
        $pendingConfirmationPriority: OrderStatus.PENDING_CONFIRMATION,
        $confirmedPriority: OrderStatus.CONFIRMED,
        $preparingPriority: OrderStatus.PREPARING,
        $readyPriority: OrderStatus.READY,
        $completedPriority: OrderStatus.COMPLETED,
        $rejectedPriority: OrderStatus.REJECTED,
        $cancelledPriority: OrderStatus.CANCELLED,
        $paymentFailedPriority: OrderStatus.PAYMENT_FAILED,
        $pendingPaymentPriority: OrderStatus.PENDING_PAYMENT,
      })) as unknown as TenantOrderListRow[];

    return rows.map((row) => ({
      ...this.mapOrder(row),
      storeName: row.storeName,
      customerSummary: this.mapCustomerSummary(row),
      itemCount: Number(row.itemCount ?? 0),
      isActionable: this.tenantDefaultOperationalStatuses.includes(row.status as OrderStatus),
    }));
  }

  /**
   * Read-only platform-wide order list for admin operational oversight.
   * Unlike listForTenant there is no ownership filter — admins see every
   * order across every store. Defaults to all statuses, newest first.
   */
  async listForAdmin(query: ListAdminOrdersDto) {
    if (query.createdFrom && query.createdTo) {
      const createdFrom = new Date(query.createdFrom);
      const createdTo = new Date(query.createdTo);
      if (createdFrom.getTime() > createdTo.getTime()) {
        throw new BadRequestException(
          'createdFrom must be earlier than or equal to createdTo.',
        );
      }
    }

    const clauses: string[] = ['1 = 1'];
    const params: Record<string, string> = {};

    if (query.status) {
      clauses.push(`o."status" = $status`);
      params.$status = query.status;
    }
    if (query.storeId) {
      clauses.push(`o."storeId" = $storeId`);
      params.$storeId = query.storeId;
    }
    if (query.createdFrom) {
      clauses.push(`o."createdAt" >= $createdFrom`);
      params.$createdFrom = new Date(query.createdFrom).toISOString();
    }
    if (query.createdTo) {
      clauses.push(`o."createdAt" <= $createdTo`);
      params.$createdTo = new Date(query.createdTo).toISOString();
    }

    const rows = (await this.databaseService
      .prepare(
        `SELECT o.*, r."name" AS "storeName",
                c."firstName" AS "customerFirstName",
                c."lastName" AS "customerLastName",
                c."email" AS "customerEmail",
                COUNT(oi."id") AS "itemCount"
         FROM "Order" o
         INNER JOIN "Store" r ON r."id" = o."storeId"
         INNER JOIN "CustomerAccount" c ON c."id" = o."customerAccountId"
         LEFT JOIN "OrderItem" oi ON oi."orderId" = o."id"
         WHERE ${clauses.join(' AND ')}
         GROUP BY o."id", r."name", c."firstName", c."lastName", c."email"
         ORDER BY o."createdAt" DESC`,
      )
      .all(params)) as unknown as TenantOrderListRow[];

    return rows.map((row) => ({
      ...this.mapOrder(row),
      storeName: row.storeName,
      customerSummary: this.mapCustomerSummary(row),
      itemCount: Number(row.itemCount ?? 0),
      isActionable: this.tenantDefaultOperationalStatuses.includes(
        row.status as OrderStatus,
      ),
    }));
  }

  async getOrderForTenant(ownerTenantId: string, orderId: string) {
    await this.expirePendingPaymentOrderById(orderId);

    const order = await this.findTenantOrderRow(ownerTenantId, orderId);
    if (!order) {
      throw new NotFoundException('Order could not be found for this tenant.');
    }

    return this.buildTenantOrderDetail(order);
  }

  async updateStatusForTenant(
    ownerTenantId: string,
    orderId: string,
    dto: UpdateTenantOrderStatusDto,
  ) {
    await this.expirePendingPaymentOrderById(orderId);

    const order = await this.findOrderForOwnedStore(ownerTenantId, orderId);
    if (!order) {
      const existingOrder = await this.findOrderById(orderId);
      if (existingOrder) {
        throw new ForbiddenException(
          'You can only manage orders for your own stores.',
        );
      }

      throw new NotFoundException('Order could not be found for this tenant.');
    }

    if (order.status === dto.status) {
      throw new ConflictException(`Order is already ${dto.status}.`);
    }

    const allowedTransitions = this.tenantTransitionMap[order.status] ?? [];
    if (!allowedTransitions.includes(dto.status)) {
      throw new ConflictException(
        `Order status cannot transition from ${order.status} to ${dto.status}.`,
      );
    }

    const now = new Date();
    const trimmedReason = dto.reason?.trim() || null;

    if (
      [OrderStatus.REJECTED, OrderStatus.CANCELLED].includes(dto.status) &&
      !trimmedReason
    ) {
      throw new BadRequestException(
        `A reason is required when moving an order to ${dto.status}.`,
      );
    }

    const rejectedReason = dto.status === OrderStatus.REJECTED ? trimmedReason : null;
    const statusNote =
      dto.status === OrderStatus.REJECTED ? null : trimmedReason;

    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `UPDATE "Order"
           SET "status" = $status,
               "rejectedReason" = $rejectedReason,
               "statusNote" = $statusNote,
               "lastStatusChangedAt" = $lastStatusChangedAt,
               "lastStatusChangedByType" = $lastStatusChangedByType,
               "updatedAt" = $updatedAt
           WHERE "id" = $id`,
        )
        .run({
          $id: orderId,
          $status: dto.status,
          $rejectedReason: rejectedReason,
          $statusNote: statusNote,
          $lastStatusChangedAt: now.toISOString(),
          $lastStatusChangedByType: 'tenant',
          $updatedAt: now.toISOString(),
        });

      await this.createOrderStatusEvent({
          orderId,
          fromStatus: order.status,
          toStatus: dto.status,
          actorType: 'tenant',
          actorId: ownerTenantId,
          note: trimmedReason,
        });

        if (dto.status === OrderStatus.COMPLETED) {
          await this.customerLoyaltyStore.recordCompletedOrderReward({
            customerAccountId: order.customerAccountId,
            storeId: order.storeId,
            orderId,
            totalAmount: order.totalAmount,
            currency: order.currencySnapshot,
          });
        }
      });

    return this.getOrderForTenant(ownerTenantId, orderId);
  }

  /**
   * Load a customer-owned order for payment-session creation. Throws if the
   * order does not exist or is not owned by the customer.
   */
  async getOrderForPaymentSession(
    customerAccountId: string,
    orderId: string,
  ): Promise<{ order: Order; storeName: string }> {
    const row = await this.findCustomerOrderRow(customerAccountId, orderId);
    if (!row) {
      throw new NotFoundException('Order could not be found for this customer.');
    }
    return { order: this.mapOrder(row), storeName: row.storeName ?? 'Lieferzonen' };
  }

  /**
   * Apply an authoritative payment outcome (reported by a Stripe webhook) to
   * an order. System-driven: no customer/tenant action involved.
   *
   * Idempotent and stale-event safe — transitions only ever move the order
   * forward through the payment stage. An order already past PENDING_PAYMENT /
   * PAYMENT_PROCESSING is never dragged back by a late or duplicate event.
   */
  async applyPaymentOutcome(
    orderId: string,
    outcome: PaymentOutcome,
    note: string,
  ): Promise<{ changed: boolean; status: OrderStatus | null }> {
    const existing = await this.findOrderById(orderId);
    if (!existing) {
      // Webhook references an order this API does not have — nothing to do.
      return { changed: false, status: null };
    }

    const order = this.mapOrder(existing);
    const current = order.status;
    const payable: OrderStatus[] = [
      OrderStatus.PENDING_PAYMENT,
      OrderStatus.PAYMENT_PROCESSING,
    ];

    let target: OrderStatus | null = null;
    if (outcome === 'processing') {
      if (current === OrderStatus.PENDING_PAYMENT) {
        target = OrderStatus.PAYMENT_PROCESSING;
      }
    } else if (outcome === 'succeeded') {
      // Recover even from PAYMENT_FAILED — covers a payment that completed
      // right as the pending-payment window expired.
      if (payable.includes(current) || current === OrderStatus.PAYMENT_FAILED) {
        target = OrderStatus.PENDING_CONFIRMATION;
      }
    } else if (outcome === 'failed' || outcome === 'expired') {
      if (payable.includes(current)) {
        target = OrderStatus.PAYMENT_FAILED;
      }
    }

    if (target === null || target === current) {
      // Idempotent / stale: order already at or beyond this outcome.
      return { changed: false, status: current };
    }

    if (target === OrderStatus.PENDING_CONFIRMATION) {
      // Architecture Law J-12: legal acceptance must exist before an order can
      // leave the payment stage. Checkout records it before payment starts,
      // so this is a defensive guard against a misordered flow.
      await this.legalConsentService.ensureAcceptanceForConfirmation(orderId);
    }

    const now = new Date();
    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `UPDATE "Order"
           SET "status" = $status,
               "statusNote" = $statusNote,
               "lastStatusChangedAt" = $lastStatusChangedAt,
               "lastStatusChangedByType" = $lastStatusChangedByType,
               "updatedAt" = $updatedAt
           WHERE "id" = $id`,
        )
        .run({
          $id: orderId,
          $status: target,
          $statusNote: note,
          $lastStatusChangedAt: now.toISOString(),
          $lastStatusChangedByType: 'system',
          $updatedAt: now.toISOString(),
        });

      await this.createOrderStatusEvent({
        orderId,
        fromStatus: current,
        toStatus: target,
        actorType: 'system',
        actorId: SYSTEM_ACTOR_ID,
        note,
      });
    });

    return { changed: true, status: target };
  }

  private getPendingPaymentExpiryDate(createdAt: Date) {
    return new Date(createdAt.getTime() + this.pendingPaymentTtlMs);
  }

  private isPendingPaymentExpired(order: Pick<Order, 'status' | 'createdAt'>) {
    return (
      order.status === OrderStatus.PENDING_PAYMENT &&
      this.getPendingPaymentExpiryDate(order.createdAt).getTime() <= Date.now()
    );
  }

  private async expireStalePendingPaymentOrdersForCustomer(customerAccountId: string) {
    const rows = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "Order"
         WHERE "customerAccountId" = $customerAccountId
           AND "status" = $status`,
      )
      .all({
        $customerAccountId: customerAccountId,
        $status: OrderStatus.PENDING_PAYMENT,
      })) as unknown as OrderRow[];

    for (const row of rows) {
      const order = this.mapOrder(row);
      if (this.isPendingPaymentExpired(order)) {
        await this.markPendingPaymentOrderAsFailed(
          order.id,
          'Checkout expired before payment completion.',
        );
      }
    }
  }

  private async expireStalePendingPaymentOrdersForTenant(ownerTenantId: string) {
    const rows = (await this.databaseService
      .prepare(
        `SELECT o.*
         FROM "Order" o
         INNER JOIN "Store" r ON r."id" = o."storeId"
         WHERE r."ownerTenantId" = $ownerTenantId
           AND o."status" = $status`,
      )
      .all({
        $ownerTenantId: ownerTenantId,
        $status: OrderStatus.PENDING_PAYMENT,
      })) as unknown as OrderRow[];

    for (const row of rows) {
      const order = this.mapOrder(row);
      if (this.isPendingPaymentExpired(order)) {
        await this.markPendingPaymentOrderAsFailed(
          order.id,
          'Checkout expired before payment completion.',
        );
      }
    }
  }

  private async expirePendingPaymentOrderById(orderId: string) {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "Order" WHERE "id" = $id LIMIT 1`)
      .get({ $id: orderId })) as OrderRow | undefined;

    if (!row) {
      return;
    }

    const order = this.mapOrder(row);
    if (this.isPendingPaymentExpired(order)) {
      await this.markPendingPaymentOrderAsFailed(
        order.id,
        'Checkout expired before payment completion.',
      );
    }
  }

  private async findActivePendingPaymentOrder(
    customerAccountId: string,
    storeId: string,
  ) {
    const row = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "Order"
         WHERE "customerAccountId" = $customerAccountId
           AND "storeId" = $storeId
           AND "status" = $status
         ORDER BY "createdAt" DESC
         LIMIT 1`,
      )
      .get({
        $customerAccountId: customerAccountId,
        $storeId: storeId,
        $status: OrderStatus.PENDING_PAYMENT,
      })) as OrderRow | undefined;

    if (!row) {
      return null;
    }

    const order = this.mapOrder(row);
    if (this.isPendingPaymentExpired(order)) {
      await this.markPendingPaymentOrderAsFailed(
        order.id,
        'Checkout expired before payment completion.',
      );
      return null;
    }

    return order;
  }

  private async markPendingPaymentOrderAsFailed(orderId: string, note: string) {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "Order" WHERE "id" = $id LIMIT 1`)
      .get({ $id: orderId })) as OrderRow | undefined;

    if (!row) {
      return;
    }

    const order = this.mapOrder(row);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return;
    }

    const now = new Date();
    await this.databaseService.transaction(async () => {
      await this.databaseService
        .prepare(
          `UPDATE "Order"
           SET "status" = $status,
               "statusNote" = $statusNote,
               "lastStatusChangedAt" = $lastStatusChangedAt,
               "lastStatusChangedByType" = $lastStatusChangedByType,
               "updatedAt" = $updatedAt
           WHERE "id" = $id`,
        )
        .run({
          $id: orderId,
          $status: OrderStatus.PAYMENT_FAILED,
          $statusNote: note,
          $lastStatusChangedAt: now.toISOString(),
          $lastStatusChangedByType: 'system',
          $updatedAt: now.toISOString(),
        });

      await this.createOrderStatusEvent({
        orderId,
        fromStatus: OrderStatus.PENDING_PAYMENT,
        toStatus: OrderStatus.PAYMENT_FAILED,
        actorType: 'system',
        actorId: SYSTEM_ACTOR_ID,
        note,
      });
    });
  }


  private async buildValidationResult(cart: CartRow) {
    const store = await this.storesService.getOrderabilitySnapshot(cart.storeId);
    if (!store) {
      return {
        isValid: false,
        hasBlockingIssues: true,
        canCheckout: false,
        canUpdateCart: true,
        canRetryCheckout: true,
        nextAction: this.validationNextActions.updateCart,
        issues: ['Store could not be found.'],
        blockingIssues: [
          this.createBlockingIssue({
            code: 'STORE_NOT_FOUND',
            message: 'Store could not be found.',
            entityType: 'store',
            entityId: cart.storeId,
            canRetry: true,
          }),
        ],
        cart: this.mapCart(cart),
        cartItems: await this.loadCartItems(cart.id),
      };
    }

    const cartItems = await this.loadCartItems(cart.id);
    if (cartItems.length === 0) {
      throw new BadRequestException('Your active cart is empty.');
    }

    if (store.status !== 'active') {
      return {
        isValid: false,
        hasBlockingIssues: true,
        canCheckout: false,
        canUpdateCart: true,
        canRetryCheckout: true,
        nextAction: this.validationNextActions.updateCart,
        issues: ['Store is not accepting orders right now.'],
        blockingIssues: [
          this.createBlockingIssue({
            code: 'STORE_NOT_ORDERABLE',
            message: 'Store is not accepting orders right now.',
            entityType: 'store',
            entityId: store.id,
            entityName: store.name,
            canRetry: true,
          }),
        ],
        cart: this.mapCart(cart),
        cartItems,
      };
    }

    const issues: string[] = [];
    const blockingIssues: ValidationBlockingIssue[] = [];
    let computedSubtotal = 0;
    let computedCurrency = cart.currencySnapshot;

    for (const cartItem of cartItems) {
      const liveItem = await this.findMenuItemById(cartItem.menuItemId);
      if (!liveItem || liveItem.storeId !== cart.storeId) {
        this.pushBlockingIssue(
          issues,
          blockingIssues,
          this.createBlockingIssue({
            code: 'MENU_ITEM_UNAVAILABLE',
            message: `Menu item "${cartItem.itemNameSnapshot}" is no longer available.`,
            entityType: 'menu_item',
            entityId: cartItem.menuItemId,
            entityName: cartItem.itemNameSnapshot,
            canRetry: true,
          }),
        );
        continue;
      }

      if (!Boolean(liveItem.isActive)) {
        this.pushBlockingIssue(
          issues,
          blockingIssues,
          this.createBlockingIssue({
            code: 'MENU_ITEM_INACTIVE',
            message: `Menu item "${cartItem.itemNameSnapshot}" is inactive.`,
            entityType: 'menu_item',
            entityId: liveItem.id,
            entityName: cartItem.itemNameSnapshot,
            canRetry: true,
          }),
        );
      }

      if (liveItem.categoryId && liveItem.categoryIsActive === false) {
        this.pushBlockingIssue(
          issues,
          blockingIssues,
          this.createBlockingIssue({
            code: 'MENU_CATEGORY_UNAVAILABLE',
            message: `Menu item category for "${cartItem.itemNameSnapshot}" is unavailable.`,
            entityType: 'menu_category',
            entityId: liveItem.categoryId,
            entityName: liveItem.categoryName ?? null,
            canRetry: true,
          }),
        );
      }

      if (
        liveItem.availabilityType !== 'always' &&
        liveItem.availabilityType !== 'inherit_store_status'
      ) {
        this.pushBlockingIssue(
          issues,
          blockingIssues,
          this.createBlockingIssue({
            code: 'MENU_ITEM_NOT_ORDERABLE',
            message: `Menu item "${cartItem.itemNameSnapshot}" is not orderable right now.`,
            entityType: 'menu_item',
            entityId: liveItem.id,
            entityName: cartItem.itemNameSnapshot,
            canRetry: true,
          }),
        );
      }

      if (liveItem.name !== cartItem.itemNameSnapshot) {
        this.pushBlockingIssue(
          issues,
          blockingIssues,
          this.createBlockingIssue({
            code: 'MENU_ITEM_CHANGED',
            message: `Menu item "${cartItem.itemNameSnapshot}" changed since it was added to the cart.`,
            entityType: 'menu_item',
            entityId: liveItem.id,
            entityName: cartItem.itemNameSnapshot,
            canRetry: true,
          }),
        );
      }

      if (this.roundPrice(liveItem.basePrice) !== this.roundPrice(cartItem.unitBasePriceSnapshot)) {
        this.pushBlockingIssue(
          issues,
          blockingIssues,
          this.createBlockingIssue({
            code: 'MENU_ITEM_PRICE_CHANGED',
            message: `Price changed for "${cartItem.itemNameSnapshot}".`,
            entityType: 'menu_item',
            entityId: liveItem.id,
            entityName: cartItem.itemNameSnapshot,
            canRetry: true,
          }),
        );
      }

      if (liveItem.currencyCode !== cartItem.currencySnapshot) {
        this.pushBlockingIssue(
          issues,
          blockingIssues,
          this.createBlockingIssue({
            code: 'MENU_ITEM_CURRENCY_CHANGED',
            message: `Currency changed for "${cartItem.itemNameSnapshot}".`,
            entityType: 'menu_item',
            entityId: liveItem.id,
            entityName: cartItem.itemNameSnapshot,
            canRetry: true,
          }),
        );
      }

      const liveGroups = await this.loadOptionGroupsForMenuItem(liveItem.id);
      const activeGroups = liveGroups.filter((group) => Boolean(group.isActive));
      const activeGroupMap = new Map(activeGroups.map((group) => [group.id, group]));
      const selectionsByGroup = new Map<string, CartSelectionView[]>();

      for (const selection of cartItem.selectedOptions) {
        const groupSelections = selectionsByGroup.get(selection.optionGroupId) ?? [];
        groupSelections.push(selection);
        selectionsByGroup.set(selection.optionGroupId, groupSelections);

        const group = activeGroupMap.get(selection.optionGroupId);
        if (!group) {
          this.pushBlockingIssue(
            issues,
            blockingIssues,
            this.createBlockingIssue({
              code: 'OPTION_GROUP_INVALID',
              message: `Option group selection on "${cartItem.itemNameSnapshot}" is no longer valid.`,
              entityType: 'menu_item',
              entityId: liveItem.id,
              entityName: cartItem.itemNameSnapshot,
              canRetry: true,
            }),
          );
          continue;
        }

        if (group.name !== selection.optionGroupNameSnapshot) {
          this.pushBlockingIssue(
            issues,
            blockingIssues,
            this.createBlockingIssue({
              code: 'OPTION_GROUP_CHANGED',
              message: `Option group changed on "${cartItem.itemNameSnapshot}".`,
              entityType: 'menu_item',
              entityId: liveItem.id,
              entityName: cartItem.itemNameSnapshot,
              canRetry: true,
            }),
          );
        }

        const optionItem = await this.findOptionItem(
          selection.optionGroupId,
          selection.optionItemId,
        );
        if (!optionItem) {
          this.pushBlockingIssue(
            issues,
            blockingIssues,
            this.createBlockingIssue({
              code: 'OPTION_ITEM_INVALID',
              message: `Selected option on "${cartItem.itemNameSnapshot}" is no longer valid.`,
              entityType: 'menu_item',
              entityId: liveItem.id,
              entityName: cartItem.itemNameSnapshot,
              canRetry: true,
            }),
          );
          continue;
        }

        if (!Boolean(optionItem.isActive)) {
          this.pushBlockingIssue(
            issues,
            blockingIssues,
            this.createBlockingIssue({
              code: 'OPTION_ITEM_INACTIVE',
              message: `Selected option "${selection.optionItemNameSnapshot}" is inactive.`,
              entityType: 'menu_item',
              entityId: liveItem.id,
              entityName: cartItem.itemNameSnapshot,
              canRetry: true,
            }),
          );
        }

        if (optionItem.name !== selection.optionItemNameSnapshot) {
          this.pushBlockingIssue(
            issues,
            blockingIssues,
            this.createBlockingIssue({
              code: 'OPTION_ITEM_CHANGED',
              message: `Selected option changed on "${cartItem.itemNameSnapshot}".`,
              entityType: 'menu_item',
              entityId: liveItem.id,
              entityName: cartItem.itemNameSnapshot,
              canRetry: true,
            }),
          );
        }

        if (
          this.roundPrice(optionItem.priceDelta) !==
          this.roundPrice(selection.optionPriceDeltaSnapshot)
        ) {
          this.pushBlockingIssue(
            issues,
            blockingIssues,
            this.createBlockingIssue({
              code: 'OPTION_ITEM_PRICE_CHANGED',
              message: `Option pricing changed on "${cartItem.itemNameSnapshot}".`,
              entityType: 'menu_item',
              entityId: liveItem.id,
              entityName: cartItem.itemNameSnapshot,
              canRetry: true,
            }),
          );
        }
      }

      for (const group of activeGroups) {
        const selections = selectionsByGroup.get(group.id) ?? [];
        if (Boolean(group.isRequired) && selections.length === 0) {
          this.pushBlockingIssue(
            issues,
            blockingIssues,
            this.createBlockingIssue({
              code: 'OPTION_GROUP_REQUIRED_MISSING',
              message: `Required option group "${group.name}" is missing on "${cartItem.itemNameSnapshot}".`,
              entityType: 'menu_item',
              entityId: liveItem.id,
              entityName: cartItem.itemNameSnapshot,
              canRetry: true,
            }),
          );
        }

        if (selections.length < group.minSelections) {
          this.pushBlockingIssue(
            issues,
            blockingIssues,
            this.createBlockingIssue({
              code: 'OPTION_GROUP_MIN_SELECTIONS_CHANGED',
              message: `Option group "${group.name}" no longer satisfies minimum selections.`,
              entityType: 'menu_item',
              entityId: liveItem.id,
              entityName: cartItem.itemNameSnapshot,
              canRetry: true,
            }),
          );
        }

        if (selections.length > group.maxSelections) {
          this.pushBlockingIssue(
            issues,
            blockingIssues,
            this.createBlockingIssue({
              code: 'OPTION_GROUP_MAX_SELECTIONS_CHANGED',
              message: `Option group "${group.name}" exceeds maximum selections.`,
              entityType: 'menu_item',
              entityId: liveItem.id,
              entityName: cartItem.itemNameSnapshot,
              canRetry: true,
            }),
          );
        }
      }

      const expectedLineBaseTotal = this.roundPrice(
        cartItem.unitBasePriceSnapshot * cartItem.quantity,
      );
      if (expectedLineBaseTotal !== this.roundPrice(cartItem.lineBaseTotal)) {
        this.pushBlockingIssue(
          issues,
          blockingIssues,
          this.createBlockingIssue({
            code: 'CART_ITEM_BASE_TOTAL_INCONSISTENT',
            message: `Base total snapshot is inconsistent for "${cartItem.itemNameSnapshot}".`,
            entityType: 'cart_item',
            entityId: cartItem.id,
            entityName: cartItem.itemNameSnapshot,
            canRetry: true,
          }),
        );
      }

      const expectedOptionsTotal = this.roundPrice(
        cartItem.selectedOptions.reduce(
          (sum, selection) => sum + selection.optionPriceDeltaSnapshot,
          0,
        ) * cartItem.quantity,
      );
      if (expectedOptionsTotal !== this.roundPrice(cartItem.lineOptionsTotal)) {
        this.pushBlockingIssue(
          issues,
          blockingIssues,
          this.createBlockingIssue({
            code: 'CART_ITEM_OPTIONS_TOTAL_INCONSISTENT',
            message: `Option total snapshot is inconsistent for "${cartItem.itemNameSnapshot}".`,
            entityType: 'cart_item',
            entityId: cartItem.id,
            entityName: cartItem.itemNameSnapshot,
            canRetry: true,
          }),
        );
      }

      const expectedLineTotal = this.roundPrice(expectedLineBaseTotal + expectedOptionsTotal);
      if (expectedLineTotal !== this.roundPrice(cartItem.lineTotal)) {
        this.pushBlockingIssue(
          issues,
          blockingIssues,
          this.createBlockingIssue({
            code: 'CART_ITEM_LINE_TOTAL_INCONSISTENT',
            message: `Line total snapshot is inconsistent for "${cartItem.itemNameSnapshot}".`,
            entityType: 'cart_item',
            entityId: cartItem.id,
            entityName: cartItem.itemNameSnapshot,
            canRetry: true,
          }),
        );
      }

      computedSubtotal = this.roundPrice(computedSubtotal + expectedLineTotal);
      computedCurrency = liveItem.currencyCode;
    }

    if (this.roundPrice(computedSubtotal) !== this.roundPrice(cart.subtotalAmount)) {
      this.pushBlockingIssue(
        issues,
        blockingIssues,
        this.createBlockingIssue({
          code: 'CART_SUBTOTAL_INCONSISTENT',
          message: 'Cart subtotal snapshot is inconsistent.',
          entityType: 'cart',
          entityId: cart.id,
          canRetry: true,
        }),
      );
    }

    if (this.roundPrice(cart.totalAmount) !== this.roundPrice(cart.subtotalAmount)) {
      this.pushBlockingIssue(
        issues,
        blockingIssues,
        this.createBlockingIssue({
          code: 'CART_TOTAL_INCONSISTENT',
          message: 'Cart total snapshot is inconsistent.',
          entityType: 'cart',
          entityId: cart.id,
          canRetry: true,
        }),
      );
    }

    return {
      isValid: issues.length === 0,
      hasBlockingIssues: issues.length > 0,
      canCheckout: issues.length === 0,
      canUpdateCart: true,
      canRetryCheckout: true,
      nextAction:
        issues.length === 0
          ? this.validationNextActions.checkout
          : this.validationNextActions.updateCart,
      issues,
      blockingIssues,
      cart: this.mapCart(cart),
      cartItems,
      totals: {
        subtotalAmount: computedSubtotal,
        totalAmount: computedSubtotal,
        currency: computedCurrency,
      },
    };
  }

  private createBlockingIssue(
    issue: Omit<ValidationBlockingIssue, 'entityType' | 'entityId' | 'entityName'> & {
      entityType?: string | null;
      entityId?: string | null;
      entityName?: string | null;
    },
  ): ValidationBlockingIssue {
    return {
      ...issue,
      entityType: issue.entityType ?? null,
      entityId: issue.entityId ?? null,
      entityName: issue.entityName ?? null,
    };
  }

  private buildEmptyCartValidationResult() {
    return {
      isValid: false,
      hasBlockingIssues: true,
      canCheckout: false,
      canUpdateCart: false,
      canRetryCheckout: false,
      nextAction: this.validationNextActions.startCart,
      issues: ['Your active cart is empty.'],
      blockingIssues: [
        this.createBlockingIssue({
          code: 'CART_EMPTY',
          message: 'Your active cart is empty.',
          entityType: 'cart',
          canRetry: false,
        }),
      ],
      cart: null,
      cartItems: [],
    };
  }

  private pushBlockingIssue(
    messages: string[],
    issues: ValidationBlockingIssue[],
    issue: ValidationBlockingIssue,
  ) {
    messages.push(issue.message);
    issues.push(issue);
  }

  private async findCartByCustomer(customerAccountId: string) {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "Cart" WHERE "customerAccountId" = $customerAccountId LIMIT 1`)
      .get({ $customerAccountId: customerAccountId })) as CartRow | undefined;

    return row ?? null;
  }

  private async findCartByCustomerForUpdate(customerAccountId: string) {
    const row = (await this.databaseService
      .prepare(
        `SELECT * FROM "Cart"
         WHERE "customerAccountId" = $customerAccountId
         LIMIT 1
         FOR UPDATE`,
      )
      .get({ $customerAccountId: customerAccountId })) as CartRow | undefined;

    return row ?? null;
  }

  private async loadCartItems(cartId: string) {
    const itemRows = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "CartItem"
         WHERE "cartId" = $cartId
         ORDER BY "createdAt" ASC`,
      )
      .all({ $cartId: cartId })) as unknown as CartItemRow[];

    return Promise.all(
      itemRows.map(async (itemRow) => ({
        ...this.mapCartItem(itemRow),
        selectedOptions: await this.loadCartItemSelections(itemRow.id),
      })),
    );
  }

  private async loadCartItemSelections(cartItemId: string) {
    const rows = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "CartItemOptionSelection"
         WHERE "cartItemId" = $cartItemId
         ORDER BY "optionGroupNameSnapshot" ASC, "optionItemNameSnapshot" ASC`,
      )
      .all({ $cartItemId: cartItemId })) as unknown as CartItemSelectionRow[];

    return rows.map((row) => this.mapCartSelection(row));
  }

  private async loadOrderItemSelections(orderItemId: string) {
    const rows = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "OrderItemOptionSelection"
         WHERE "orderItemId" = $orderItemId
         ORDER BY "optionGroupNameSnapshot" ASC, "optionItemNameSnapshot" ASC`,
      )
      .all({ $orderItemId: orderItemId })) as unknown as OrderItemSelectionRow[];

    return rows.map((row) => this.mapOrderSelection(row));
  }

  private async buildOrderDetail(order: Order) {
    const itemRows = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "OrderItem"
         WHERE "orderId" = $orderId
         ORDER BY "createdAt" ASC`,
      )
      .all({ $orderId: order.id })) as unknown as OrderItemRow[];

    return {
      order: {
        ...order,
        items: await Promise.all(
          itemRows.map(async (itemRow) => ({
            ...this.mapOrderItem(itemRow),
            selectedOptions: await this.loadOrderItemSelections(itemRow.id),
          })),
        ),
        timeline: await this.loadOrderTimeline(order.id),
      },
    };
  }

  private async buildTenantOrderDetail(orderRow: TenantOrderRow) {
    const detail = await this.buildOrderDetail(this.mapOrder(orderRow));

    // Postgres JSONB sürücü tarafından zaten parse edilir; eski/legacy
    // string yanıtları için defansif fallback bırakıyoruz.
    let deliveryAddress: Record<string, unknown> | null = null;
    const raw = orderRow.deliveryAddressSnapshotJson;
    if (raw && typeof raw === 'object') {
      deliveryAddress = raw as Record<string, unknown>;
    } else if (typeof raw === 'string' && raw.trim()) {
      try {
        deliveryAddress = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        deliveryAddress = null;
      }
    }

    return {
      order: {
        ...detail.order,
        storeName: orderRow.storeName,
        customerSummary: this.mapCustomerSummary(orderRow),
        deliveryAddress,
        courierNotes: orderRow.courierNotes ?? null,
      },
    };
  }

  private async buildCustomerOrderDetail(orderRow: CustomerOrderRow) {
    const order = this.mapOrder(orderRow);
    const detail = await this.buildOrderDetail(order);

    return {
      order: {
        ...detail.order,
        storeName: orderRow.storeName,
        statusNote: this.getCustomerVisibleStatusNote(order),
        timeline: this.filterCustomerVisibleTimeline(detail.order.timeline),
        isActive: this.isCustomerActiveStatus(order.status),
        canCustomerCancel: this.canCustomerCancel(order),
      },
    };
  }

  private async loadOptionGroupsForMenuItem(menuItemId: string) {
    return (await this.databaseService
      .prepare(`SELECT * FROM "MenuOptionGroup" WHERE "menuItemId" = $menuItemId`)
      .all({ $menuItemId: menuItemId })) as unknown as MenuOptionGroupRow[];
  }

  private async findMenuItemById(menuItemId: string) {
    return (await this.databaseService
      .prepare(
        `SELECT mi.*, mc."isActive" AS "categoryIsActive", mc."name" AS "categoryName",
                c."code" AS "currencyCode"
         FROM "MenuItem" mi
         INNER JOIN "Currency" c ON c."id" = mi."currencyId"
         LEFT JOIN "MenuCategory" mc
           ON mc."id" = mi."categoryId"
         WHERE mi."id" = $id
         LIMIT 1`,
      )
      .get({ $id: menuItemId })) as MenuItemRow | undefined;
  }

  private async findOptionItem(optionGroupId: string, optionItemId: string) {
    return (await this.databaseService
      .prepare(
        `SELECT *
         FROM "MenuOptionItem"
         WHERE "id" = $id AND "optionGroupId" = $optionGroupId
         LIMIT 1`,
      )
      .get({
        $id: optionItemId,
        $optionGroupId: optionGroupId,
      })) as MenuOptionItemRow | undefined;
  }

  private async findOrderForCustomer(customerAccountId: string, orderId: string) {
    const row = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "Order"
         WHERE "id" = $id AND "customerAccountId" = $customerAccountId
         LIMIT 1`,
      )
      .get({
        $id: orderId,
        $customerAccountId: customerAccountId,
      })) as OrderRow | undefined;

    return row ? this.mapOrder(row) : null;
  }

  private async findOrderForCustomerMutation(customerAccountId: string, orderId: string) {
    const order = await this.findOrderForCustomer(customerAccountId, orderId);
    if (order) {
      return order;
    }

    const existingOrder = await this.findOrderById(orderId);
    if (existingOrder) {
      throw new ForbiddenException('You can only manage your own orders.');
    }

    return null;
  }

  private async findCustomerOrderRow(customerAccountId: string, orderId: string) {
    const row = (await this.databaseService
      .prepare(
        `SELECT o.*, r."name" AS "storeName"
         FROM "Order" o
         INNER JOIN "Store" r ON r."id" = o."storeId"
         WHERE o."id" = $id AND o."customerAccountId" = $customerAccountId
         LIMIT 1`,
      )
      .get({
        $id: orderId,
        $customerAccountId: customerAccountId,
      })) as CustomerOrderRow | undefined;

    if (row) {
      return row;
    }

    const existingOrder = await this.findOrderById(orderId);
    if (existingOrder) {
      throw new ForbiddenException('You can only access your own orders.');
    }

    return undefined;
  }

  private async findOrderForOwnedStore(ownerTenantId: string, orderId: string) {
    const row = (await this.databaseService
      .prepare(
        `SELECT o.*
         FROM "Order" o
         INNER JOIN "Store" r ON r."id" = o."storeId"
         WHERE o."id" = $id AND r."ownerTenantId" = $ownerTenantId
         LIMIT 1`,
      )
      .get({
        $id: orderId,
        $ownerTenantId: ownerTenantId,
      })) as OrderRow | undefined;

    return row ? this.mapOrder(row) : null;
  }

  private async findTenantOrderRow(ownerTenantId: string, orderId: string) {
    const row = (await this.databaseService
      .prepare(
        `SELECT o.*, r."name" AS "storeName",
                c."firstName" AS "customerFirstName",
                c."lastName" AS "customerLastName",
                c."email" AS "customerEmail",
                c."phoneNumber" AS "customerProfilePhone"
         FROM "Order" o
         INNER JOIN "Store" r ON r."id" = o."storeId"
         INNER JOIN "CustomerAccount" c ON c."id" = o."customerAccountId"
         WHERE o."id" = $id AND r."ownerTenantId" = $ownerTenantId
         LIMIT 1`,
      )
      .get({
        $id: orderId,
        $ownerTenantId: ownerTenantId,
      })) as TenantOrderRow | undefined;

    if (row) {
      return row;
    }

    const existingOrder = await this.findOrderById(orderId);
    if (existingOrder) {
      throw new ForbiddenException('You can only access orders for your own stores.');
    }

    return undefined;
  }

  private async findOrderById(orderId: string) {
    return (await this.databaseService
      .prepare(`SELECT * FROM "Order" WHERE "id" = $id LIMIT 1`)
      .get({ $id: orderId })) as OrderRow | undefined;
  }

  private async getOrderById(orderId: string) {
    const row = (await this.databaseService
      .prepare(`SELECT * FROM "Order" WHERE "id" = $id LIMIT 1`)
      .get({ $id: orderId })) as OrderRow | undefined;

    if (!row) {
      throw new NotFoundException('Order could not be found.');
    }

    return this.buildOrderDetail(this.mapOrder(row));
  }

  private async loadOrderTimeline(orderId: string) {
    const rows = (await this.databaseService
      .prepare(
        `SELECT *
         FROM "OrderStatusEvent"
         WHERE "orderId" = $orderId
         ORDER BY "createdAt" ASC`,
      )
      .all({ $orderId: orderId })) as unknown as OrderStatusEventRow[];

    return rows.map((row) => this.mapOrderStatusEvent(row));
  }

  private async createOrderStatusEvent(event: {
    orderId: string;
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    actorType: 'customer' | 'tenant' | 'system';
    actorId: string;
    note: string | null;
  }) {
    await this.databaseService
      .prepare(
        `INSERT INTO "OrderStatusEvent" (
          "id", "orderId", "fromStatus", "toStatus", "actorType", "actorId", "note", "createdAt"
        ) VALUES (
          $id, $orderId, $fromStatus, $toStatus, $actorType, $actorId, $note, $createdAt
        )`,
      )
      .run({
        $id: randomUUID(),
        $orderId: event.orderId,
        $fromStatus: event.fromStatus,
        $toStatus: event.toStatus,
        $actorType: event.actorType,
        $actorId: event.actorId,
        $note: event.note,
        $createdAt: new Date().toISOString(),
      });
  }

  private async deleteCart(cartId: string) {
    await this.databaseService
      .prepare(`DELETE FROM "Cart" WHERE "id" = $id`)
      .run({ $id: cartId });
  }

  private roundPrice(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  private calculateOrderTotals(
    cartItems: Array<{
      currencySnapshot: string;
      lineTotal: number;
    }>,
  ) {
    if (cartItems.length === 0) {
      throw new BadRequestException('Your active cart is empty.');
    }

    const currencies = new Set(cartItems.map((item) => item.currencySnapshot));
    if (currencies.size !== 1) {
      throw new ConflictException('Cart items must share the same currency.');
    }

    const subtotalAmount = this.roundPrice(
      cartItems.reduce((sum, item) => sum + Number(item.lineTotal), 0),
    );

    return {
      subtotalAmount,
      totalAmount: subtotalAmount,
      currency: cartItems[0].currencySnapshot,
    };
  }

  private mapCart(row: CartRow) {
    return {
      id: row.id,
      customerAccountId: row.customerAccountId,
      storeId: row.storeId,
      subtotalAmount: Number(row.subtotalAmount),
      totalAmount: Number(row.totalAmount),
      currencyId: row.currencyId ?? null,
      currencySnapshot: row.currencySnapshot,
      serviceTypeId: row.serviceTypeId ?? null,
      serviceTypeSnapshot: row.serviceTypeSnapshot,
      paymentMethodId: row.paymentMethodId ?? null,
      paymentMethodSnapshot: row.paymentMethodSnapshot ?? null,
      deliveryDistanceKm:
        row.deliveryDistanceKm === null || row.deliveryDistanceKm === undefined
          ? null
          : Number(row.deliveryDistanceKm),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapCartItem(row: CartItemRow) {
    return {
      id: row.id,
      cartId: row.cartId,
      menuItemId: row.menuItemId,
      itemNameSnapshot: row.itemNameSnapshot,
      unitBasePriceSnapshot: Number(row.unitBasePriceSnapshot),
      currencySnapshot: row.currencySnapshot,
      quantity: Number(row.quantity),
      lineBaseTotal: Number(row.lineBaseTotal),
      lineOptionsTotal: Number(row.lineOptionsTotal),
      lineTotal: Number(row.lineTotal),
      selectionSignature: row.selectionSignature,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapCartSelection(row: CartItemSelectionRow) {
    return {
      id: row.id,
      cartItemId: row.cartItemId,
      optionGroupId: row.optionGroupId,
      optionItemId: row.optionItemId,
      optionGroupNameSnapshot: row.optionGroupNameSnapshot,
      optionItemNameSnapshot: row.optionItemNameSnapshot,
      optionPriceDeltaSnapshot: Number(row.optionPriceDeltaSnapshot),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapOrder(row: OrderRow): Order {
    return {
      id: row.id,
      customerAccountId: row.customerAccountId,
      storeId: row.storeId,
      status: row.status as OrderStatus,
      rejectedReason: row.rejectedReason,
      statusNote: row.statusNote,
      lastStatusChangedAt: row.lastStatusChangedAt
        ? new Date(row.lastStatusChangedAt)
        : null,
      lastStatusChangedByType: row.lastStatusChangedByType as
        | 'customer'
        | 'tenant'
        | 'system'
        | null,
      subtotalAmount: Number(row.subtotalAmount),
      totalAmount: Number(row.totalAmount),
      currencyId: row.currencyId ?? null,
      currencySnapshot: row.currencySnapshot,
      serviceTypeId: row.serviceTypeId ?? null,
      serviceTypeSnapshot: row.serviceTypeSnapshot,
      paymentMethodId: row.paymentMethodId ?? null,
      paymentMethodSnapshot: row.paymentMethodSnapshot ?? null,
      deliveryFeeAmount:
        row.deliveryFeeAmount === null || row.deliveryFeeAmount === undefined
          ? 0
          : Number(row.deliveryFeeAmount),
      deliveryDistanceKm:
        row.deliveryDistanceKm === null || row.deliveryDistanceKm === undefined
          ? null
          : Number(row.deliveryDistanceKm),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapOrderItem(row: OrderItemRow): OrderItem {
    return {
      id: row.id,
      orderId: row.orderId,
      menuItemId: row.menuItemId,
      itemNameSnapshot: row.itemNameSnapshot,
      unitBasePriceSnapshot: Number(row.unitBasePriceSnapshot),
      currencySnapshot: row.currencySnapshot,
      quantity: Number(row.quantity),
      lineBaseTotal: Number(row.lineBaseTotal),
      lineOptionsTotal: Number(row.lineOptionsTotal),
      lineTotal: Number(row.lineTotal),
      selectionSignature: row.selectionSignature,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapOrderSelection(row: OrderItemSelectionRow): OrderItemOptionSelection {
    return {
      id: row.id,
      orderItemId: row.orderItemId,
      optionGroupId: row.optionGroupId,
      optionItemId: row.optionItemId,
      optionGroupNameSnapshot: row.optionGroupNameSnapshot,
      optionItemNameSnapshot: row.optionItemNameSnapshot,
      optionPriceDeltaSnapshot: Number(row.optionPriceDeltaSnapshot),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }

  private mapCustomerSummary(row: {
    customerFirstName: string;
    customerLastName: string;
    customerEmail: string;
    customerPhoneSnapshot?: string | null;
    customerProfilePhone?: string | null;
  }) {
    // Snapshot öncelikli: sipariş anındaki telefon. Snapshot yoksa müşterinin
    // güncel profil telefonu fallback. İkisi de yoksa null.
    const phone =
      row.customerPhoneSnapshot ?? row.customerProfilePhone ?? null;
    return {
      firstName: row.customerFirstName,
      lastName: row.customerLastName,
      fullName: `${row.customerFirstName} ${row.customerLastName}`.trim(),
      email: row.customerEmail,
      phone,
    };
  }

  private mapOrderStatusEvent(row: OrderStatusEventRow): OrderStatusEvent {
    return {
      id: row.id,
      orderId: row.orderId,
      fromStatus: row.fromStatus as OrderStatus | null,
      toStatus: row.toStatus as OrderStatus,
      actorType: row.actorType as 'customer' | 'tenant' | 'system',
      actorId: row.actorId,
      note: row.note,
      createdAt: new Date(row.createdAt),
    };
  }

  private isCustomerActiveStatus(status: OrderStatus) {
    return this.customerActiveStatuses.includes(status);
  }

  private isCustomerHistoryStatus(status: OrderStatus) {
    return this.customerHistoryStatuses.includes(status);
  }

  private canCustomerCancel(order: Pick<Order, 'status'>) {
    return order.status === OrderStatus.PENDING_PAYMENT;
  }

  private getCustomerVisibleStatusNote(
    order: Pick<Order, 'status' | 'statusNote' | 'lastStatusChangedByType'>,
  ) {
    if (!order.statusNote) {
      return null;
    }

    if (order.lastStatusChangedByType === 'customer') {
      return order.statusNote;
    }

    if (
      [OrderStatus.REJECTED, OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED].includes(
        order.status,
      )
    ) {
      return order.statusNote;
    }

    return null;
  }

  private filterCustomerVisibleTimeline(timeline: OrderStatusEvent[]) {
    return timeline.map((event) => ({
      ...event,
      note: this.getCustomerVisibleTimelineNote(event),
    }));
  }

  private getCustomerVisibleTimelineNote(
    event: Pick<OrderStatusEvent, 'actorType' | 'toStatus' | 'note'>,
  ) {
    if (!event.note) {
      return null;
    }

    if (event.actorType === 'customer') {
      return event.note;
    }

    if (
      [OrderStatus.REJECTED, OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED].includes(
        event.toStatus,
      )
    ) {
      return event.note;
    }

    return null;
  }
}

interface CartRow {
  id: string;
  customerAccountId: string;
  storeId: string;
  subtotalAmount: number;
  totalAmount: number;
  currencyId: string | null;
  currencySnapshot: string;
  serviceTypeId: string | null;
  serviceTypeSnapshot: string;
  paymentMethodId: string | null;
  paymentMethodSnapshot: string | null;
  deliveryDistanceKm?: number | string | null;
  createdAt: string;
  updatedAt: string;
}

interface CartItemRow {
  id: string;
  cartId: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitBasePriceSnapshot: number;
  currencySnapshot: string;
  quantity: number;
  lineBaseTotal: number;
  lineOptionsTotal: number;
  lineTotal: number;
  selectionSignature: string;
  createdAt: string;
  updatedAt: string;
}

interface CartItemSelectionRow {
  id: string;
  cartItemId: string;
  optionGroupId: string;
  optionItemId: string;
  optionGroupNameSnapshot: string;
  optionItemNameSnapshot: string;
  optionPriceDeltaSnapshot: number;
  createdAt: string;
  updatedAt: string;
}

interface MenuItemRow {
  id: string;
  storeId: string;
  categoryId: string | null;
  categoryIsActive?: boolean | null;
  categoryName?: string | null;
  name: string;
  description: string | null;
  basePrice: number;
  currencyId: string;
  currencyCode: string;
  isActive: number;
  availabilityType: string;
  createdAt: string;
  updatedAt: string;
}

interface MenuOptionGroupRow {
  id: string;
  menuItemId: string;
  name: string;
  description: string | null;
  minSelections: number;
  maxSelections: number;
  isRequired: number;
  sortOrder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

interface MenuOptionItemRow {
  id: string;
  optionGroupId: string;
  name: string;
  priceDelta: number;
  sortOrder: number;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

interface OrderRow {
  id: string;
  customerAccountId: string;
  storeId: string;
  status: string;
  rejectedReason: string | null;
  statusNote: string | null;
  lastStatusChangedAt: string | null;
  lastStatusChangedByType: string | null;
  subtotalAmount: number;
  totalAmount: number;
  currencyId: string | null;
  currencySnapshot: string;
  serviceTypeId: string | null;
  serviceTypeSnapshot: string;
  paymentMethodId: string | null;
  paymentMethodSnapshot: string | null;
  deliveryFeeAmount?: number | string | null;
  deliveryDistanceKm?: number | string | null;
  createdAt: string;
  updatedAt: string;
}

interface TenantOrderListRow extends OrderRow {
  storeName: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  itemCount: number;
}

interface CustomerOrderListRow extends OrderRow {
  storeName: string;
  itemCount: number;
}

interface CustomerOrderRow extends OrderRow {
  storeName: string;
}

interface TenantOrderRow extends OrderRow {
  storeName: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerProfilePhone: string | null;
  customerPhoneSnapshot?: string | null;
  deliveryAddressSnapshotJson?: Record<string, unknown> | string | null;
  courierNotes?: string | null;
}

interface OrderItemRow {
  id: string;
  orderId: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitBasePriceSnapshot: number;
  currencySnapshot: string;
  quantity: number;
  lineBaseTotal: number;
  lineOptionsTotal: number;
  lineTotal: number;
  selectionSignature: string;
  createdAt: string;
  updatedAt: string;
}

interface OrderItemSelectionRow {
  id: string;
  orderItemId: string;
  optionGroupId: string;
  optionItemId: string;
  optionGroupNameSnapshot: string;
  optionItemNameSnapshot: string;
  optionPriceDeltaSnapshot: number;
  createdAt: string;
  updatedAt: string;
}

interface OrderStatusEventRow {
  id: string;
  orderId: string;
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  actorId: string;
  note: string | null;
  createdAt: string;
}

interface CartSelectionView {
  id: string;
  cartItemId: string;
  optionGroupId: string;
  optionItemId: string;
  optionGroupNameSnapshot: string;
  optionItemNameSnapshot: string;
  optionPriceDeltaSnapshot: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ValidationBlockingIssue {
  code: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  canRetry: boolean;
}
