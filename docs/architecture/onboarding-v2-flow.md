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

Tenant frontend does not call any of these; the `getTenantOnboardingSummary`
helper in `tenant-onboarding-client.ts` calls `/v2/tenant/onboarding`.

---

## Files at the heart of the flow

```
apps/api/src/modules/tenant-onboarding/
├── tenant-onboarding.module.ts
├── tenant-onboarding.controller.ts        # @Controller('v2/tenant/onboarding')
├── tenant-onboarding.service.ts           # ~1300 LOC — single source of truth
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

## Open items

- `notification/EmailService` is log-only — phone verification codes and
  "continue application" emails are not delivered yet. Configure a real
  transport before going live.
- The HTTP route prefix is still `/v2/tenant/onboarding/*` for backwards
  compatibility with already-deployed tenant frontend builds. Dropping the
  `/v2` segment is a coordinated frontend+backend change and is deliberately
  out of scope for the stabilization slice.
