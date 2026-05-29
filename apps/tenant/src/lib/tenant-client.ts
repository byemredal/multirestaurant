import type { StoredTenantSession } from '@/lib/storage/tenant-session';
import { apiBaseUrl, tenantRequest as request } from '@/lib/http/tenant-http';

export { apiBaseUrl };

type TenantPayload = {
  accessToken: string;
  csrfToken: string;
  tenant: StoredTenantSession['tenant'];
};

export async function loginTenant(email: string, password: string) {
  const response = await fetch(`${apiBaseUrl}/tenants/login`, {
    body: JSON.stringify({ email, password }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('tenant_login_failed');
  }

  const payload = (await response.json()) as TenantPayload;
  return {
    accessToken: payload.accessToken,
    csrfToken: payload.csrfToken,
    tenant: payload.tenant,
  } satisfies StoredTenantSession;
}

/** Sets (or replaces) the authenticated tenant's password — used after approval. */
export function setTenantPassword(session: StoredTenantSession, password: string) {
  return request<StoredTenantSession['tenant']>('/tenants/me/password', session, {
    body: JSON.stringify({ password }),
    method: 'POST',
  });
}

export async function bootstrapTenantSession(session: StoredTenantSession) {
  const response = await fetch(`${apiBaseUrl}/tenants/me`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  });

  if (response.ok) {
    return session;
  }

  const refreshResponse = await fetch(`${apiBaseUrl}/tenants/refresh`, {
    credentials: 'include',
    headers: {
      'X-CSRF-Token': session.csrfToken,
    },
    method: 'POST',
  });

  if (!refreshResponse.ok) {
    throw new Error('tenant_refresh_failed');
  }

  const payload = (await refreshResponse.json()) as TenantPayload;
  return {
    accessToken: payload.accessToken,
    csrfToken: payload.csrfToken,
    tenant: payload.tenant,
  } satisfies StoredTenantSession;
}

export async function logoutTenant(session: StoredTenantSession) {
  const response = await fetch(`${apiBaseUrl}/tenants/logout`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'X-CSRF-Token': session.csrfToken,
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('tenant_logout_failed');
  }
}

export function listTenantStores(session: StoredTenantSession) {
  return request<Array<any>>('/stores/mine', session);
}

export type TenantStoreSetting = {
  id: string;
  storeId: string;
  primaryLanguage: string;
  currencyCode: string;
  serviceMode:
    | 'delivery_only'
    | 'pickup_only'
    | 'delivery_and_pickup'
    | 'reservation_only';
  advancedOptionsJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TenantStoreTaxSetting = {
  id: string;
  storeId: string;
  taxRegistrationNumber: string | null;
  priceIncludesTax: boolean;
  defaultVatRate: number;
  serviceChargeRate: number;
  invoiceFooterText: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantStoreReservationSetting = {
  id: string;
  storeId: string;
  enabled: boolean;
  requiresApproval: boolean;
  maxPartySize: number | null;
  defaultSlotMinutes: number;
  leadTimeMinutes: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantStoreReceiptSetting = {
  id: string;
  storeId: string;
  headerText: string | null;
  footerText: string | null;
  showTaxBreakdown: boolean;
  showQrCode: boolean;
  layoutConfigJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TenantStoreDiscountRule = {
  id: string;
  storeId: string;
  name: string;
  ruleType: 'coupon' | 'automatic' | 'loyalty' | 'campaign';
  valueType: 'percentage' | 'fixed';
  valueAmount: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function getTenantStoreSettings(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<TenantStoreSetting>(
    `/tenant/stores/${storeId}/settings`,
    session,
  );
}

export function updateTenantStoreSettings(
  session: StoredTenantSession,
  storeId: string,
  input: Partial<
    Pick<
      TenantStoreSetting,
      'primaryLanguage' | 'currencyCode' | 'serviceMode' | 'advancedOptionsJson'
    >
  >,
) {
  return request<TenantStoreSetting>(
    `/tenant/stores/${storeId}/settings`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PUT',
    },
  );
}

export function getTenantStoreTaxSettings(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<TenantStoreTaxSetting>(
    `/tenant/stores/${storeId}/tax-settings`,
    session,
  );
}

export function updateTenantStoreTaxSettings(
  session: StoredTenantSession,
  storeId: string,
  input: Partial<
    Pick<
      TenantStoreTaxSetting,
      | 'taxRegistrationNumber'
      | 'priceIncludesTax'
      | 'defaultVatRate'
      | 'serviceChargeRate'
      | 'invoiceFooterText'
    >
  >,
) {
  return request<TenantStoreTaxSetting>(
    `/tenant/stores/${storeId}/tax-settings`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PUT',
    },
  );
}

export function getTenantStoreReservationSettings(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<TenantStoreReservationSetting>(
    `/tenant/stores/${storeId}/reservation-settings`,
    session,
  );
}

export function updateTenantStoreReservationSettings(
  session: StoredTenantSession,
  storeId: string,
  input: Partial<
    Pick<
      TenantStoreReservationSetting,
      | 'enabled'
      | 'requiresApproval'
      | 'maxPartySize'
      | 'defaultSlotMinutes'
      | 'leadTimeMinutes'
      | 'notes'
    >
  >,
) {
  return request<TenantStoreReservationSetting>(
    `/tenant/stores/${storeId}/reservation-settings`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PUT',
    },
  );
}

export function getTenantStoreReceiptSettings(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<TenantStoreReceiptSetting>(
    `/tenant/stores/${storeId}/receipt-settings`,
    session,
  );
}

export function updateTenantStoreReceiptSettings(
  session: StoredTenantSession,
  storeId: string,
  input: Partial<
    Pick<
      TenantStoreReceiptSetting,
      'headerText' | 'footerText' | 'showTaxBreakdown' | 'showQrCode' | 'layoutConfigJson'
    >
  >,
) {
  return request<TenantStoreReceiptSetting>(
    `/tenant/stores/${storeId}/receipt-settings`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PUT',
    },
  );
}

// ── Commerce: payment methods, ordering policy, delivery fee tiers ─────────
// Codes MUST match the backend PaymentMethod catalog (migration 0004); otherwise
// the assignment save rejects unknown codes. provider-backed methods are listed
// but stay inactive until a payment provider is wired up.
export type TenantPaymentMethodCode =
  | 'cash'
  | 'credit_card'
  | 'online_card'
  | 'meal_card'
  | 'wallet';

export const TENANT_PAYMENT_METHODS: Array<{
  code: TenantPaymentMethodCode;
  defaultLabel: string;
}> = [
  { code: 'cash', defaultLabel: 'Nakit (kapıda)' },
  { code: 'credit_card', defaultLabel: 'Kredi kartı (kapıda)' },
  { code: 'online_card', defaultLabel: 'Online kart' },
  { code: 'meal_card', defaultLabel: 'Yemek kartı' },
  { code: 'wallet', defaultLabel: 'Cüzdan' },
];

export type TenantStorePaymentMethod = {
  id: string;
  storeId: string;
  method: TenantPaymentMethodCode;
  label: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type TenantStoreOrderingPolicy = {
  id: string;
  storeId: string;
  minOrderAmount: number;
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  currencyCode: string;
  createdAt: string;
  updatedAt: string;
};

export type TenantStoreDeliveryFeeTier = {
  id: string;
  storeId: string;
  minDistanceKm: number;
  maxDistanceKm: number;
  feeAmount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function getTenantStorePaymentMethods(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<{ paymentMethods: TenantStorePaymentMethod[] }>(
    `/tenant/stores/${storeId}/payment-methods`,
    session,
  );
}

export function replaceTenantStorePaymentMethods(
  session: StoredTenantSession,
  storeId: string,
  paymentMethods: Array<{
    method: TenantPaymentMethodCode;
    label?: string | null;
    isActive?: boolean;
    sortOrder?: number;
  }>,
) {
  // Map to the backend assignment contract: it resolves the canonical
  // `paymentMethod` code to a PaymentMethod id and stores the label as
  // `customLabel`.
  const payload = {
    paymentMethods: paymentMethods.map((entry) => ({
      paymentMethod: entry.method,
      customLabel: entry.label ?? null,
      isActive: entry.isActive,
      sortOrder: entry.sortOrder,
    })),
  };

  return request<{ paymentMethods: TenantStorePaymentMethod[] }>(
    `/tenant/stores/${storeId}/payment-methods`,
    session,
    {
      body: JSON.stringify(payload),
      method: 'PUT',
    },
  );
}

export function getTenantStoreOrderingPolicy(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<TenantStoreOrderingPolicy>(
    `/tenant/stores/${storeId}/ordering-policy`,
    session,
  );
}

export function updateTenantStoreOrderingPolicy(
  session: StoredTenantSession,
  storeId: string,
  input: Partial<
    Pick<
      TenantStoreOrderingPolicy,
      'minOrderAmount' | 'acceptsDelivery' | 'acceptsPickup' | 'currencyCode'
    >
  >,
) {
  return request<TenantStoreOrderingPolicy>(
    `/tenant/stores/${storeId}/ordering-policy`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PUT',
    },
  );
}

export function getTenantStoreDeliveryFeeTiers(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<{ deliveryFeeTiers: TenantStoreDeliveryFeeTier[] }>(
    `/tenant/stores/${storeId}/delivery-fee-tiers`,
    session,
  );
}

export function replaceTenantStoreDeliveryFeeTiers(
  session: StoredTenantSession,
  storeId: string,
  tiers: Array<{
    minDistanceKm: number;
    maxDistanceKm: number;
    feeAmount: number;
    sortOrder?: number;
    isActive?: boolean;
  }>,
) {
  return request<{ deliveryFeeTiers: TenantStoreDeliveryFeeTier[] }>(
    `/tenant/stores/${storeId}/delivery-fee-tiers`,
    session,
    {
      body: JSON.stringify({ tiers }),
      method: 'PUT',
    },
  );
}

export function listTenantStoreDiscountRules(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<{ discountRules: TenantStoreDiscountRule[] }>(
    `/tenant/stores/${storeId}/discount-rules`,
    session,
  );
}

export function createTenantStoreDiscountRule(
  session: StoredTenantSession,
  storeId: string,
  input: {
    name: string;
    ruleType: TenantStoreDiscountRule['ruleType'];
    valueType: TenantStoreDiscountRule['valueType'];
    valueAmount: number;
    isActive?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
  },
) {
  return request<{ discountRule: TenantStoreDiscountRule }>(
    `/tenant/stores/${storeId}/discount-rules`,
    session,
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  );
}

export function updateTenantStoreDiscountRule(
  session: StoredTenantSession,
  storeId: string,
  ruleId: string,
  input: Partial<{
    name: string;
    ruleType: TenantStoreDiscountRule['ruleType'];
    valueType: TenantStoreDiscountRule['valueType'];
    valueAmount: number;
    isActive: boolean;
    startsAt: string | null;
    endsAt: string | null;
  }>,
) {
  return request<{ discountRule: TenantStoreDiscountRule }>(
    `/tenant/stores/${storeId}/discount-rules/${ruleId}`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PUT',
    },
  );
}

export function deleteTenantStoreDiscountRule(
  session: StoredTenantSession,
  storeId: string,
  ruleId: string,
) {
  return request<{ success: boolean }>(
    `/tenant/stores/${storeId}/discount-rules/${ruleId}`,
    session,
    {
      method: 'DELETE',
    },
  );
}

export type TenantBusinessInfoInput = {
  businessName?: string;
  businessType?: string;
  registrationNumber?: string | null;
  taxNumber?: string | null;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  postalCode?: string;
  country?: string;
};

export type TenantLegalTaxInfoInput = {
  legalEntityName?: string;
  taxId?: string | null;
  vatId?: string | null;
  registrationCountry?: string;
  registeredAddress?: string;
};

export type TenantOwnerContactInfoInput = {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  roleTitle?: string | null;
  ownershipPercentage?: number | null;
};

export type TenantOperationsInfoInput = {
  primaryCity?: string;
  primaryPostalCode?: string;
  deliveryModel?: string;
  supportsPickup?: boolean;
  openingHoursSummary?: string | null;
  estimatedGoLiveDate?: string | null;
};

export function createTenantStore(
  session: StoredTenantSession,
  input: Record<string, unknown>,
) {
  return request<{ store: any }>('/stores', session, {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function updateTenantStore(
  session: StoredTenantSession,
  storeId: string,
  input: Record<string, unknown>,
) {
  return request<{ store: any }>(`/stores/${storeId}`, session, {
    body: JSON.stringify(input),
    method: 'PATCH',
  });
}

export function listTenantMenuCategories(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<Array<any>>(`/stores/${storeId}/menu/categories`, session);
}

export function createTenantMenuCategory(
  session: StoredTenantSession,
  storeId: string,
  input: Record<string, unknown>,
) {
  return request<{ category: any }>(
    `/stores/${storeId}/menu/categories`,
    session,
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  );
}

export function updateTenantMenuCategory(
  session: StoredTenantSession,
  storeId: string,
  categoryId: string,
  input: Record<string, unknown>,
) {
  return request<{ category: any }>(
    `/stores/${storeId}/menu/categories/${categoryId}`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PATCH',
    },
  );
}

export function listTenantMenuItems(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<Array<any>>(`/stores/${storeId}/menu/items`, session);
}

export function createTenantMenuItem(
  session: StoredTenantSession,
  storeId: string,
  input: Record<string, unknown>,
) {
  return request<{ item: any }>(`/stores/${storeId}/menu/items`, session, {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export function updateTenantMenuItem(
  session: StoredTenantSession,
  storeId: string,
  itemId: string,
  input: Record<string, unknown>,
) {
  return request<{ item: any }>(
    `/stores/${storeId}/menu/items/${itemId}`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PATCH',
    },
  );
}

export function getTenantMenuItem(
  session: StoredTenantSession,
  storeId: string,
  itemId: string,
) {
  return request<{ item: any }>(`/stores/${storeId}/menu/items/${itemId}`, session);
}

export function createTenantOptionGroup(
  session: StoredTenantSession,
  storeId: string,
  itemId: string,
  input: Record<string, unknown>,
) {
  return request<{ optionGroup: any }>(
    `/stores/${storeId}/menu/items/${itemId}/option-groups`,
    session,
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  );
}

export function updateTenantOptionGroup(
  session: StoredTenantSession,
  storeId: string,
  itemId: string,
  groupId: string,
  input: Record<string, unknown>,
) {
  return request<{ optionGroup: any }>(
    `/stores/${storeId}/menu/items/${itemId}/option-groups/${groupId}`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PATCH',
    },
  );
}

export function createTenantOptionItem(
  session: StoredTenantSession,
  storeId: string,
  itemId: string,
  groupId: string,
  input: Record<string, unknown>,
) {
  return request<{ option: any }>(
    `/stores/${storeId}/menu/items/${itemId}/option-groups/${groupId}/options`,
    session,
    {
      body: JSON.stringify(input),
      method: 'POST',
    },
  );
}

export function updateTenantOptionItem(
  session: StoredTenantSession,
  storeId: string,
  itemId: string,
  groupId: string,
  optionId: string,
  input: Record<string, unknown>,
) {
  return request<{ option: any }>(
    `/stores/${storeId}/menu/items/${itemId}/option-groups/${groupId}/options/${optionId}`,
    session,
    {
      body: JSON.stringify(input),
      method: 'PATCH',
    },
  );
}

// ── System catalog (currencies) ──────────────────────────────────────────

export type SystemCurrency = {
  id: string;
  code: string;
  symbol: string;
  name?: string | null;
};

export async function listSystemCurrencies(): Promise<{
  currencies: SystemCurrency[];
}> {
  const response = await fetch(`${apiBaseUrl}/system/currencies`);
  if (!response.ok) {
    throw new Error('currencies_fetch_failed');
  }
  return (await response.json()) as { currencies: SystemCurrency[] };
}

// ── Cuisines (system catalog + store assignment) ─────────────────────────

export type Cuisine = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type StoreCuisineDetail = Cuisine & {
  isPrimary: boolean;
};

export async function listPublicCuisines(): Promise<{ cuisines: Cuisine[] }> {
  const response = await fetch(`${apiBaseUrl}/public/cuisines`);
  if (!response.ok) {
    throw new Error('cuisines_fetch_failed');
  }
  return (await response.json()) as { cuisines: Cuisine[] };
}

export function getTenantStoreCuisines(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<{ cuisines: StoreCuisineDetail[] }>(
    `/tenant/stores/${storeId}/cuisines`,
    session,
  );
}

export function replaceTenantStoreCuisines(
  session: StoredTenantSession,
  storeId: string,
  cuisineIds: string[],
  primaryCuisineId?: string,
) {
  return request<{ cuisines: StoreCuisineDetail[] }>(
    `/tenant/stores/${storeId}/cuisines`,
    session,
    {
      body: JSON.stringify({
        cuisineIds,
        ...(primaryCuisineId ? { primaryCuisineId } : {}),
      }),
      method: 'PUT',
    },
  );
}

// ── Tenant Reviews ───────────────────────────────────────────────────────────

export type TenantReview = {
  id: string;
  storeId: string;
  branchId: string | null;
  orderId: string;
  customerAccountId: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: 'visible' | 'hidden' | 'flagged' | 'deleted';
  authorDisplayName: string;
  tenantReplyBody: string | null;
  tenantReplyAt: string | null;
  tenantReplyByTenantId: string | null;
  flaggedAt: string | null;
  flaggedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantReviewSummary = {
  averageRating: number | null;
  totalReviews: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export function listTenantStoreReviews(
  session: StoredTenantSession,
  storeId: string,
) {
  return request<{ reviews: TenantReview[]; summary: TenantReviewSummary }>(
    `/tenant/stores/${storeId}/reviews`,
    session,
  );
}

export function replyTenantStoreReview(
  session: StoredTenantSession,
  storeId: string,
  reviewId: string,
  body: string,
) {
  return request<{ review: TenantReview }>(
    `/tenant/stores/${storeId}/reviews/${reviewId}/reply`,
    session,
    {
      body: JSON.stringify({ body }),
      method: 'POST',
    },
  );
}

export function flagTenantStoreReview(
  session: StoredTenantSession,
  storeId: string,
  reviewId: string,
  reason?: string,
) {
  return request<{ review: TenantReview }>(
    `/tenant/stores/${storeId}/reviews/${reviewId}/flag`,
    session,
    {
      body: JSON.stringify(reason ? { reason } : {}),
      method: 'PATCH',
    },
  );
}

// ── Customer Reviews ──────────────────────────────────────────────────────────

export type EligibleReviewOrder = {
  id: string;
  storeId: string;
  storeName: string;
  branchId: string | null;
  totalAmount: number;
  currency: string;
  createdAt: string;
};

// ── Tenant Orders ────────────────────────────────────────────────────────────

export type TenantOrderListItem = {
  id: string;
  storeId: string;
  storeName: string;
  status: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  isActionable: boolean;
  createdAt: string;
  lastStatusChangedAt: string | null;
};

export type TenantOrderItemOption = {
  id: string;
  optionGroupNameSnapshot: string;
  optionItemNameSnapshot: string;
  optionPriceDeltaSnapshot: number;
};

export type TenantOrderItem = {
  id: string;
  itemNameSnapshot: string;
  quantity: number;
  unitBasePriceSnapshot: number;
  lineTotal: number;
  currencySnapshot: string;
  selectedOptions: TenantOrderItemOption[];
};

export type TenantOrderTimeline = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actorType: string;
  note: string | null;
  createdAt: string;
};

export type TenantOrderCustomerSummary = {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  /** Sipariş anındaki snapshot; yoksa müşterinin güncel profil telefonu; ikisi de yoksa null. */
  phone: string | null;
};

export type TenantOrderDeliveryAddress = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type TenantOrderDetail = {
  id: string;
  storeId: string;
  storeName: string;
  status: string;
  totalAmount: number;
  subtotalAmount: number;
  currency: string;
  createdAt: string;
  items: TenantOrderItem[];
  timeline: TenantOrderTimeline[];
  // Faz D — snapshot/fulfillment alanları ve mevcut order kolonlarının
  // doğrudan görünümü. Hepsi opsiyonel/null tolerant: UI null kartı gizler,
  // mock veri uydurmaz.
  customerSummary: TenantOrderCustomerSummary | null;
  deliveryAddress: TenantOrderDeliveryAddress | null;
  courierNotes: string | null;
  rejectedReason: string | null;
  statusNote: string | null;
  serviceTypeSnapshot: string | null;
  paymentMethodSnapshot: string | null;
  deliveryFeeAmount: number;
  deliveryDistanceKm: number | null;
};

export type TenantOrderScope = 'operational' | 'history';

export type TenantOrdersQuery = {
  createdFrom?: string;
  createdTo?: string;
  storeId?: string;
};

export function listTenantOrders(
  session: StoredTenantSession,
  scope: TenantOrderScope = 'operational',
  query?: TenantOrdersQuery,
) {
  const params = new URLSearchParams();
  if (scope === 'history') params.set('scope', 'history');
  if (query?.createdFrom) params.set('createdFrom', query.createdFrom);
  if (query?.createdTo) params.set('createdTo', query.createdTo);
  if (query?.storeId) params.set('storeId', query.storeId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return request<TenantOrderListItem[]>(`/tenant/orders${qs}`, session);
}

export function getTenantOrder(session: StoredTenantSession, orderId: string) {
  return request<{ order: TenantOrderDetail }>(`/tenant/orders/${orderId}`, session);
}

export function updateTenantOrderStatus(
  session: StoredTenantSession,
  orderId: string,
  status: string,
  reason?: string,
) {
  return request<{ order: TenantOrderDetail }>(`/tenant/orders/${orderId}/status`, session, {
    method: 'PATCH',
    body: JSON.stringify(reason ? { status, reason } : { status }),
  });
}

// ── Tenant test order tooling (operational, not customer-facing) ────────────

export type CreateTenantTestOrderInput = {
  storeId: string;
  menuItemIds: string[];
  serviceType?: 'pickup' | 'delivery';
  note?: string;
};

export type CreateTenantTestOrderResult = {
  orderId: string;
  storeId: string;
  status: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  createdAt: string;
};

export function createTenantTestOrder(
  session: StoredTenantSession,
  input: CreateTenantTestOrderInput,
) {
  return request<CreateTenantTestOrderResult>('/tenant/test-orders', session, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
