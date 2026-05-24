# Tenant Onboarding — Debugging Runbook

A pragmatic field guide for "something looks wrong, where do I look first?"
during the tenant onboarding flow. Companions:

- [onboarding-v2-flow.md](./onboarding-v2-flow.md) — architectural overview
- [request-flows.md](./request-flows.md) — end-to-end request traces
- [onboarding-state-model.md](./onboarding-state-model.md) — who owns what state
- [onboarding-step-panel-split-plan.md](./onboarding-step-panel-split-plan.md) — UI split plan

The structure below is "by symptom" — you arrive with an observation
("my step didn't save", "the URL token is wrong"), look it up, and the
section tells you which files to open and which logs to read.

---

## 1. Where the load-bearing logic lives

Open these tabs first. They cover ~95% of onboarding bugs.

### Backend

| Concern                            | File                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| HTTP entry points (all routes)     | `apps/api/src/modules/tenant-onboarding/tenant-onboarding.controller.ts`              |
| Lifecycle orchestration            | `apps/api/src/modules/tenant-onboarding/tenant-onboarding.service.ts`                 |
| State machine + transitions        | `apps/api/src/modules/tenant-onboarding/tenant-onboarding.state.ts`                   |
| State-token build / decrypt / shape| `apps/api/src/modules/tenant-onboarding/tenant-onboarding.tokens.ts`                  |
| Token encryption primitives        | `apps/api/src/common/utility/crypto-util.ts`                                          |
| Persistence (all SQL is here)      | `apps/api/src/modules/tenant-onboarding/tenant-onboarding.store.ts`                   |
| DTOs (validation rules)            | `apps/api/src/modules/tenant-onboarding/dto/*.ts`                                     |
| TenantAccount status mirror        | `apps/api/src/modules/tenants/tenants.store.ts → updateComplianceStatus`              |
| Admin write side (mirror image)    | `apps/api/src/modules/admin-tenant-reviews/admin-tenant-reviews.service.ts`           |
| Audit logging                      | `apps/api/src/modules/admin-audit-log/admin-audit-log.service.ts`                     |

### Frontend (tenant app)

| Concern                            | File                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| Landing form                       | `apps/tenant/src/app/page.tsx`                                                        |
| Stateless route shell              | `apps/tenant/src/app/onboarding/[stateToken]/layout.tsx`                              |
| Per-step pages                     | `apps/tenant/src/app/onboarding/[stateToken]/<step>/page.tsx`                         |
| Waiting page (poll)                | `apps/tenant/src/app/onboarding/[stateToken]/waiting/page.tsx`                        |
| Workspace shell                    | `apps/tenant/src/components/tenant/onboarding/TenantOnboardingWorkspace.tsx`          |
| **Workspace hook (THE choke point)** | `apps/tenant/src/components/tenant/onboarding/useTenantOnboardingWorkspace.ts`      |
| All step UI branches               | `apps/tenant/src/components/tenant/onboarding/TenantOnboardingStepPanel.tsx`          |
| Sidebar                            | `apps/tenant/src/components/tenant/onboarding/TenantOnboardingSidebar.tsx`            |
| Waiting screen                     | `apps/tenant/src/components/tenant/TenantWaitingScreen.tsx`                           |
| Workflow ↔ backend step mapping    | `apps/tenant/src/components/tenant/onboarding/onboarding-routing.ts`                  |
| HTTP client (every endpoint)       | `apps/tenant/src/lib/tenant-onboarding-client.ts`                                     |
| localStorage helpers               | `apps/tenant/src/lib/storage/tenant-session.ts`                                       |
| Auth context                       | `apps/tenant/src/lib/auth/tenant-auth-context.tsx`                                    |
| Status routing                     | `apps/tenant/src/lib/auth/tenant-status.ts`                                           |

---

## 2. Critical points (where to set a breakpoint)

These are the half-dozen lines where most onboarding bugs surface
first. If you only set a breakpoint or `console.log` in one place, set
it here:

### Backend — first 5 lines to instrument

| File                                                                     | What it tells you                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `tenant-onboarding.service.ts → resolveApplicationFromStateToken`        | Is this state token valid right now? Decrypt result, salt match.   |
| `tenant-onboarding.service.ts → saveStepDraft`                           | Was the DTO accepted? Which detail row was upserted?               |
| `tenant-onboarding.service.ts → completeStep / assertStepReadyForCompletion` | Why is the step not considered ready?                            |
| `tenant-onboarding.service.ts → submit / resubmit`                       | Status transition + audit log.                                     |
| `tenant-onboarding.state.ts → assertOnboardingTransition`                | Is the requested status change in the allowed list?                |

### Frontend — first 5 lines to instrument

| File                                                                  | What it tells you                                                 |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `useTenantOnboardingWorkspace.ts → loadWorkspace`                     | Did the fetch land? Cached vs. fresh?                             |
| `useTenantOnboardingWorkspace.ts → saveDraft`                         | Which branch (state-token vs. session) is being used?             |
| `useTenantOnboardingWorkspace.ts → rememberStateToken`                | Was the new token persisted to localStorage + ref?                |
| `tenant-onboarding-client.ts → <action>ByStateToken`                  | Raw fetch result, response body shape, error message.             |
| `onboarding-routing.ts → getTenantOnboardingResumeUrl`                | Where will we route the user after a workspace load?              |

### Logs / observability today

- `AdminAuditLogService.log({ action, … })` writes every status-changing
  action to `AuditLog` rows. Query by `applicationId` or `tenantAccountId`
  for a per-application timeline.
- Frontend errors bubble through `setError(message)` in the hook; the
  raw message is the API's `errors[0]` / `message`. There is no Sentry
  / DataDog wired in today.
- The `HttpExceptionFilter` (`apps/api/src/common/filters/http-exception.filter.ts`)
  normalizes NestJS exceptions; the tenant app surfaces `errors[]` and
  `missingFields[]` arrays from there.

---

## 3. Symptom: "My step didn't save"

Walk this checklist top-to-bottom; the first hit is usually the cause.

1. **Network tab — did the PATCH fire at all?** If the request never
   appeared:
   - Inspect `TenantOnboardingStepPanel.tsx → onSaveDraft` call site for
     the active step. Each editable branch (`location`,
     `business-details`, `plan-selection`) has its own submit handler.
   - Inspect `useTenantOnboardingWorkspace.ts → saveDraft`. If
     `savingStep` is already non-null, a guard above the handler may
     have short-circuited.
2. **PATCH fired but returned 403 Forbidden.** Almost always a state
   token issue. Skip to §5.
3. **PATCH returned 400 with a `message` / `errors[]`.** Open
   `apps/api/src/modules/tenant-onboarding/dto/patch-<step>.dto.ts` — the
   field that failed is in the response.
4. **PATCH returned 200 but the UI still shows the old value.**
   - Verify `useTenantOnboardingWorkspace.ts → saveDraft` calls
     `getTenantOnboardingWorkspaceByStateToken` after the PATCH.
     The hook does this today; if you've changed it, the cache may
     be stale.
   - Verify the `useEffect` at `TenantOnboardingStepPanel.tsx:362` runs
     when `workspace` changes — it's what hydrates the form `useState`
     slots from the fresh `workspace.steps`.
5. **PATCH returned 200, workspace refetch landed, but the saved row
   is empty in the DB.** Open `tenant-onboarding.store.ts →
   upsert<Step>Detail` — verify the SQL upserts the keys you expect.
   Check `apps/api/db/migrations/` for the latest column on that table
   in case a recent migration changed shape.
6. **Saved successfully but the step still shows `not_started`.**
   `tenant-onboarding.service.ts → saveStepDraft` calls
   `store.upsertStepProgress(applicationId, stepKey, 'in_progress')`
   after the detail upsert. If that line is gone the step progress
   never advances.

---

## 4. Symptom: "Complete button is disabled / I can't move forward"

1. **Frontend gate.** `TenantOnboardingStepPanel.tsx` disables the
   continue button when `savingStep` is non-null or when local validation
   sees a missing required field. Inspect `fieldErrors` in React DevTools.
2. **Backend gate.** If you click and the request fires but returns 400
   with `assertStepReadyForCompletion` errors:
   - Open `tenant-onboarding.service.ts → assertStepReadyForCompletion`.
   - The errors[] array names the missing fields. They map 1:1 to the
     `Tenant<Step>Detail` columns the DTO would have populated.
   - This commonly hits when a tenant typed something, the PATCH
     succeeded with partial data, then they hit "Tamamla" before
     filling the rest. Resolution: ask them to revisit the step.
3. **`canSubmitForReview === false` on the review page.** Open
   `tenant-onboarding.service.ts → getWorkspace` and look at how
   `canSubmitForReview` is derived. It typically requires:
   - All editable steps completed.
   - At least one required current document of each required type.

---

## 5. Symptom: "stateToken is invalid (403)"

This is the single most common backend rejection. The exception comes
from `tenant-onboarding.service.ts → resolveApplicationFromStateToken`
and is thrown in exactly four places:

| Cause                                                       | Fix                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| `CryptoUtil.decryptStateToken` threw                        | Token was tampered with, truncated, or encrypted with a different `STATE_TOKEN_SECRET` / `JWT_SECRET`. Verify env vars on the API host match the one that issued the token. |
| `validateStateTokenPayload` threw                           | The decrypted payload is missing a string field. Likely an old token from a previous payload shape (very unlikely in normal operation). |
| `store.findApplicationById` returned null OR `application.tenantAccountId !== payload.tenantAccountId` | The application was deleted, or someone is replaying a token across tenants. |
| `application.tokenSalt !== payload.tokenSalt`               | The salt was rotated. This happens automatically when an application reaches a terminal status. Issue the tenant a fresh `start` or a continuation email. |

What this looks like at the call site:

- The hook's `loadWorkspace` will set `error` to the response message;
  the UI shows the generic error banner.
- For an in-flight save (PATCH or POST), `saveDraft` / `completeStep` /
  `submitForReview` will throw and `setError` to a `tenant_onboarding_*`
  string from the client helpers.

Things that look like "invalid state token" but aren't:

- **Network failure** — the client helpers in `tenant-onboarding-client.ts`
  return error strings like `tenant_onboarding_workspace_failed_<status>`.
  A response.status of `0` means CORS / network.
- **Server restart wiped phone verification** — phone-verified state is
  in-memory (see §6). The state token itself is still valid; the
  workspace's `phoneVerification.verified` flips back to `false`.

---

## 6. Symptom: "Phone verification worked yesterday, now it doesn't"

Background: `phoneVerificationChallenges` and `verifiedPhoneApplications`
are **process-local `Map`s** (`tenant-onboarding.service.ts:58–59`). A
server restart wipes both.

1. **`Phone verification code expired`** (400 from
   `verifyPhoneByStateToken`) — the challenge ttl is 10 minutes
   from creation, OR the server restarted, OR `send` was never called.
   Have the tenant click "Tekrar gönder".
2. **`Phone verification attempts exceeded`** — they typed the wrong
   code 5+ times. The challenge is gone; they need to request a new code.
3. **`Invalid phone verification code`** — typo. Check the
   `EmailService` log line (or the `debugCode` in the `send` response
   in non-prod) to see what code was actually issued.
4. **Code arrived but the tenant says verification "doesn't stick".**
   `verifiedPhoneApplications.set(application.id, …)` runs only after a
   successful verify call returns. If the SPA process crashed or
   `setState` failed between the response and the UI commit, the next
   workspace fetch will still show `verified: true` because the backend
   Map was already updated. If the **backend** restarted, the Map is
   wiped and the workspace will show `verified: false` until the
   tenant verifies again.

Persistent fix (tracked in `onboarding-state-model.md → Risks (R1)`):
move the verified marker into the `TenantOnboardingApplication` row.

---

## 7. Symptom: "Workspace is stale / wrong step shown"

The workspace cache (`workspaceCache` Map in
`useTenantOnboardingWorkspace.ts`) is module-scoped and survives
navigations within the tenant app session.

1. **Verify in the Network tab** that a `GET /workspace` actually
   landed after the last action. Every save / complete / submit /
   upload should trigger one.
2. **Check the response body** — does the JSON say the step is
   completed? If yes, the bug is purely client-side; if no, the bug is
   on the server.
3. **Client-side stale.** Two common causes:
   - The save handler did not call `setWorkspace(nextWorkspace)`. Read
     the relevant branch of `useTenantOnboardingWorkspace.ts`.
   - The `useEffect` in `TenantOnboardingStepPanel.tsx:362` did not re-run
     because the `workspace` reference identity didn't change (it
     should always be a new object from the hook; if you're mutating
     it in place, fix that).
4. **localStorage version drift.** Three keys (see
   `apps/tenant/src/lib/storage/tenant-session.ts`):
   - `auth.tenant-onboarding-state-token` — should be the most recent
     token. If it lags, the UI may try to load an older workspace on
     boot. `clearOnboardingStateToken()` to reset.
   - `auth.tenant-continuation` — long-lived; safe to keep.
   - `auth.tenant-session` — only present after activation; clears on
     sign-out.

---

## 8. Symptom: "Admin approved but tenant still sees the waiting screen"

The waiting page polls
`getTenantOnboardingWorkspaceByStateToken(stateToken)` on mount and on
user-triggered refresh. There is no SSE for this path; the only push is
the auth context's `onboardingStatus` SSE (see
`tenant-auth-context.tsx`), which triggers a `loadWorkspace` re-fetch
when the value changes.

1. **Did the admin action actually transition the row?** Check
   `TenantOnboardingApplication.status` in the DB. If it's still
   `submitted` / `under_review`, the admin write failed —
   `apps/api/src/modules/admin-tenant-reviews/admin-tenant-reviews.service.ts`
   is the entry point. AuditLog rows are the easiest way to see what
   succeeded.
2. **Did `TenantAccount.onboardingStatus` get mirrored?**
   `tenant-onboarding.service.ts → approveApplication / activateTenant`
   call `tenantAccountsStore.updateComplianceStatus`. If only the
   application row moved and the account row didn't, the SSE stream
   for the tenant won't fire and the waiting page won't refetch.
3. **Is the waiting page's "Yenile" button calling the hook?** Inspect
   `TenantWaitingScreen.tsx` — it should call `loadWorkspace()`. If it
   only calls a local setter, refreshes won't refetch.

---

## 9. Symptom: "Submitted twice / two AuditLog rows"

Frontend has a `savingStep` guard that prevents simultaneous clicks,
but a slow network + a frustrated user can sneak a double-submit
through if the guard is reset early.

- `tenant-onboarding.service.ts → submit` calls `assertTransition(application.status, 'submitted')`.
  A second call right after the first will hit:
  - `draft → submitted` allowed (first request).
  - `submitted → submitted` NOT allowed (second request) → 400.
- This means a true *double* submit is impossible — the second call
  loses. If you see two AuditLog rows of `onboarding_submitted` for
  the same application, the events are probably one `submit` and one
  later `resubmit` (status went through `revision_required`).

---

## 10. Symptom: "Documents step shows 'completed' but admin can't see a document"

The `documents` step is unusual: each upload calls
`store.upsertStepProgress(applicationId, 'documents', 'completed')`,
so even a single upload completes the step. If admin sees no documents:

1. Inspect `TenantDocument` rows for that `applicationId`. There should
   be one per upload, with `isCurrent = true` for the latest version of
   each `type`.
2. `apps/admin/src/app/documents/page.tsx` queries
   `/api/v1/admin/tenant-documents`. If the admin view is empty:
   - Check the controller filter; today it lists *all* tenant documents
     pending review, scoped to the admin's permission.
   - Check that the document's `status` is `pending` — once approved /
     rejected, it leaves the queue.
3. If the `TenantDocument` row exists but the file is missing from
   disk: `apps/api/src/modules/shared-file-storage/shared-file-storage.service.ts`
   wrote the `FileAsset` row but the upload path is local-disk today.
   `process.cwd()/uploads/tenant-onboarding/<stateToken-or-tenantId>/...`
   is where files land. If the API host changed between upload and
   admin review, the file is on the old host.

---

## 11. Symptom: "Tenant sees /onboarding/welcome instead of /dashboard after approval"

`getTenantOnboardingResumeUrl(workspace)` in
`apps/tenant/src/components/tenant/onboarding/onboarding-routing.ts`
makes the call. It routes to `/dashboard` only when
`workspace.application.status` is `approved` or `active`.

- If the status is `approved` and the resume URL is still onboarding,
  check the workspace JSON in DevTools — the cache might be serving an
  older payload. Hard refresh (clears in-memory cache; not the
  localStorage token).
- If the status is `submitted`, the admin hasn't approved yet — they
  go to `/onboarding/<token>/waiting`. Not a bug.
- `active` requires *two* admin clicks: approve, then activate. Until
  activate, the tenant sees the dashboard but with a "complete setup"
  prompt (`TenantSetPasswordCard`).

---

## 12. Symptom: "We deployed and nothing works on prod"

Quick check in priority order:

1. **`STATE_TOKEN_SECRET` and `JWT_SECRET` env vars** unchanged across
   deploys. If either rotated, every in-flight state token is now a 403.
2. **`TENANT_APP_URL`** correct on the API host — used by
   `sendContinueLinkByStateToken` to build the email link.
3. **`EMAIL_TRANSPORT`** — `log` (the default) means phone codes appear
   in API logs but no email is delivered. Configure a real transport
   before going to actual production.
4. **Database migrations** ran. `apps/api/db/migrations/0021_tenant_onboarding_state_token.sql`
   is the most recent migration that adds load-bearing columns; verify
   it's applied.
5. **Multi-instance backend?** Phone verification is in-memory. Either
   pin onboarding traffic to one instance or move the Maps into the DB
   (see [onboarding-state-model.md](./onboarding-state-model.md) → R1).

---

## 13. Quick reference — every state transition exception

Everything that can throw `BadRequestException` from the service:

| Where                                           | Trigger                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `assertOnboardingTransition`                    | Status change not in `ONBOARDING_STATUS_TRANSITIONS`                   |
| `assertStepKey` / `assertEditableStepKey`       | Unknown step name, or trying to PATCH `final_review` / `documents`     |
| `ensureEditableApplication`                     | Application is in `submitted`, `under_review`, `approved`, `active`, `suspended`, or `rejected` |
| `validateDto`                                   | `class-validator` rejected the body                                    |
| `assertStepReadyForCompletion`                  | Required fields missing for the step                                   |
| `assertReadyForSubmission`                      | At submit time, any required step incomplete or required document missing |
| `verifyPhoneByStateToken` (3 distinct messages) | Expired / too many attempts / wrong code                               |

Everything that can throw `ForbiddenException`:

- `resolveApplicationFromStateToken` (4 reasons) — see §5.

Everything that can throw `ConflictException`:

- `start` — an account exists with this email AND it isn't resumable.

Everything that can throw `NotFoundException`:

- `getOrCreateApplication` — tenant account row missing.
- `sendPhoneVerificationCode*` — tenant account row missing for the
  resolved application.
- `sendContinueLinkByStateToken` — same.

---

## 14. When in doubt

1. Open `AuditLog` and filter by `applicationId` — every status change
   has a row.
2. Open `TenantOnboardingApplication` for the row — `status`,
   `submittedAt`, `currentRevisionNumber`, `tokenSalt`.
3. Open `TenantOnboardingStepProgress` for the rows — one per backend
   step, with `status` + `updatedAt`.
4. Walk the relevant flow in [request-flows.md](./request-flows.md) — if
   you can name which line is failing in that doc, you know exactly
   which file to open next.
