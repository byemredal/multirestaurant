import type { ApiActionConfig } from '@/types/api-console';

export type ApiGroup = {
  id: string;
  label: string;
  actions: ApiActionConfig[];
};

export const apiGroups: ApiGroup[] = [
  {
    id: 'tenantOnboarding',
    label: 'Public - Tenant Onboarding',
    actions: [
      {
        id: 'resolveTenantOnboardingSession',
        method: 'GET',
        path: '/v2/tenant/onboarding/:stateToken/session',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        queryParams: [{ key: 'step', label: 'requested step slug' }],
      },
      {
        id: 'sendTenantOnboardingPhoneCode',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/phone/send-code',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [{ key: 'phoneNumber', label: 'phoneNumber' }],
      },
      {
        id: 'verifyTenantOnboardingPhoneCode',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/phone/verify-code',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [{ key: 'code', label: '6-digit code' }],
      },
      {
        id: 'resendTenantOnboardingPhoneCode',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/phone/resend-code',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [{ key: 'phoneNumber', label: 'phoneNumber (optional)' }],
      },
      {
        id: 'completeTenantOnboardingWelcome',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/welcome/complete',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
      },
      {
        id: 'saveTenantOnboardingLocationSelection',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/location',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [
          { key: 'locationLabel', label: 'locationLabel' },
          { key: 'rawInput', label: 'rawInput' },
          { key: 'country', label: 'country (ISO-2, default CH)' },
          { key: 'city', label: 'city (optional)' },
          { key: 'postalCode', label: 'postalCode (optional)' },
          { key: 'latitude', label: 'latitude (optional)' },
          { key: 'longitude', label: 'longitude (optional)' },
        ],
      },
      {
        id: 'saveTenantOnboardingAddress',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/address',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [
          { key: 'country', label: 'country (ISO-2)' },
          { key: 'city', label: 'city / region' },
          { key: 'postalCode', label: 'postalCode' },
          { key: 'addressLine1', label: 'addressLine1' },
          { key: 'addressLine2', label: 'addressLine2 (optional)' },
          { key: 'building', label: 'building (optional)' },
          { key: 'floor', label: 'floor (optional)' },
          { key: 'door', label: 'door (optional)' },
          { key: 'addressNote', label: 'addressNote (optional)' },
        ],
      },
      {
        id: 'verifyTenantOnboardingBusinessRegistration',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/business-details/verify-registration',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [
          { key: 'registrationNumber', label: 'registrationNumber' },
          { key: 'country', label: 'country (ISO-2, optional)' },
        ],
      },
      {
        id: 'saveTenantOnboardingBusinessDetails',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/business-details',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [
          { key: 'registrationNumber', label: 'registrationNumber' },
          { key: 'registeredBusinessName', label: 'registeredBusinessName' },
          { key: 'legalForm', label: 'legalForm (optional)' },
          { key: 'taxNumber', label: 'taxNumber (optional)' },
          { key: 'vatRegistered', label: 'vatRegistered (optional boolean)' },
          { key: 'vatNumber', label: 'vatNumber (optional)' },
          { key: 'registrationCountry', label: 'registrationCountry (ISO-2)' },
          { key: 'registeredAddress', label: 'registeredAddress' },
          { key: 'authorityName', label: 'authorityName (optional)' },
        ],
      },
      {
        id: 'saveTenantOnboardingAuthorizedPerson',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/authorized-person',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [
          { key: 'fullName', label: 'fullName' },
          { key: 'email', label: 'email' },
          { key: 'phoneNumber', label: 'phoneNumber' },
          { key: 'roleTitle', label: 'roleTitle (optional)' },
          { key: 'ownershipPercentage', label: 'ownershipPercentage (optional number)', type: 'number' },
        ],
      },
      {
        id: 'saveTenantOnboardingBankDetails',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/bank-details',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [
          { key: 'bankName', label: 'bankName' },
          { key: 'accountHolderName', label: 'accountHolderName' },
          { key: 'iban', label: 'iban' },
          { key: 'currency', label: 'currency (ISO-4217, optional)' },
        ],
      },
      {
        id: 'saveTenantOnboardingBillingAddress',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/billing-address',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [
          { key: 'useBusinessAddress', label: 'useBusinessAddress (optional boolean)' },
          { key: 'billingName', label: 'billingName' },
          { key: 'country', label: 'country (ISO-2)' },
          { key: 'city', label: 'city / region' },
          { key: 'postalCode', label: 'postalCode' },
          { key: 'addressLine1', label: 'addressLine1' },
          { key: 'addressLine2', label: 'addressLine2 (optional)' },
        ],
      },
      {
        id: 'getTenantOnboardingPlans',
        method: 'GET',
        path: '/v2/tenant/onboarding/:stateToken/plans',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
      },
      {
        id: 'saveTenantOnboardingPlanSelection',
        method: 'POST',
        path: '/v2/tenant/onboarding/:stateToken/plan-selection',
        pathParams: [{ key: 'stateToken', label: 'State token' }],
        bodyFields: [{ key: 'planKey', label: 'planKey' }],
      },
    ],
  },
  {
    id: 'systemTaxonomy',
    label: 'Public — System Taxonomy (currency / language / payment / service)',
    actions: [
      {
        id: 'listCurrencies',
        method: 'GET',
        path: '/system/currencies',
      },
      {
        id: 'listLanguages',
        method: 'GET',
        path: '/system/languages',
      },
      {
        id: 'listPaymentMethods',
        method: 'GET',
        path: '/system/payment-methods',
      },
      {
        id: 'listServiceTypes',
        method: 'GET',
        path: '/system/service-types',
      },
    ],
  },
  {
    id: 'adminSystemTaxonomy',
    label: 'Admin — System Taxonomy (admin auth required)',
    actions: [
      {
        id: 'adminCreateCurrency',
        method: 'POST',
        path: '/admin/system/currencies',
        bodyFields: [
          { key: 'code', label: 'ISO 4217 code (e.g. CHF)' },
          { key: 'displayName', label: 'Display name' },
          { key: 'symbol', label: 'Symbol' },
          { key: 'numericCode', label: 'Numeric code (optional)' },
          { key: 'decimalDigits', label: 'decimalDigits', type: 'number', defaultValue: '2' },
          { key: 'sortOrder', label: 'sortOrder', type: 'number' },
          { key: 'isActive', label: 'isActive (true/false)' },
        ],
      },
      {
        id: 'adminCreateLanguage',
        method: 'POST',
        path: '/admin/system/languages',
        bodyFields: [
          { key: 'code', label: 'BCP-47 tag (e.g. fr-FR)' },
          { key: 'displayName', label: 'Display name' },
          { key: 'nativeDisplayName', label: 'Native display name' },
          { key: 'sortOrder', label: 'sortOrder', type: 'number' },
          { key: 'isActive', label: 'isActive (true/false)' },
        ],
      },
      {
        id: 'adminCreatePaymentMethod',
        method: 'POST',
        path: '/admin/system/payment-methods',
        bodyFields: [
          { key: 'code', label: 'Code (snake_case, e.g. apple_pay)' },
          { key: 'displayName', label: 'Display name' },
          { key: 'iconKey', label: 'iconKey (optional)' },
          { key: 'sortOrder', label: 'sortOrder', type: 'number' },
          { key: 'isActive', label: 'isActive (true/false)' },
        ],
      },
      {
        id: 'adminCreateServiceType',
        method: 'POST',
        path: '/admin/system/service-types',
        bodyFields: [
          { key: 'code', label: 'Code (snake_case, e.g. curbside)' },
          { key: 'displayName', label: 'Display name' },
          { key: 'iconKey', label: 'iconKey (optional)' },
          { key: 'sortOrder', label: 'sortOrder', type: 'number' },
          { key: 'isActive', label: 'isActive (true/false)' },
        ],
      },
    ],
  },
  {
    id: 'tenantLocalization',
    label: 'Tenant — Store Localization (tenant auth required)',
    actions: [
      {
        id: 'updateStoreLocalization',
        method: 'PUT',
        path: '/tenant/stores/:storeId/settings/localization',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
        bodyFields: [
          { key: 'defaultCurrencyId', label: 'defaultCurrencyId (UUID from /system/currencies)' },
          { key: 'defaultLanguageId', label: 'defaultLanguageId (UUID from /system/languages)' },
        ],
      },
    ],
  },
  {
    id: 'publicDiscovery',
    label: 'Public — Discovery',
    actions: [
      {
        id: 'listStores',
        method: 'GET',
        path: '/public/stores',
      },
      {
        id: 'getDiscoveryMetadata',
        method: 'GET',
        path: '/public/stores/discovery-metadata',
      },
      {
        id: 'getStore',
        method: 'GET',
        path: '/public/stores/:storeId',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'createSessionAddress',
        method: 'POST',
        path: '/public/discovery/session-address',
        bodyFields: [
          { key: 'countryCode', label: 'countryCode (ISO-2, e.g. CH)' },
          { key: 'postalCode', label: 'postalCode' },
          { key: 'city', label: 'city (optional)' },
          { key: 'latitude', label: 'latitude (optional)', type: 'number' },
          { key: 'longitude', label: 'longitude (optional)', type: 'number' },
          { key: 'source', label: 'source (postal_code|autocomplete|geolocation|manual)' },
        ],
      },
      {
        id: 'getSessionAddress',
        method: 'GET',
        path: '/public/discovery/session-address/:token',
        pathParams: [{ key: 'token', label: 'Session token' }],
      },
      {
        id: 'discoverRestaurants',
        method: 'GET',
        path: '/public/discovery/restaurants',
        queryParams: [
          { key: 'sessionToken', label: 'sessionToken (or use postalCode)' },
          { key: 'postalCode', label: 'postalCode' },
          { key: 'countryCode', label: 'countryCode (ISO-2)' },
          { key: 'latitude', label: 'latitude' },
          { key: 'longitude', label: 'longitude' },
          { key: 'openNow', label: 'openNow (true|false)' },
          { key: 'freeDelivery', label: 'freeDelivery (true|false)' },
          { key: 'maxMinimumOrder', label: 'maxMinimumOrder' },
          { key: 'category', label: 'category (store/merchant type)' },
          { key: 'cuisines', label: 'cuisines (comma-separated slugs)' },
          {
            key: 'sort',
            label: 'sort (best_match|eta|delivery_fee|rating|distance|min_order)',
          },
          { key: 'limit', label: 'limit (1-100)' },
          { key: 'offset', label: 'offset (pagination)' },
        ],
      },
    ],
  },
  {
    id: 'customerAddresses',
    label: 'Customer — Delivery Addresses (auth required)',
    actions: [
      {
        id: 'listCustomerAddresses',
        method: 'GET',
        path: '/customer/addresses',
      },
      {
        id: 'getDefaultCustomerAddress',
        method: 'GET',
        path: '/customer/addresses/default',
      },
      {
        id: 'createCustomerAddress',
        method: 'POST',
        path: '/customer/addresses',
        bodyFields: [
          { key: 'label', label: 'label (optional, e.g. Home)' },
          { key: 'countryCode', label: 'countryCode (ISO-2)' },
          { key: 'city', label: 'city' },
          { key: 'postalCode', label: 'postalCode' },
          { key: 'street', label: 'street (optional)' },
          { key: 'houseNumber', label: 'houseNumber (optional)' },
          { key: 'isDefault', label: 'isDefault (true|false)' },
        ],
      },
      {
        id: 'setDefaultCustomerAddress',
        method: 'POST',
        path: '/customer/addresses/:addressId/default',
        pathParams: [{ key: 'addressId', label: 'Address ID' }],
      },
      {
        id: 'deleteCustomerAddress',
        method: 'DELETE',
        path: '/customer/addresses/:addressId',
        pathParams: [{ key: 'addressId', label: 'Address ID' }],
      },
    ],
  },
  {
    id: 'publicMenu',
    label: 'Public — Menu',
    actions: [
      {
        id: 'getMenuCategories',
        method: 'GET',
        path: '/public/stores/:storeId/menu/categories',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'getMenuItems',
        method: 'GET',
        path: '/public/stores/:storeId/menu/items',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'getMenuItem',
        method: 'GET',
        path: '/public/stores/:storeId/menu/items/:itemId',
        pathParams: [
          { key: 'storeId', label: 'Store ID' },
          { key: 'itemId', label: 'Item ID' },
        ],
      },
      {
        id: 'getPopularMenuItems',
        method: 'GET',
        path: '/public/stores/:storeId/menu/popular',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
    ],
  },
  {
    id: 'publicCuisines',
    label: 'Public — Cuisines',
    actions: [
      {
        id: 'listCuisines',
        method: 'GET',
        path: '/public/cuisines',
      },
      {
        id: 'getStoreCuisines',
        method: 'GET',
        path: '/public/stores/:storeId/cuisines',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
    ],
  },
  {
    id: 'publicReviews',
    label: 'Public — Reviews',
    actions: [
      {
        id: 'listStoreReviews',
        method: 'GET',
        path: '/public/stores/:storeId/reviews',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'getStoreReviewSummary',
        method: 'GET',
        path: '/public/stores/:storeId/reviews/summary',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
    ],
  },
  {
    id: 'customerCart',
    label: 'Customer — Cart (auth required)',
    actions: [
      {
        id: 'getCart',
        method: 'GET',
        path: '/cart',
      },
      {
        id: 'addCartItem',
        method: 'POST',
        path: '/cart/items',
        bodyFields: [
          { key: 'storeId', label: 'Store ID' },
          { key: 'menuItemId', label: 'Menu Item ID' },
          { key: 'quantity', label: 'Quantity', type: 'number', defaultValue: '1' },
        ],
      },
      {
        id: 'updateCartItem',
        method: 'PATCH',
        path: '/cart/items/:cartItemId',
        pathParams: [{ key: 'cartItemId', label: 'Cart Item ID' }],
        bodyFields: [
          { key: 'quantity', label: 'Quantity', type: 'number', defaultValue: '1' },
        ],
      },
      {
        id: 'removeCartItem',
        method: 'DELETE',
        path: '/cart/items/:cartItemId',
        pathParams: [{ key: 'cartItemId', label: 'Cart Item ID' }],
      },
      {
        id: 'clearCart',
        method: 'DELETE',
        path: '/cart',
      },
      {
        id: 'updateCartPreferences',
        method: 'PATCH',
        path: '/cart/preferences',
        bodyFields: [
          { key: 'serviceTypeId', label: 'serviceTypeId (UUID from /system/service-types)' },
          { key: 'paymentMethodId', label: 'paymentMethodId (UUID from /system/payment-methods)' },
          { key: 'deliveryDistanceKm', label: 'deliveryDistanceKm', type: 'number' },
        ],
      },
    ],
  },
  {
    id: 'publicCommerce',
    label: 'Public — Commerce Settings',
    actions: [
      {
        id: 'getStoreCommerceSettings',
        method: 'GET',
        path: '/public/stores/:storeId/commerce-settings',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
    ],
  },
  {
    id: 'customerReviews',
    label: 'Customer — Reviews (auth required)',
    actions: [
      {
        id: 'listEligibleReviewOrders',
        method: 'GET',
        path: '/reviews/eligible-orders',
      },
      {
        id: 'listMyReviews',
        method: 'GET',
        path: '/reviews/mine',
      },
      {
        id: 'createReview',
        method: 'POST',
        path: '/reviews',
        bodyFields: [
          { key: 'orderId', label: 'Order ID' },
          { key: 'rating', label: 'Rating (1-5)', type: 'number' },
          { key: 'title', label: 'Title (optional)' },
          { key: 'body', label: 'Body (optional)' },
        ],
      },
      {
        id: 'deleteOwnReview',
        method: 'DELETE',
        path: '/reviews/:reviewId',
        pathParams: [{ key: 'reviewId', label: 'Review ID' }],
      },
    ],
  },
  {
    id: 'tenantCuisines',
    label: 'Tenant — Cuisines (tenant auth required)',
    actions: [
      {
        id: 'getStoreCuisinesForTenant',
        method: 'GET',
        path: '/tenant/stores/:storeId/cuisines',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'replaceStoreCuisines',
        method: 'PUT',
        path: '/tenant/stores/:storeId/cuisines',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
        bodyFields: [
          { key: 'cuisineIds', label: 'cuisineIds (JSON array)' },
          { key: 'primaryCuisineId', label: 'primaryCuisineId (optional)' },
        ],
      },
    ],
  },
  {
    id: 'tenantReviews',
    label: 'Tenant — Reviews (tenant auth required)',
    actions: [
      {
        id: 'listTenantStoreReviews',
        method: 'GET',
        path: '/tenant/stores/:storeId/reviews',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'replyTenantStoreReview',
        method: 'POST',
        path: '/tenant/stores/:storeId/reviews/:reviewId/reply',
        pathParams: [
          { key: 'storeId', label: 'Store ID' },
          { key: 'reviewId', label: 'Review ID' },
        ],
        bodyFields: [{ key: 'body', label: 'Reply body' }],
      },
      {
        id: 'flagTenantStoreReview',
        method: 'PATCH',
        path: '/tenant/stores/:storeId/reviews/:reviewId/flag',
        pathParams: [
          { key: 'storeId', label: 'Store ID' },
          { key: 'reviewId', label: 'Review ID' },
        ],
        bodyFields: [{ key: 'reason', label: 'Flag reason (optional)' }],
      },
    ],
  },
  {
    id: 'tenantMenuOrdering',
    label: 'Tenant — Menu Ordering (tenant auth required)',
    actions: [
      {
        id: 'reorderMenuCategories',
        method: 'PUT',
        path: '/stores/:storeId/menu/categories/reorder',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
        bodyFields: [
          { key: 'orderedCategoryIds', label: 'orderedCategoryIds (JSON array)' },
        ],
      },
    ],
  },
  {
    id: 'tenantCommerce',
    label: 'Tenant — Commerce (tenant auth required)',
    actions: [
      {
        id: 'listTenantStorePaymentMethods',
        method: 'GET',
        path: '/tenant/stores/:storeId/payment-methods',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'replaceTenantStorePaymentMethods',
        method: 'PUT',
        path: '/tenant/stores/:storeId/payment-methods',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
        bodyFields: [
          {
            key: 'paymentMethods',
            label:
              'paymentMethods (JSON array of {paymentMethodId, isActive, sortOrder, customLabel})',
          },
        ],
      },
      {
        id: 'listTenantStoreServiceTypes',
        method: 'GET',
        path: '/tenant/stores/:storeId/service-types',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'replaceTenantStoreServiceTypes',
        method: 'PUT',
        path: '/tenant/stores/:storeId/service-types',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
        bodyFields: [
          {
            key: 'serviceTypes',
            label:
              'serviceTypes (JSON array of {serviceTypeId, isActive, sortOrder, customLabel})',
          },
        ],
      },
      {
        id: 'getOrderingPolicy',
        method: 'GET',
        path: '/tenant/stores/:storeId/ordering-policy',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'updateOrderingPolicy',
        method: 'PUT',
        path: '/tenant/stores/:storeId/ordering-policy',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
        bodyFields: [
          { key: 'minOrderAmount', label: 'minOrderAmount', type: 'number' },
          { key: 'acceptsDelivery', label: 'acceptsDelivery (true/false)' },
          { key: 'acceptsPickup', label: 'acceptsPickup (true/false)' },
          { key: 'currencyCode', label: 'currencyCode (ISO-4217)' },
        ],
      },
      {
        id: 'listDeliveryFeeTiers',
        method: 'GET',
        path: '/tenant/stores/:storeId/delivery-fee-tiers',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'replaceDeliveryFeeTiers',
        method: 'PUT',
        path: '/tenant/stores/:storeId/delivery-fee-tiers',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
        bodyFields: [{ key: 'tiers', label: 'tiers (JSON array)' }],
      },
      {
        id: 'getCommerceSettings',
        method: 'GET',
        path: '/tenant/stores/:storeId/commerce-settings',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
    ],
  },
  {
    id: 'customerOrders',
    label: 'Customer — Orders (auth required)',
    actions: [
      {
        id: 'checkoutReadiness',
        method: 'POST',
        path: '/orders/checkout-readiness',
      },
      {
        id: 'createOrder',
        method: 'POST',
        path: '/orders',
        bodyFields: [
          { key: 'serviceTypeId', label: 'serviceTypeId (UUID from /system/service-types)' },
          { key: 'paymentMethodId', label: 'paymentMethodId (UUID from /system/payment-methods)' },
          { key: 'deliveryDistanceKm', label: 'deliveryDistanceKm', type: 'number' },
        ],
      },
      {
        id: 'listOrders',
        method: 'GET',
        path: '/orders',
      },
      {
        id: 'getOrder',
        method: 'GET',
        path: '/orders/:orderId',
        pathParams: [{ key: 'orderId', label: 'Order ID' }],
      },
      {
        id: 'createPaymentSession',
        method: 'POST',
        path: '/orders/:orderId/payment/session',
        pathParams: [{ key: 'orderId', label: 'Order ID' }],
      },
    ],
  },
  {
    id: 'tenantOrders',
    label: 'Tenant — Orders (tenant auth required)',
    actions: [
      {
        id: 'listTenantOrders',
        method: 'GET',
        path: '/tenant/orders',
      },
      {
        id: 'getTenantOrder',
        method: 'GET',
        path: '/tenant/orders/:orderId',
        pathParams: [{ key: 'orderId', label: 'Order ID' }],
      },
      {
        id: 'updateTenantOrderStatus',
        method: 'PATCH',
        path: '/tenant/orders/:orderId/status',
        pathParams: [{ key: 'orderId', label: 'Order ID' }],
        bodyFields: [
          { key: 'status', label: 'Status (e.g. confirmed)' },
          { key: 'reason', label: 'Reason (required for rejected/cancelled)' },
        ],
      },
    ],
  },
  {
    id: 'publicLegal',
    label: 'Public — Legal Documents',
    actions: [
      {
        id: 'listLegalDocumentTypes',
        method: 'GET',
        path: '/public/legal/document-types',
      },
      {
        id: 'listActiveLegalDocuments',
        method: 'GET',
        path: '/public/legal/documents/active',
        queryParams: [
          { key: 'audience', label: 'audience (customer|tenant|all)' },
          { key: 'locale', label: 'locale (default tr)' },
        ],
      },
      {
        id: 'getLatestLegalDocumentByCode',
        method: 'GET',
        path: '/public/legal/documents/:code/latest',
        pathParams: [{ key: 'code', label: 'Document code' }],
        queryParams: [{ key: 'locale', label: 'locale (default tr)' }],
      },
      {
        id: 'recordAnonymousConsent',
        method: 'POST',
        path: '/public/legal/consents/anonymous',
        bodyFields: [
          { key: 'channel', label: 'channel (web|ios|android|...)' },
          { key: 'anonymousIdentifier', label: 'Anonymous identifier (cookie hash)' },
          { key: 'entries', label: 'entries (JSON array of {documentVersionId, action})' },
        ],
      },
    ],
  },
  {
    id: 'adminLegal',
    label: 'Admin — Legal Documents (admin auth required)',
    actions: [
      {
        id: 'adminListDocumentTypes',
        method: 'GET',
        path: '/admin/legal/document-types',
        queryParams: [{ key: 'includeInactive', label: 'includeInactive (true|false)' }],
      },
      {
        id: 'adminListDocuments',
        method: 'GET',
        path: '/admin/legal/documents',
        queryParams: [
          { key: 'audience', label: 'audience filter' },
          { key: 'includeInactive', label: 'includeInactive (true|false)' },
        ],
      },
      {
        id: 'adminCreateDocument',
        method: 'POST',
        path: '/admin/legal/documents',
        bodyFields: [
          { key: 'typeId', label: 'LegalDocumentType.id' },
          { key: 'code', label: 'Unique document code' },
          { key: 'audience', label: 'audience (customer|tenant|all)' },
          { key: 'isRequired', label: 'isRequired (true|false)' },
          { key: 'isActive', label: 'isActive (true|false)' },
        ],
      },
      {
        id: 'adminListDocumentVersions',
        method: 'GET',
        path: '/admin/legal/documents/:documentId/versions',
        pathParams: [{ key: 'documentId', label: 'Document ID' }],
        queryParams: [{ key: 'locale', label: 'locale' }],
      },
      {
        id: 'adminPublishDocumentVersion',
        method: 'POST',
        path: '/admin/legal/documents/:documentId/versions',
        pathParams: [{ key: 'documentId', label: 'Document ID' }],
        bodyFields: [
          { key: 'versionLabel', label: 'Version label (e.g. 2026-05-14-v1)' },
          { key: 'locale', label: 'locale (e.g. tr)' },
          { key: 'title', label: 'title' },
          { key: 'body', label: 'body (markdown by default)' },
          { key: 'bodyFormat', label: 'bodyFormat (markdown|html|plain_text)' },
          { key: 'effectiveFrom', label: 'effectiveFrom (ISO8601, optional)' },
          { key: 'supersedeCurrent', label: 'supersedeCurrent (true|false)' },
        ],
      },
      {
        id: 'adminSupersedeDocumentVersion',
        method: 'POST',
        path: '/admin/legal/versions/:versionId/supersede',
        pathParams: [{ key: 'versionId', label: 'Version ID' }],
      },
    ],
  },
  {
    id: 'customerLegal',
    label: 'Customer — Legal & Consent (auth required)',
    actions: [
      {
        id: 'recordCustomerConsent',
        method: 'POST',
        path: '/me/legal/consents',
        bodyFields: [
          { key: 'channel', label: 'channel (web|ios|android|...)' },
          { key: 'entries', label: 'entries (JSON array)' },
        ],
      },
      {
        id: 'listCustomerConsents',
        method: 'GET',
        path: '/me/legal/consents',
      },
      {
        id: 'customerReConsentRequired',
        method: 'GET',
        path: '/me/legal/re-consent-required',
      },
      {
        id: 'getCustomerMarketingConsents',
        method: 'GET',
        path: '/me/legal/marketing-consents',
      },
      {
        id: 'upsertCustomerMarketingConsent',
        method: 'POST',
        path: '/me/legal/marketing-consents',
        bodyFields: [{ key: 'entries', label: 'entries (JSON array)' }],
      },
      {
        id: 'createOrderLegalAcceptance',
        method: 'POST',
        path: '/checkout/legal-acceptance',
        bodyFields: [
          { key: 'orderId', label: 'Order ID' },
          {
            key: 'distanceSalesContractVersionId',
            label: 'Distance sales contract version ID',
          },
          {
            key: 'preInformationFormVersionId',
            label: 'Pre-information form version ID',
          },
        ],
      },
    ],
  },
  {
    id: 'tenantLegal',
    label: 'Tenant — Legal & Consent (tenant auth required)',
    actions: [
      {
        id: 'recordTenantConsent',
        method: 'POST',
        path: '/tenant/legal/consents',
        bodyFields: [
          { key: 'channel', label: 'channel (tenant-portal|...)' },
          { key: 'entries', label: 'entries (JSON array)' },
        ],
      },
      {
        id: 'listTenantConsents',
        method: 'GET',
        path: '/tenant/legal/consents',
      },
      {
        id: 'tenantReConsentRequired',
        method: 'GET',
        path: '/tenant/legal/re-consent-required',
      },
      {
        id: 'getTenantMarketingConsents',
        method: 'GET',
        path: '/tenant/legal/marketing-consents',
      },
      {
        id: 'upsertTenantMarketingConsent',
        method: 'POST',
        path: '/tenant/legal/marketing-consents',
        bodyFields: [{ key: 'entries', label: 'entries (JSON array)' }],
      },
      {
        id: 'listStoreTermsAddendums',
        method: 'GET',
        path: '/tenant/stores/:storeId/terms-addendums',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
      },
      {
        id: 'createStoreTermsAddendum',
        method: 'POST',
        path: '/tenant/stores/:storeId/terms-addendums',
        pathParams: [{ key: 'storeId', label: 'Store ID' }],
        bodyFields: [
          { key: 'parentDocumentVersionId', label: 'Parent version ID' },
          { key: 'title', label: 'title' },
          { key: 'body', label: 'body' },
          { key: 'locale', label: 'locale (default tr)' },
          { key: 'isActive', label: 'isActive (true|false)' },
        ],
      },
      {
        id: 'deactivateStoreTermsAddendum',
        method: 'DELETE',
        path: '/tenant/stores/:storeId/terms-addendums/:addendumId',
        pathParams: [
          { key: 'storeId', label: 'Store ID' },
          { key: 'addendumId', label: 'Addendum ID' },
        ],
      },
    ],
  },
];
