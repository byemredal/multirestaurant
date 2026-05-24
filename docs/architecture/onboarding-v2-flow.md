# Tenant Onboarding — Architecture & Flow

> **Status:** The state-token onboarding module (formerly "v2") is now the
> single canonical onboarding implementation and lives at
> `apps/api/src/modules/tenant-onboarding/`. The legacy duplicate directory
> was removed and the `v2-tenant-onboarding/` folder was renamed in the
> 2026-05-24 stabilization slice. The HTTP route prefix
> `/api/v1/v2/tenant/onboarding/*` was intentionally **not** renamed so that
> existing tenant frontend clients keep working without redeploy.

## High-level overview

Onboarding v2 is stateless from the tenant's point of view: the URL carries an
encrypted `stateToken` (AES-256-GCM, key derived from `STATE_TOKEN_SECRET` /
`JWT_SECRET`). The tenant never authenticates with a bearer token while the
application is in `draft` / `revision_required` — the state token is the proof
of authorship. Phone verification is the only checkpoint before the tenant can
fill detailed steps.

The same backend module is used by:

- the tenant frontend (`apps/tenant`) — for create / fill / submit
- the admin panel (`apps/admin` via `admin-tenant-reviews`) — for list / review
  / approve / reject / activate / suspend / reopen
- the waiting screen — for status polling

Both the tenant and admin flows operate against the same DB tables
(`TenantOnboardingApplication`, `TenantBusinessDetail`, `TenantLegalDetail`,
`TenantOwnerContact`, `TenantOperationsProfile`, `TenantDocument`,
`TenantApplicationReview`, `TenantDocumentReview`, `AdminNote`), so there is no
data-divergence risk.

## State machine

Defined in `apps/api/src/modules/v2-tenant-onboarding/tenant-onboarding.service.ts`
as `ONBOARDING_STATUS_TRANSITIONS`:

```
draft              → submitted
submitted          → under_review | revision_required | approved | rejected
under_review       → revision_required | approved | rejected
revision_required  → submitted | rejected
approved           → active | under_review | suspended
rejected           → under_review
active             → suspended
suspended          → active | under_review
```

Every status change — tenant-driven (submit / resubmit) and admin-driven
(review decisions, activation, suspension) — is validated against this map,
so the application can never reach an inconsistent state.

---

## 1. Landing → start

| Layer | File |
| --- | --- |
| UI entry | `apps/tenant/src/app/page.tsx` |
| API client | `apps/tenant/src/lib/tenant-onboarding-client.ts` → `startTenantOnboarding` |
| HTTP | `POST /api/v1/v2/tenant/onboarding/start` (Public) |
| Controller | `apps/api/src/modules/v2-tenant-onboarding/tenant-onboarding.controller.ts` → `start` |
| Service | `…/tenant-onboarding.service.ts` → `start` |
| Store | `…/tenant-onboarding.store.ts` → `createApplication`, `upsert*Detail`, `upsertStepProgress` |
| Tables written | `TenantAccount`, `TenantOnboardingApplication`, `TenantBusinessDetail`, `TenantLegalDetail`, `TenantOwnerContact`, `TenantOperationsProfile`, `TenantOnboardingStepProgress` |

**Returned to the client:** `{ stateToken, status, currentStepKey, nextStepKey }`.

The frontend stores the state token via `writeOnboardingStateToken` in
`apps/tenant/src/lib/storage/tenant-session.ts` and redirects to
`/onboarding/<stateToken>/<stepSlug>`.

---

## 2. stateToken URL → workspace load

| Layer | File |
| --- | --- |
| URL pattern | `/onboarding/[stateToken]/[stepKey]` (Next.js dynamic route) |
| Layout | `apps/tenant/src/app/onboarding/[stateToken]/layout.tsx` |
| Step pages | `apps/tenant/src/app/onboarding/[stateToken]/{welcome,phone-verification,business-intro,location,business-details,bank-details,plan-selection,review,verification}/page.tsx` |
| Workspace component | `apps/tenant/src/components/tenant/onboarding/TenantOnboardingWorkspace.tsx` |
| Workspace hook | `apps/tenant/src/components/tenant/onboarding/useTenantOnboardingWorkspace.ts` |
| Step panel | `apps/tenant/src/components/tenant/onboarding/TenantOnboardingStepPanel.tsx` |
| Sidebar | `apps/tenant/src/components/tenant/onboarding/TenantOnboardingSidebar.tsx` |
| Workflow ↔ backend step map | `apps/tenant/src/components/tenant/onboarding/onboarding-routing.ts` |
| API client | `getTenantOnboardingWorkspaceByStateToken` in `tenant-onboarding-client.ts` |
| HTTP | `GET /api/v1/v2/tenant/onboarding/:stateToken/workspace` (Public) |
| Controller | `getWorkspaceByStateToken` |
| Service | `resolveStateToken` → `getWorkspace` |
| Crypto | `apps/api/src/common/utility/crypto-util.ts` → `decryptStateToken` |

Token decryption verifies `applicationId`, `tenantAccountId`, and
`tokenSalt`. If the salt was rotated (e.g. application moved to a terminal
state) the token is rejected with `ForbiddenException`.

---

## 3. Step draft save / complete

| Layer | File |
| --- | --- |
| UI | `TenantOnboardingStepPanel.tsx` |
| API client | `tenant-onboarding-client.ts` → `saveStepDraftByStateToken`, `completeStepByStateToken` |
| HTTP — draft | `PATCH /api/v1/v2/tenant/onboarding/:stateToken/steps/:step` |
| HTTP — complete | `POST /api/v1/v2/tenant/onboarding/:stateToken/steps/:step/complete` |
| Controller | `patchStepByStateToken`, `completeStepByStateToken` |
| Service | `saveStepDraftByStateToken` → `saveStepDraft`; `completeStepByStateToken` → `completeStep` |
| DTOs | `apps/api/src/modules/v2-tenant-onboarding/dto/patch-*.dto.ts` |

Each draft save validates against the step DTO via `class-validator`. Each
complete call calls `assertStepReadyForCompletion`, which enforces the same
required fields server-side.

The response contains a refreshed `stateToken` because the application's
`currentStep` (encoded into the token payload) advances.

---

## 4. Documents / verification

| Layer | File |
| --- | --- |
| UI | step pages: `verification`, `review`; bound through `TenantOnboardingStepPanel.tsx` |
| API client | `uploadTenantDocumentByStateToken` |
| HTTP — file upload | `POST /api/v1/v2/tenant/onboarding/:stateToken/documents/upload` (multipart) |
| HTTP — JSON metadata | `POST /api/v1/v2/tenant/onboarding/:stateToken/documents` |
| Controller | `uploadDocumentFileByStateToken`, `uploadDocumentByStateToken` |
| Service | `uploadDocumentFileByStateToken`, `uploadDocument` |
| File storage | `apps/api/src/modules/shared-file-storage/shared-file-storage.service.ts` |
| Tables written | `TenantDocument`, `FileAsset`, `TenantOnboardingStepProgress (documents)` |

Each upload version-bumps the existing document of the same `type`, marks the
prior version `isCurrent = false`, and resets `documents` step progress.

---

## 5. Submit / resubmit (tenant) → waiting

| Layer | File |
| --- | --- |
| UI trigger | review step inside `TenantOnboardingStepPanel.tsx` |
| API client | `submitTenantOnboardingByStateToken` |
| HTTP | `POST /api/v1/v2/tenant/onboarding/:stateToken/submit` |
| Controller | `submitForReviewByStateToken` |
| Service | `submitForReviewByStateToken` → `submit` or `resubmit` |
| Side-effects | application status `draft → submitted` (first) or `revision_required → submitted` (resubmit); `TenantAccount.onboardingStatus = submitted`; audit log row |

After submission, the frontend redirects to the waiting page:
`apps/tenant/src/app/onboarding/[stateToken]/waiting/page.tsx`

The waiting page polls `getTenantOnboardingWorkspaceByStateToken`. If the
application transitions to `approved` / `active`, the resume URL becomes
`/dashboard` and the tenant is redirected. Realtime push is not used here —
only the explicit poll on page mount and on user-triggered refresh.

---

## 6. Admin review flow

All admin actions are unified through `AdminTenantReviewsService` →
`TenantOnboardingService` (v2). Auth is admin bearer + `AdminRoleGuard`.

| Operation | HTTP | Controller | Service method |
| --- | --- | --- | --- |
| List applications | `GET /api/v1/admin/tenant-applications` | `AdminTenantApplicationsController.list` | `listApplications` → `listApplicationsForAdmin` |
| Get application | `GET /api/v1/admin/tenant-applications/:id` | `…controller.get` | `getApplication` → `getApplicationForAdmin` |
| Timeline | `GET /api/v1/admin/tenant-applications/:id/timeline` | `…controller.getTimeline` | `AdminAuditLogService.listApplicationTimeline` |
| Request revision | `POST /api/v1/admin/tenant-applications/:id/request-revision` | `…controller.requestRevision` | `requestRevision` |
| Approve | `POST /api/v1/admin/tenant-applications/:id/approve` | `…controller.approve` | `approveApplication` |
| Reject | `POST /api/v1/admin/tenant-applications/:id/reject` | `…controller.reject` | `rejectApplication` |
| List documents | `GET /api/v1/admin/tenant-documents` | `AdminDocumentReviewsController.list` | `listDocuments` |
| Get document | `GET /api/v1/admin/tenant-documents/:id` | `…controller.get` | `getDocument` |
| Approve doc | `POST /api/v1/admin/tenant-documents/:id/approve` | `…controller.approve` | `approveDocument` → `reviewDocument('approve')` |
| Reject doc | `POST /api/v1/admin/tenant-documents/:id/reject` | `…controller.reject` | `rejectDocument` → `reviewDocument('reject')` |
| Request doc revision | `POST /api/v1/admin/tenant-documents/:id/request-revision` | `…controller.requestRevision` | `requestDocumentRevision` → `reviewDocument('request_revision')` |
| List tenants | `GET /api/v1/admin/tenants` | `AdminTenantActivationController.list` | `listTenants` |
| Activate tenant | `POST /api/v1/admin/tenants/:id/activate` | `…controller.activate` | `activateTenant` |
| Suspend tenant | `POST /api/v1/admin/tenants/:id/suspend` | `…controller.suspend` | `suspendTenant` |
| Reopen review | `POST /api/v1/admin/tenants/:id/reopen-review` | `…controller.reopenReview` | `reopenReview` |
| Tenant overview | `GET /api/v1/admin/tenants/:id/overview` | `AdminTenantOversightController.getOverview` | `getTenantBusinessOverview` |

All write operations:

1. Validate the target status transition against `ONBOARDING_STATUS_TRANSITIONS`.
2. Update `TenantOnboardingApplication.status` + timestamp column.
3. Mirror the status to `TenantAccount.onboardingStatus` /
   `verificationStatus` / `isActive` / `isVerified` via
   `tenantAccountsStore.updateComplianceStatus`.
4. Persist `TenantApplicationReview` and optional `AdminNote` rows.
5. Write an `AuditLog` row via `AdminAuditLogService.log`.

Because admin writes go through the same v2 service the tenant frontend reads
through, the waiting screen reflects admin decisions immediately on next poll.

---

## 7. Revision flow

1. Admin posts `request-revision` → `requestRevision` transitions
   `submitted | under_review → revision_required` and persists notes.
2. Tenant waiting screen polls workspace; `getTenantOnboardingResumeUrl`
   (`apps/tenant/src/components/tenant/onboarding/onboarding-routing.ts`)
   detects status is no longer in the waiting set and redirects to the first
   step that needs attention.
3. Tenant edits the relevant step (state-token URL remains valid because the
   `tokenSalt` is unchanged for non-terminal statuses).
4. Tenant resubmits → `submit` flows into `resubmit` (because status is
   `revision_required`); `currentRevisionNumber` is incremented and the
   waiting screen is shown again.

---

## 8. Approval → dashboard / password flow

| Step | Detail |
| --- | --- |
| Admin approves | `approveApplication` validates all required current documents are `approved`; transitions `submitted | under_review → approved`; sets `TenantAccount.isVerified = true`, `onboardingStatus = approved`. |
| Admin activates | `activateTenant` transitions `approved → active`; sets `TenantAccount.isActive = true`, `onboardingStatus = active`. |
| Tenant resumes | `getTenantOnboardingResumeUrl` sees `approved | active` and returns `/dashboard`. |
| Password prompt | `apps/tenant/src/components/tenant/TenantSetPasswordCard.tsx` (rendered inside `/dashboard`) calls `setTenantPassword` → `POST /api/v1/tenants/me/password`. |

The tenant is no longer using the state token at this point — the active
session token (bearer + CSRF) is issued through
`apps/api/src/modules/tenants/tenants.controller.ts` → `resume` /
`bootstrap` and stored by `tenant-auth-context`.

---

## Routes that should NOT exist (post-unification)

After the 2026-05-24 patch, NestJS does not mount the legacy module because
`admin-tenant-reviews.module.ts` no longer imports it and `app.module.ts`
keeps it commented out. Therefore the following routes are GONE:

- `GET /api/v1/tenant/onboarding`
- `GET /api/v1/tenant/onboarding/me`
- `GET /api/v1/tenant/onboarding/steps`
- `PATCH /api/v1/tenant/onboarding/me/:step`
- `POST /api/v1/tenant/onboarding/me/:step/complete`
- `POST /api/v1/tenant/onboarding/me/documents` (and `/upload`)

Tenant frontend does not call the v1 paths; the canonical state-token
client functions in `tenant-onboarding-client.ts` call
`/v2/tenant/onboarding/:stateToken/...`.

---

## State-token vs. session/`me` client functions

The state-token flow is the canonical onboarding interface. The session/`me`
client functions and routes are kept as a fallback for already-authenticated
tenants and are explicitly marked `@deprecated` in
`apps/tenant/src/lib/tenant-onboarding-client.ts`.

| Concern             | Canonical (state-token)                                 | Legacy (session / `me`) — marked `@deprecated` |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| Load workspace      | `getTenantOnboardingWorkspaceByStateToken(stateToken)`  | `getTenantOnboardingWorkspace(session)`        |
| Patch step draft    | `patchTenantOnboardingStepByStateToken(...)`            | `patchTenantOnboardingStep(...)`               |
| Complete step       | `completeTenantOnboardingStepByStateToken(...)`         | `completeTenantOnboardingStep(...)`            |
| Upload document     | `uploadTenantOnboardingDocumentByStateToken(...)`       | `uploadTenantOnboardingDocument(...)`          |
| Submit for review   | `submitTenantOnboardingByStateToken(stateToken)`        | `submitTenantOnboarding(session)`              |
| HTTP path shape     | `/v2/tenant/onboarding/:stateToken/...`                 | `/v2/tenant/onboarding/me/...`                 |

Current legacy consumers (the reason the deprecated helpers are still
exported, not deleted):

- `useTenantOnboardingWorkspace` falls back to the session variant when
  no `stateToken` prop is passed — i.e. when the hook runs on a route
  that does not own a state token in the URL.
- `TenantWaitingScreen` uses `getTenantOnboardingWorkspace(session)` to
  fetch revision notes for `rejected` / `suspended` applications.

Both call sites are flagged in the source. The deprecated helpers can be
deleted once those two consumers switch to state-token equivalents.

---

## Files at the heart of the flow

```
apps/api/src/modules/tenant-onboarding/
├── tenant-onboarding.module.ts
├── tenant-onboarding.controller.ts        # @Controller('v2/tenant/onboarding')
├── tenant-onboarding.service.ts           # orchestrates the lifecycle (~1300 LOC)
├── tenant-onboarding.state.ts             # ONBOARDING_STATUS_TRANSITIONS + assertOnboardingTransition
├── tenant-onboarding.tokens.ts            # buildStateToken / validateStateTokenPayload / step helpers
├── tenant-onboarding.store.ts             # All DB IO for onboarding entities
├── entities/tenant-onboarding.entity.ts   # Status + step + document types
└── dto/                                   # patch / update / upload DTOs

apps/api/src/modules/admin-tenant-reviews/
├── admin-tenant-reviews.module.ts         # imports tenant-onboarding
├── admin-tenant-reviews.service.ts        # thin wrapper over v2 service
├── admin-tenant-applications.controller.ts
├── admin-document-reviews.controller.ts
├── admin-tenant-activation.controller.ts
└── admin-tenant-oversight.controller.ts

apps/api/src/common/utility/crypto-util.ts # state-token encryption

apps/tenant/src/lib/tenant-onboarding-client.ts
apps/tenant/src/app/page.tsx                                       # landing
apps/tenant/src/app/onboarding/[stateToken]/layout.tsx             # workspace shell
apps/tenant/src/app/onboarding/[stateToken]/<step>/page.tsx        # per-step
apps/tenant/src/app/onboarding/[stateToken]/waiting/page.tsx       # submitted state
apps/tenant/src/components/tenant/onboarding/
├── TenantOnboardingWorkspace.tsx
├── TenantOnboardingStepPanel.tsx
├── TenantOnboardingSidebar.tsx
├── TenantOnboardingSummary.tsx
├── TenantContinuationBanner.tsx
├── useTenantOnboardingWorkspace.ts
└── onboarding-routing.ts                  # workflow ↔ backend step mapping
```

---

## Developer Trace — "When I click Continue on a step…"

The reader's mental model often needs *one* concrete request walked through
end-to-end. This is what happens when a tenant on
`/onboarding/<stateToken>/business-details` types a tax id and clicks
**Continue**.

1. **UI click** —
   `apps/tenant/src/components/tenant/onboarding/TenantOnboardingStepPanel.tsx`
   handles the form submit. It calls the workspace hook:
   `apps/tenant/src/components/tenant/onboarding/useTenantOnboardingWorkspace.ts`
   → `saveDraft(stepKey, payload)`.

2. **State-token branch** — Because the hook received a `stateToken` from
   the route layout (`app/onboarding/[stateToken]/layout.tsx`), it picks
   the canonical helper:
   `patchTenantOnboardingStepByStateToken(currentStateTokenRef.current, step, payload)`
   in `apps/tenant/src/lib/tenant-onboarding-client.ts`.

3. **HTTP request** —
   `PATCH /api/v1/v2/tenant/onboarding/<stateToken>/steps/legal_tax_info`
   with the DTO body.

4. **Controller** —
   `apps/api/src/modules/tenant-onboarding/tenant-onboarding.controller.ts`
   → `patchStepByStateToken` (decorated `@Public()` because the state
   token *is* the credential).

5. **Service** —
   `apps/api/src/modules/tenant-onboarding/tenant-onboarding.service.ts`
   → `saveStepDraftByStateToken` →
   - `resolveApplicationFromStateToken(stateToken)` — calls
     `CryptoUtil.decryptStateToken` (`apps/api/src/common/utility/crypto-util.ts`)
     and `validateStateTokenPayload`
     (`apps/api/src/modules/tenant-onboarding/tenant-onboarding.tokens.ts`),
     then loads the application row by id from
     `tenant-onboarding.store.ts`.
   - `saveStepDraft(application.tenantAccountId, step, input)` — runs
     `class-validator` over the DTO, calls
     `store.upsertLegalDetail(applicationId, ...)`, and marks the step
     `in_progress` via `store.upsertStepProgress`.

6. **State-token rotation** — A fresh `stateToken` is built via
   `buildStateToken(application, currentStep)`
   (`tenant-onboarding.tokens.ts`) so the URL the tenant carries always
   reflects the new `currentStep` and `tokenSalt`.

7. **Response** — `{ stepKey, status: 'in_progress', nextStepKey,
   stateToken, data }` flows back through the same chain.

8. **UI commit** — The hook calls `getTenantOnboardingWorkspaceByStateToken`
   to refetch the full workspace, updates `workspaceCache`, sets the new
   state token on the URL via `writeOnboardingStateToken`, and the
   `TenantOnboardingStepPanel` re-renders with the next step.

No status transition ran during this trace — `saveStepDraft` only moves
step *progress*, not the application status. Status transitions
(`draft → submitted`, `submitted → approved`, etc.) go through
`assertOnboardingTransition` in `tenant-onboarding.state.ts`.

---

## Open items

- `notification/EmailService` is log-only — phone verification codes and
  "continue application" emails are not delivered yet. Configure a real
  transport before going live.
- The HTTP route prefix is still `/v2/tenant/onboarding/*` for backwards
  compatibility with already-deployed tenant frontend builds. Dropping the
  `/v2` segment is a coordinated frontend+backend change and is deliberately
  out of scope for the stabilization slice.
- Two consumers still call the legacy session/`me` helpers
  (`useTenantOnboardingWorkspace` fallback branch + `TenantWaitingScreen`
  revision-note fetch). Once they switch to the state-token equivalents,
  the `@deprecated` helpers and the matching `me/*` controller routes
  can be removed.
- `TenantOnboardingStepPanel.tsx` is ~1450 LOC and renders every workflow
  step inline. Proposed split (deferred to a focused frontend slice — not
  this one — because the file's local state is shared across panels):
    - `panels/PhoneVerificationPanel.tsx`
    - `panels/BusinessIntroPanel.tsx`
    - `panels/LocationPanel.tsx`
    - `panels/BusinessDetailsPanel.tsx`
    - `panels/BankDetailsPanel.tsx`
    - `panels/PlanSelectionPanel.tsx`
    - `panels/ReviewPanel.tsx`
    - `panels/VerificationPanel.tsx`
    - `panels/WaitingPanel.tsx`
  Each takes the same `{ workspace, saveDraft, completeStep, ... }` props
  the parent currently passes inline.
