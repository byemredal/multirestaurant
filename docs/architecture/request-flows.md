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
> approval. The state-token flow is **canonical**; the session/`me` variants
> still exist for already-authenticated tenants but are marked
> `@deprecated` in the frontend client. See
> [onboarding-v2-flow.md](./onboarding-v2-flow.md) for the architectural
> overview, [onboarding-state-model.md](./onboarding-state-model.md) for
> the FE↔BE responsibility split, and
> [debugging-onboarding.md](./debugging-onboarding.md) for the runbook.

The six sub-flows below cover every load-bearing request a tenant makes
during onboarding. Each one ends with a real example payload so the
shape is unambiguous when wiring or debugging.

---

### 4.1. Landing form submit → `start`

Public endpoint. No prior session, no state token yet. Either creates a
new `TenantAccount` + `TenantOnboardingApplication` or resumes an
existing one if the email already exists in a resumable state
(`passwordHash === ''` AND status ∈ {`draft`, `revision_required`}).

```
UI                       apps/tenant/src/app/page.tsx
                         └─ <TenantSignupLanding> form

Client helper            apps/tenant/src/lib/tenant-onboarding-client.ts
                         └─ startTenantOnboarding(input)
                                  │ fetch (NO session header, credentials: 'include')
                                  ▼
HTTP                     POST /api/v1/v2/tenant/onboarding/start
                         body: StartTenantOnboardingDto

Controller               apps/api/src/modules/tenant-onboarding/tenant-onboarding.controller.ts
@Public()                └─ start(@Body dto)
                                  │
Service                  apps/api/src/modules/tenant-onboarding/tenant-onboarding.service.ts
                         └─ start(dto)
                              ├─ tenantAccountsStore.findByEmail(email)
                              │     ├─ exists + resumable → reuse + skip seeding
                              │     └─ exists + NOT resumable → 409 ConflictException
                              ├─ tenantAccountsStore.create({ ...passwordHash: '' })
                              ├─ getOrCreateApplication(tenant.id)
                              │     └─ store.createApplication(tenantAccountId, 'draft')
                              │     └─ auditLogService.log('onboarding_application_created')
                              ├─ seedApplicationFromStart(application.id, dto)
                              │     ├─ store.upsertBusinessDetail / upsertLegalDetail /
                              │     │  upsertOwnerContact / upsertOperationsProfile
                              │     └─ 4× store.upsertStepProgress(stepKey, 'in_progress')
                              └─ getWorkspace(tenant.id)
                                    └─ buildStateToken(application, currentStep)
                                          └─ CryptoUtil.encryptStateToken(...)

Tables written           TenantAccount, TenantOnboardingApplication,
                         TenantBusinessDetail, TenantLegalDetail,
                         TenantOwnerContact, TenantOperationsProfile,
                         TenantOnboardingStepProgress (×4), AuditLog

Response                 { stateToken, status, currentStepKey, nextStepKey }

Frontend post-process    apps/tenant/src/app/page.tsx
                         └─ writeOnboardingStateToken(stateToken)     (localStorage)
                         └─ router.push('/onboarding/{stateToken}/welcome')
```

Example request body (`StartTenantOnboardingDto`):

```json
{
  "firstName": "Ayşe",
  "lastName": "Demir",
  "phoneNumber": "+90 555 000 11 22",
  "email": "ayse@orneklokanta.com",
  "companyName": "Örnek Lokanta",
  "companyAddress": "Atatürk Cad. No:1, Beşiktaş, İstanbul",
  "tenantType": "food_service",
  "deliveryModel": "platform_fleet"
}
```

Example response (`StartTenantOnboardingResult`):

```json
{
  "stateToken": "eyJ2IjoxLCJpdiI6Imdf...rest-of-AES-256-GCM-token...",
  "status": "draft",
  "currentStepKey": "business_info",
  "nextStepKey": "legal_tax_info"
}
```

Legacy path: none — the landing form has always used `start`. There is
no `me/start`.

---

### 4.2. Step save → `PATCH /:stateToken/steps/:stepKey`

Every keystroke-batched **Continue** click on a fillable step fires this
request. It only saves *draft* data and bumps the step's progress to
`in_progress`; it does NOT mark the step complete (see 4.3 for that).

The response carries a **refreshed stateToken** because the application's
`currentStep` may have advanced. The frontend writes the new token to
the URL + localStorage so the next request uses it.

```
UI                       apps/tenant/src/components/tenant/onboarding/TenantOnboardingStepPanel.tsx
                         └─ <form onSubmit> → onSaveDraft(stepKey, payload)

Hook                     apps/tenant/src/components/tenant/onboarding/useTenantOnboardingWorkspace.ts
                         └─ saveDraft(step, payload)
                              ├─ branch picked at call site:
                              │    stateToken ?
                              │      patchTenantOnboardingStepByStateToken(...)   ← canonical
                              │    :
                              │      patchTenantOnboardingStep(session, ...)      ← @deprecated
                              ├─ rememberStateToken(result.stateToken)
                              │    → writeOnboardingStateToken(localStorage)
                              ├─ getTenantOnboardingWorkspaceByStateToken(result.stateToken)
                              └─ setWorkspace(nextWorkspace)

Client helper            apps/tenant/src/lib/tenant-onboarding-client.ts
                         └─ patchTenantOnboardingStepByStateToken(stateToken, step, input)

HTTP                     PATCH /api/v1/v2/tenant/onboarding/:stateToken/steps/:stepKey
                         body: Patch<Step>Dto   (one of business_info / legal_tax_info /
                                                  owner_contact_info / operations_info)

Controller               tenant-onboarding.controller.ts
@Public()                └─ patchStepByStateToken(stateToken, stepKey, dto)

Service                  tenant-onboarding.service.ts
                         └─ saveStepDraftByStateToken(stateToken, step, input)
                              ├─ resolveApplicationFromStateToken(stateToken)
                              │     ├─ CryptoUtil.decryptStateToken
                              │     ├─ validateStateTokenPayload (tenant-onboarding.tokens.ts)
                              │     └─ store.findApplicationById + tokenSalt match check
                              │           └─ all mismatches → 403 ForbiddenException
                              └─ saveStepDraft(application.tenantAccountId, step, input)
                                    ├─ assertEditableStepKey  (rejects 'final_review', 'documents')
                                    ├─ ensureEditableApplication  (rejects terminal statuses)
                                    ├─ validateDto(<Step>Dto, input)   (class-validator)
                                    ├─ store.upsert<Step>Detail(...)
                                    ├─ store.upsertStepProgress(stepKey, 'in_progress')
                                    └─ buildStateToken(freshApplication, currentStep)
                                          → fresh stateToken in response

Tables written           Tenant<Step>Detail (one of 4),
                         TenantOnboardingStepProgress

Response                 { stepKey, status: 'in_progress', nextStepKey, stateToken, data }
```

Example request body (PATCH `business_info`):

```json
{
  "businessName": "Örnek Lokanta",
  "businessType": "food_service",
  "addressLine1": "Atatürk Cad. No:1",
  "city": "İstanbul",
  "postalCode": "34357",
  "country": "TR"
}
```

Example response:

```json
{
  "stepKey": "business_info",
  "status": "in_progress",
  "nextStepKey": "legal_tax_info",
  "stateToken": "eyJ2IjoxLCJpdiI6...new-token-after-currentStep-bumped...",
  "data": { "id": "...", "businessName": "Örnek Lokanta", "...": "..." }
}
```

Legacy path: `PATCH /api/v1/v2/tenant/onboarding/me/:step` →
`patchStep` → same `saveStepDraft`. Auth: tenant bearer +
`AccessTokenGuard` (NOT `@Public()`).

---

### 4.3. Step complete → `POST /:stateToken/steps/:stepKey/complete`

Distinct from save: this is the **explicit gate** the user crosses when
all required fields for a step are filled. The server re-validates the
required-field set before marking the step `completed` (this is what
the doc calls `assertStepReadyForCompletion`).

```
UI                       TenantOnboardingStepPanel.tsx
                         └─ "Tamamla" button → onComplete(stepKey)

Hook                     useTenantOnboardingWorkspace.ts
                         └─ completeStep(step)
                              ├─ stateToken ?
                              │     completeTenantOnboardingStepByStateToken
                              │   : completeTenantOnboardingStep  (@deprecated)
                              ├─ getTenantOnboardingWorkspaceByStateToken(result.stateToken)
                              └─ rememberStateToken(result.stateToken)

HTTP                     POST /api/v1/v2/tenant/onboarding/:stateToken/steps/:stepKey/complete
                         (no body)

Controller @Public()     completeStepByStateToken(stateToken, stepKey)

Service                  completeStepByStateToken(stateToken, step)
                         ├─ resolveApplicationFromStateToken(stateToken)
                         └─ completeStep(tenantAccountId, step)
                               ├─ assertStepKey
                               ├─ ensureEditableApplication
                               ├─ assertStepReadyForCompletion(applicationId, stepKey)
                               │     → 400 BadRequestException with `errors[]` if not ready
                               └─ store.upsertStepProgress(stepKey, 'completed')

Response                 { stepKey, status: 'completed', nextStepKey, stateToken }
```

Tables written: `TenantOnboardingStepProgress` (the row for `stepKey`).
No detail tables are touched here — the data was already persisted by
the prior save call (4.2).

Failure modes worth knowing:

| Status | Reason | Where it's thrown |
|---|---|---|
| 403 | stateToken decrypt failure, salt mismatch, wrong tenantAccountId | `resolveApplicationFromStateToken` |
| 400 | step not editable (e.g. application is `submitted`) | `ensureEditableApplication` |
| 400 | required fields missing | `assertStepReadyForCompletion` |

Legacy path: `POST /api/v1/v2/tenant/onboarding/me/:step/complete` →
`completeStep` → same internal `completeStep`.

---

### 4.4. Resume (URL → workspace load)

The user revisits a half-finished application by opening
`/onboarding/<stateToken>/<stepSlug>` (either from a bookmark, the
"continue" email, or the localStorage-rehydrated home redirect). The
frontend has zero tenant identity until it decodes the workspace
response.

```
URL                      /onboarding/[stateToken]/[stepSlug]
                         apps/tenant/src/app/onboarding/[stateToken]/layout.tsx

Workspace component      apps/tenant/src/components/tenant/onboarding/TenantOnboardingWorkspace.tsx
                         └─ useTenantOnboardingWorkspace(stateToken)
                              └─ loadWorkspace()
                                   ├─ cache hit?  → render workspaceCache entry,
                                   │                refetch in background
                                   └─ cache miss? → setLoading(true)
                                                   getTenantOnboardingWorkspaceByStateToken(stateToken)

HTTP                     GET /api/v1/v2/tenant/onboarding/:stateToken/workspace

Controller @Public()     getWorkspaceByStateToken(stateToken)

Service                  resolveStateToken(stateToken)
                         ├─ resolveApplicationFromStateToken(stateToken)
                         │     ├─ CryptoUtil.decryptStateToken
                         │     ├─ validateStateTokenPayload
                         │     ├─ store.findApplicationById
                         │     └─ tokenSalt + tenantAccountId match check
                         └─ getWorkspace(application.tenantAccountId)
                               ├─ store.findApplicationByTenantId
                               ├─ store.getBusinessDetail / getLegalDetail /
                               │  getOwnerContact / getOperationsProfile
                               ├─ store.listDocuments (filter isCurrent)
                               ├─ store.listStepProgress
                               ├─ phoneVerification snapshot from
                               │  `verifiedPhoneApplications` Map (in-memory)
                               └─ buildStateToken(application, currentStep)
                                     → fresh stateToken returned in payload

Response                 TenantOnboardingWorkspace { application, stateToken,
                                                    phoneVerification, steps[],
                                                    editable, canSubmitForReview,
                                                    submitAction, … }

Frontend post-process    rememberStateToken(workspace.stateToken)
                         workspaceCache.set(key, workspace)
                         then onboarding-routing.ts.getTenantOnboardingResumeUrl
                         picks where to land (welcome / step / waiting / dashboard).
```

Resume routing decisions (`onboarding-routing.ts → getTenantOnboardingResumeUrl`):

| Application status                          | Resume URL                                   |
| ------------------------------------------- | -------------------------------------------- |
| `approved`, `active`                        | `/dashboard`                                 |
| `submitted`, `under_review`, `rejected`, `suspended` | `/onboarding/{stateToken}/waiting`  |
| `draft`, `revision_required`                | first locked-safe step (`/onboarding/{stateToken}/{stepSlug}`) |

---

### 4.5. Phone verification

Two-leg challenge. The first leg generates a 6-digit code, stores it in
an in-memory `Map<applicationId, PhoneVerificationChallenge>` (NOT the
database — see Open items in `onboarding-v2-flow.md`), and dispatches an
email via `EmailService` (currently log-only). The second leg confirms
the code and stores the phone number in a second in-memory
`Map<applicationId, phoneNumber>` (`verifiedPhoneApplications`) that the
workspace serializer reads to set `phoneVerification.verified`.

```
Leg 1 — send
  UI            TenantOnboardingStepPanel.tsx (phone-verification step)
                └─ "Kodu gönder" button

  Client        sendTenantOnboardingPhoneVerification(stateToken, phoneNumber)

  HTTP          POST /api/v1/v2/tenant/onboarding/phone-verification/send
                body: { stateToken, phoneNumber }                     ← body-token variant
                  OR
                POST /api/v1/v2/tenant/onboarding/:stateToken/phone-verification/send
                body: { phoneNumber }                                  ← URL-token variant

  Controller    sendPhoneVerificationCodeFromBody / sendPhoneVerificationCode   @Public()
  Service       sendPhoneVerificationCodeByStateToken(stateToken, phoneNumber)
                ├─ resolveApplicationFromStateToken
                ├─ tenantAccountsStore.findById  (404 if missing)
                ├─ normalizePhoneNumber
                ├─ challenge = { code: 6-digit, expiresAt: now + 10min, attempts: 0 }
                ├─ phoneVerificationChallenges.set(application.id, challenge)
                └─ emailService.send({ to: tenant.email, subject, text })
                     (NotificationModule → log-only transport today)

  Response      { maskedPhoneNumber, expiresAt, delivery: 'email_fallback',
                  debugCode?: '123456' }              ← debugCode only in non-prod

Leg 2 — verify
  UI            User types code → "Doğrula" button

  Client        verifyTenantOnboardingPhone(stateToken, code)

  HTTP          POST /api/v1/v2/tenant/onboarding/phone-verification/verify
                body: { stateToken, code }
                  OR  POST /:stateToken/phone-verification/verify

  Controller    verifyPhoneVerificationCodeFromBody / verifyPhoneVerificationCode   @Public()
  Service       verifyPhoneByStateToken(stateToken, code)
                ├─ resolveApplicationFromStateToken
                ├─ challenge expired / missing → 400 'Phone verification code expired.'
                ├─ challenge.attempts >= 5      → 400 'Phone verification attempts exceeded.'
                ├─ challenge.code !== code      → 400 'Invalid phone verification code.'
                │                                  (challenge.attempts++)
                ├─ phoneVerificationChallenges.delete(application.id)
                ├─ verifiedPhoneApplications.set(application.id, phoneNumber)
                └─ return { verified: true, workspace: getWorkspace(...) }

  Response      { verified: true, workspace: TenantOnboardingWorkspace }
```

> **Important caveat:** both `Map`s are process-local. A server restart
> wipes the in-flight challenges and all "verified" phone markers. For
> single-instance deployments this is fine; horizontal scaling requires
> moving these into a row in `TenantOnboardingApplication` (tracked in
> Open items).

---

### 4.6. Submit for review

The last action a tenant takes before the application becomes the
admin's problem. The same endpoint covers both first-time `submit`
(from `draft`) and `resubmit` (from `revision_required`) — the service
inspects the current status and dispatches accordingly.

```
UI                       TenantOnboardingStepPanel.tsx (review step)
                         └─ "Başvuruyu gönder" button → onSubmit()

Hook                     useTenantOnboardingWorkspace.ts → submitForReview()

Client                   submitTenantOnboardingByStateToken(stateToken)

HTTP                     POST /api/v1/v2/tenant/onboarding/:stateToken/submit
                         (no body)

Controller @Public()     submitForReviewByStateToken(stateToken)

Service                  submitForReviewByStateToken(stateToken)
                         ├─ resolveApplicationFromStateToken
                         └─ submitForReview(application.tenantAccountId)
                               ├─ getOrCreateApplication
                               ├─ application.status === 'revision_required'
                               │     ? resubmit(tenantAccountId)
                               │     : submit(tenantAccountId)
                               │
                               │   submit():
                               │     ├─ ensureEditableApplication
                               │     ├─ assertTransition(status, 'submitted')   ← state.ts
                               │     ├─ assertReadyForSubmission(applicationId)
                               │     │     → 400 with errors[] if any required
                               │     │       step is not completed or required
                               │     │       documents are missing
                               │     ├─ store.updateApplicationStatus(
                               │     │       status='submitted',
                               │     │       submittedAt = first-time only,
                               │     │       lastSubmittedAt = now,
                               │     │       reviewStartedAt = null)
                               │     ├─ store.upsertStepProgress('final_review', 'completed')
                               │     ├─ tenantAccountsStore.updateComplianceStatus(
                               │     │       onboardingStatus='submitted',
                               │     │       verificationStatus='pending')
                               │     └─ auditLogService.log('onboarding_submitted')
                               │
                               │   resubmit(): same shape, but
                               │     - status transition revision_required → submitted
                               │     - currentRevisionNumber++ inside store.updateApplicationStatus
                               │
                               └─ return { application, workspace: getWorkspace(...) }

Tables written           TenantOnboardingApplication (status, timestamps,
                                                     currentRevisionNumber++),
                         TenantOnboardingStepProgress ('final_review'),
                         TenantAccount (onboardingStatus, verificationStatus),
                         AuditLog

Response                 { application: <updated>, workspace: <fresh> }

Frontend post-process    setWorkspace(result.workspace)
                         router.push('/onboarding/{stateToken}/waiting')
```

After this point the tenant's workspace polls show `submitted` /
`under_review` / `revision_required` / `approved` / etc. Admin writes
flow through the same `TenantOnboardingService` (see flow 6) so the
waiting screen reflects an admin decision on its next poll.

Legacy path: `POST /api/v1/v2/tenant/onboarding/me/submit` → `submitForReview`.

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
