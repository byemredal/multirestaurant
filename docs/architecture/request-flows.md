# Request Flows

End-to-end request/response chains for the six load-bearing surfaces of the
Lieferzonen platform. Each flow is written so a reader can pick up cold and
follow a real request from a user gesture all the way to a DB row and back
to a rendered UI.

Conventions:

- `→` reads as "calls into".
- HTTP paths are written exactly as mounted (so the `/v2` segment on
  onboarding is intentional — see [Onboarding doc](./onboarding-v2-flow.md)).
- All HTTP paths are prefixed with `/api/v1` by `apps/api/src/main.ts`'s
  global prefix unless otherwise noted.
- File paths use the canonical post-cleanup names
  (e.g. `apps/api/src/modules/tenant-onboarding/`, not `v2-...`).

---

## 1. Customer discovery flow

> Goal: given a postal code (and optional address), list the restaurants
> that can deliver to that location with availability + ranking signals.

```
URL                                              Component / Hook
/                                                apps/web/src/app/page.tsx
                                                 → HomeExperience
/[mode]/food/[region]                            apps/web/src/app/[mode]/food/[region]/page.tsx
                                                 → HomeExperience (initialMode, initialRegionSlug)

Discovery context owns the location + filters state:
  apps/web/src/lib/discovery/discovery-context.tsx
    ├─ apps/web/src/lib/discovery/discovery-storage.ts   (localStorage)
    └─ apps/web/src/lib/discovery/use-discovery.ts        (fetch hook)

API client:
  apps/web/src/lib/discovery/discovery-api.ts
    ├─ POST /api/v1/public/discovery/session-address
    ├─ GET  /api/v1/public/discovery/session-address/:token
    └─ GET  /api/v1/public/discovery/restaurants?postalCode=…&serviceType=…

Backend:
  apps/api/src/modules/discovery/discovery.controller.ts   @Controller('public/discovery')
    ├─ POST 'session-address'   → DiscoveryService.createSessionAddress
    ├─ GET  'session-address/:token' → DiscoveryService.getSessionAddress
    └─ GET  'restaurants'       → DiscoveryService.listRestaurants

  apps/api/src/modules/discovery/discovery.service.ts
    ├─ AddressNormalizationService  (CH-aware postal-code normalization)
    ├─ CoverageService              (postal / radius / service-area match)
    └─ RankingService               (distance + eta + rating + popularity score)

  Tables read:
    Store, StoreServiceArea, StoreCoveragePostalCode, StoreReviewAggregate,
    StoreCuisineAssignment, Cuisine
    (Phase-1 join queries documented in apps/api/docs/delivery-discovery-engine.md)

Response shape (simplified):
  { restaurants: Array<{
      store: { id, name, slug, imageUrl, cuisines, … },
      coverage: { strategy, distanceKm, fee, minOrder, … },
      availability: { available, openNow, reasons[] },
      ranking: { score, position, breakdown }
    }>, facets, totalCount, contextToken }

Frontend render:
  RestaurantList → RestaurantCard
  (StoreMenuPage opens on /stores/[storeId] when a card is clicked.)
```

Numeric coercion of NUMERIC columns runs through the shared helper at
`apps/api/src/common/utility/numeric.ts` (`toFiniteNumber`) — both
coverage.service and discovery.service use it.

---

## 2. Customer checkout / order flow

> Goal: customer fills cart, validates readiness, then crosses into a
> payment session.

```
Cart state (client-only until checkout):
  apps/web/src/lib/cart/cart-context.tsx           (in-memory + storage cache)
    └─ apps/web/src/components/cart/CartPanel.tsx
    └─ apps/web/src/components/store/StoreMenuPage.tsx (adds items)

Cart persistence (server cart, optional / WIP):
  apps/web/src/lib/api/api-client.ts
    ├─ POST   /api/v1/cart/items
    ├─ PATCH  /api/v1/cart/items/:cartItemId
    ├─ DELETE /api/v1/cart/items/:cartItemId
    └─ PATCH  /api/v1/cart/preferences
  → apps/api/src/modules/cart/cart.controller.ts  @Controller('cart')
  → apps/api/src/modules/cart/cart.service.ts
  Tables: Cart, CartItem, CartItemOptionSelection

Checkout page:
  apps/web/src/app/checkout/page.tsx
    ├─ /api/v1/orders/checkout-readiness        (POST — quote + blockingIssues)
    ├─ /api/v1/checkout/legal-acceptance        (POST — record ToS consent)
    └─ /api/v1/orders/:orderId/payment/session  (POST — Stripe Checkout URL)

Order creation (server reconciles cart at checkout):
  apps/api/src/modules/orders/orders.controller.ts  @Controller('orders')
    ├─ POST 'checkout-readiness'  → OrdersService.checkCheckoutReadiness
    └─ POST 'validate'            → OrdersService.validateCart

  OrdersService (apps/api/src/modules/orders/orders.service.ts):
    ├─ StoresService               (store status / coverage)
    ├─ StoreSettingsStore          (orderingPolicy / paymentMethods / deliveryFee)
    ├─ CustomerLoyaltyStore        (loyalty discounts)
    ├─ LegalConsentService         (active ToS versions snapshot)
    ├─ SystemTaxonomyService       (currency)
    └─ DatabaseService             (Order, OrderItem, OrderItemOptionSelection rows)

  Order persistence:
    INSERT Order              status='pending_payment'
    INSERT OrderItem[]
    INSERT OrderItemOptionSelection[]
    INSERT OrderStatusEvent   actor='customer'

Status timeline (StatusEvent table):
  pending_payment → payment_processing → pending_confirmation → confirmed → preparing → ready → completed
                                       ↘ payment_failed
                                                                   ↘ rejected / cancelled

Frontend render:
  orders/[orderId]/page.tsx polls /api/v1/orders/:orderId for progress badge.
```

---

## 3. Stripe payment flow

> Goal: take a `pending_payment` order to either `pending_confirmation`
> (paid) or `payment_failed` (declined) via Stripe Hosted Checkout +
> webhook reconciliation.

```
Customer triggers from checkout:
  apps/web/src/app/checkout/page.tsx
  → apps/web/src/lib/payments/payment-client.ts
       POST /api/v1/orders/:orderId/payment/session

Backend (intent creation):
  apps/api/src/modules/payments/payments.controller.ts  @Controller('orders')
    POST ':orderId/payment/session' → PaymentsService.createCheckoutSession
  PaymentsService (apps/api/src/modules/payments/payments.service.ts)
    ├─ OrdersService.getCustomerOrder
    ├─ StripeService.createCheckoutSession  (Stripe SDK call)
    └─ PaymentsStore.recordIntent           (INSERT Payment row, status='processing')
  Returns { sessionUrl }

Customer redirected to Stripe Hosted Checkout (off-platform).
Stripe sends webhook events back:
  apps/api/src/modules/payments/stripe-webhook.controller.ts  @Controller('payments')
    POST 'webhook'  → PaymentsService.handleStripeWebhook
  PaymentsService.handleStripeWebhook
    ├─ StripeService.verifyWebhookSignature
    ├─ PaymentsStore.recordOutcome  (UPDATE Payment row)
    └─ OrdersService.applyPaymentOutcome(orderId, outcome)
         outcome ∈ { 'processing' | 'succeeded' | 'failed' | 'expired' }
         → updates Order.status + writes OrderStatusEvent
            (actor = SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000000')

  Migrations: 0019_stripe_payments.sql created the Payment table +
              order status enum entries (pending_payment, payment_processing,
              payment_failed). 0020_order_fulfillment_snapshot.sql added the
              snapshot column used for receipt rendering.

Failure paths:
  - Signature mismatch  → 400 (Stripe retries)
  - Order not found     → 404 (Stripe retries up to its limit)
  - Pending payment expiry sweeper (private OrdersService method) flips
    `pending_payment` orders older than 30 minutes to `payment_failed`.
```

---

## 4. Tenant onboarding v2 flow

> Goal: a stateless, state-token-bearing journey from landing to admin
> approval. Full sequence diagrams live in
> [onboarding-v2-flow.md](./onboarding-v2-flow.md); this section gives the
> request chain for a single step save so the picture stays consistent
> across docs.

```
Tenant lands:
  apps/tenant/src/app/page.tsx
  → apps/tenant/src/lib/tenant-onboarding-client.ts → startTenantOnboarding
       POST /api/v1/v2/tenant/onboarding/start

Step page:
  apps/tenant/src/app/onboarding/[stateToken]/[stepSlug]/page.tsx
  → TenantOnboardingWorkspace → TenantOnboardingStepPanel
  → useTenantOnboardingWorkspace hook
       PATCH /api/v1/v2/tenant/onboarding/:stateToken/steps/:stepKey
       POST  /api/v1/v2/tenant/onboarding/:stateToken/steps/:stepKey/complete

Backend chain:
  apps/api/src/modules/tenant-onboarding/tenant-onboarding.controller.ts
    @Controller('v2/tenant/onboarding')
  → apps/api/src/modules/tenant-onboarding/tenant-onboarding.service.ts
    ├─ CryptoUtil.decryptStateToken             (common/utility/crypto-util.ts)
    ├─ class-validator DTO validation
    └─ TenantOnboardingStore.upsert*Detail()
  → tables: TenantOnboardingApplication, TenantBusinessDetail,
            TenantLegalDetail, TenantOwnerContact, TenantOperationsProfile,
            TenantOnboardingStepProgress

Submission:
  POST /api/v1/v2/tenant/onboarding/:stateToken/submit
  → TenantOnboardingService.submitForReviewByStateToken
       → submit() (first-time)  OR  resubmit() (after revision)
       → INSERT TenantApplicationReview, AuditLog
       → status: draft → submitted (or revision_required → submitted)

Admin review (same store, see flow 6):
  POST /api/v1/admin/tenant-applications/:id/approve  → approveApplication
  POST /api/v1/admin/tenant-applications/:id/request-revision → requestRevision
  POST /api/v1/admin/tenant-applications/:id/reject → rejectApplication
  POST /api/v1/admin/tenants/:id/activate  → activateTenant
  POST /api/v1/admin/tenants/:id/suspend   → suspendTenant
  POST /api/v1/admin/tenants/:id/reopen-review → reopenReview

Waiting:
  apps/tenant/src/app/onboarding/[stateToken]/waiting/page.tsx polls
  GET /api/v1/v2/tenant/onboarding/:stateToken/workspace
  and renders status copy (submitted / under_review / rejected / suspended).

Approval handoff:
  approveApplication + activateTenant mirror TenantAccount.onboardingStatus
  to 'approved' / 'active'. getTenantOnboardingResumeUrl (frontend) sees
  approved/active and routes the tenant to /dashboard.
  TenantSetPasswordCard prompts for a password
    → POST /api/v1/tenants/me/password   (TenantsController)
```

---

## 5. Tenant dashboard / order operations flow

> Goal: an authenticated tenant sees realtime incoming orders, walks them
> through confirmation → preparing → ready → completed.

```
Auth bootstrap:
  apps/tenant/src/app/login/page.tsx
  → apps/tenant/src/lib/tenant-client.ts → loginTenant
       POST /api/v1/tenants/login   (TenantsController)
  apps/tenant/src/lib/auth/tenant-auth-context.tsx stores the bearer +
  CSRF token, calls bootstrapTenantSession → GET /api/v1/tenants/me.

Dashboard:
  apps/tenant/src/app/dashboard/page.tsx
  → TenantOperationsDashboard
      ├─ TenantDashboardShell  (nav, store switcher, setup checklist)
      ├─ StoreStatusCard        (acceptingOrders toggle → PATCH /tenant/stores/:id)
      ├─ TodayMetrics           (GET /tenant/orders/metrics)
      ├─ LiveOrdersStrip        (subscribes to tenant-order-stream-context)
      └─ RecentActivityFeed     (GET /tenant/orders?scope=recent)

Realtime stream:
  apps/tenant/src/lib/realtime/tenant-order-stream-context.tsx
  → SSE GET /api/v1/tenants/me/status/stream?access_token=…
  → apps/api/src/modules/tenants/tenants.controller.ts → @Sse('me/status/stream')
  → TenantStatusEventsService (emits onboardingStatus + new-order beacons)

Orders board:
  apps/tenant/src/app/orders/page.tsx
  → listTenantOrders            GET /api/v1/tenant/orders?scope=…
  → updateTenantOrderStatus     PATCH /api/v1/tenant/orders/:orderId/status
  → apps/api/src/modules/orders/tenant-orders.controller.ts
       @Controller('tenant/orders')
       ├─ GET ':orderId'            → OrdersService.getTenantOrder
       └─ PATCH ':orderId/status'   → OrdersService.updateTenantOrderStatus
            (validates against tenantTransitionMap inside OrdersService)

Order detail:
  apps/tenant/src/app/orders/[orderId]/page.tsx
  → GET /api/v1/tenant/orders/:orderId

Test order helper (operational, not customer-facing):
  components/tenant/tools/TestOrderLauncher.tsx
  → POST /api/v1/tenant/test-orders
  → tenant-test-orders.controller.ts  (rate-limited 10/min)
  → OrdersService.createTestOrder (writes a real Order row owned by
    a lazy "test customer" so SSE / metrics / status flow can be
    exercised end-to-end).

Studio (menu + categories + option groups):
  apps/tenant/src/app/dashboard/studio/page.tsx → TenantStudio
  → uses many functions from apps/tenant/src/lib/tenant-client.ts
    against /api/v1/stores/:id and /api/v1/stores/:id/menu/...
  → apps/api/src/modules/menu/menu.controller.ts
     @Controller('stores/:storeId/menu')
       (admin) + @Controller('public/stores/:storeId/menu') (read-only)
```

---

## 6. Admin orders / stores / applications flow

> Goal: oversight of tenants, applications, documents, orders, stores,
> store-settings — all gated by `AdminRoleGuard` + an admin bearer token.

```
Admin sign-in:
  apps/admin/src/app/login/page.tsx
  → apps/admin/src/lib/admin-api/admin-auth-client.ts
       POST /api/v1/admin/auth/login → AdminAuthController.login
  → AdminAuthService.authenticate
  Session stored via apps/admin/src/lib/storage/admin-session.ts

Tenant applications board:
  apps/admin/src/app/tenant-applications/page.tsx
  → TenantApplicationsList
      GET /api/v1/admin/tenant-applications              (listApplications)
      GET /api/v1/admin/tenant-applications/:id          (getApplication)
      GET /api/v1/admin/tenant-applications/:id/timeline (audit log slice)
  → apps/api/src/modules/admin-tenant-reviews/admin-tenant-applications.controller.ts
  → AdminTenantReviewsService
       → TenantOnboardingService (modules/tenant-onboarding/tenant-onboarding.service.ts)
       → AdminAuditLogService

Application review actions:
  POST /admin/tenant-applications/:id/approve          → approveApplication
  POST /admin/tenant-applications/:id/request-revision → requestRevision
  POST /admin/tenant-applications/:id/reject           → rejectApplication
  (all transition the same TenantOnboardingApplication row used by flow 4)

Document review:
  apps/admin/src/app/documents/page.tsx → DocumentsQueue
  → GET  /api/v1/admin/tenant-documents
  → POST /api/v1/admin/tenant-documents/:id/approve            → reviewDocument('approve')
  → POST /api/v1/admin/tenant-documents/:id/reject             → reviewDocument('reject')
  → POST /api/v1/admin/tenant-documents/:id/request-revision   → reviewDocument('request_revision')

Tenant activation:
  apps/admin/src/app/tenants/page.tsx + tenants/[id]/page.tsx
  → GET  /api/v1/admin/tenants               (listTenants)
  → GET  /api/v1/admin/tenants/:id/overview  (getTenantBusinessOverview — stores, settings, sliders, menu, legal)
  → POST /api/v1/admin/tenants/:id/activate
  → POST /api/v1/admin/tenants/:id/suspend
  → POST /api/v1/admin/tenants/:id/reopen-review

Admin stores oversight:
  apps/admin/src/app/stores/page.tsx
  → GET  /api/v1/admin/stores               (admin-stores.controller.ts)
  → AdminStoresController → StoresService

Admin orders oversight:
  apps/admin/src/app/orders/page.tsx
  → GET /api/v1/admin/orders
  → admin-orders.controller.ts → OrdersService.listAdminOrders

Legal documents workspace:
  apps/admin/src/app/legal/page.tsx → LegalDocumentsWorkspace
  → admin-legal-documents.controller.ts → LegalConsentService

System taxonomy CRUD (currency / language / payment / service type):
  apps/admin/src/app/system/* pages
  → GET/POST /api/v1/admin/system/...
  → SystemTaxonomyController + AdminRoleGuard
```

---

## Shared helpers reachable from any flow

| Helper                                           | Module                                                  | Notes                                          |
| ------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------- |
| `CryptoUtil.encryptStateToken/decryptStateToken` | `apps/api/src/common/utility/crypto-util.ts`            | Powers stateless onboarding URLs.              |
| `CryptoUtil.randomTokenSalt`                     | same                                                    | Rotated when an onboarding app reaches a terminal state. |
| `CryptoUtil.isTerminalStatus`                    | same                                                    | Shared between service + store.                |
| `toFiniteNumber`                                 | `apps/api/src/common/utility/numeric.ts`                | NUMERIC column coercion (was duplicated).      |
| `AccessTokenGuard` (APP_GUARD)                   | `apps/api/src/common/security/guards/access-token.guard.ts` | Single auth ingress; `@Public()` to opt out. |
| `RateLimitGuard` + `@RateLimit({...})`           | `apps/api/src/common/security/...`                      | Per-route throttling (e.g. test-order, onboarding-start). |
| `AdminRoleGuard` + `@AdminRoles(...)`            | `apps/api/src/common/security/...`                      | Admin-only routes.                             |
| `SharedFileStorageService`                       | `apps/api/src/modules/shared-file-storage/`             | Tenant document + slider asset uploads.        |
| `LegalConsentService`                            | `apps/api/src/modules/legal-consent/`                   | Active document versions snapshot for orders + onboarding. |
| `SystemTaxonomyService`                          | `apps/api/src/modules/system-taxonomy/`                 | Currency / language / payment / service type lookups. |

---

## Cross-cutting concerns

- **Auth ingress**: every controller is behind `AccessTokenGuard`
  (registered as `APP_GUARD` in `app.module.ts`). Routes opt out with
  `@Public()` (e.g. the onboarding `start`, `phone-verification`,
  state-token endpoints, payment webhooks, public discovery).
- **Audit logging**: every status-changing admin or tenant action calls
  `AdminAuditLogService.log({ actorType, actorId, action, entityType,
  entityId, metadata })` — feeds the application timeline + admin
  reports.
- **Pagination**: not yet centralized; each list controller accepts
  its own DTO. A shared paginate helper is a future cleanup candidate.
- **Error contract**: `HttpExceptionFilter`
  (`apps/api/src/common/filters/http-exception.filter.ts`) normalizes
  NestJS exceptions into `{ message, errors[], missingFields[] }` and
  the tenant + web frontends know how to surface those fields.

---

## How to add a new flow doc

1. Pick the entry component or page on the frontend.
2. Walk the chain: component → hook/client → HTTP path → controller →
   service → store/DB. Reference exact file paths.
3. List the tables touched (read vs. write) and the response shape.
4. Note any rate-limits, role guards, or cross-flow side effects.
5. Add the new section here so it stays adjacent to the others.
