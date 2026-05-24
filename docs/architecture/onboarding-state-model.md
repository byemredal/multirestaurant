# Tenant Onboarding — State Model & Responsibility Map

Companion to [onboarding-v2-flow.md](./onboarding-v2-flow.md) (architecture)
and [request-flows.md](./request-flows.md) (request traces). The other two
answer *what* gets called and *where the code lives*. This one answers
*who owns which piece of state* and *what each token / URL segment
actually represents*.

Read this first if you are debugging an "it shows the wrong step" bug,
or if you are about to change the workspace shape, the state-token
payload, or the localStorage keys.

---

## 1. Responsibility split — one row, one owner

| Concern                                | Owner    | Backed by                                                            |
| -------------------------------------- | -------- | -------------------------------------------------------------------- |
| Application identity (`applicationId`) | Backend  | `TenantOnboardingApplication.id` (UUID, immutable)                   |
| Application status                     | Backend  | `TenantOnboardingApplication.status` (8-value enum)                  |
| Per-step progress                      | Backend  | `TenantOnboardingStepProgress` rows (one per backend step)           |
| Step *data* (business / legal / etc.)  | Backend  | `Tenant<Step>Detail` tables                                          |
| Documents                              | Backend  | `TenantDocument` + `FileAsset`                                       |
| Phone-verified flag                    | Backend, in-memory | `verifiedPhoneApplications: Map<applicationId, phoneNumber>` |
| Phone challenge (code + expiry)        | Backend, in-memory | `phoneVerificationChallenges: Map<applicationId, …>`      |
| State-token salt                       | Backend  | `TenantOnboardingApplication.tokenSalt` (rotated at terminal states) |
| Current workflow step on the URL       | Frontend | URL segment `[stepSlug]`                                             |
| Workflow ↔ backend step mapping        | Frontend | `apps/tenant/src/components/tenant/onboarding/onboarding-routing.ts` |
| Workspace cache (in-tab, in-memory)    | Frontend | `workspaceCache: Map<string, TenantOnboardingWorkspace>` in `useTenantOnboardingWorkspace.ts` |
| Form-in-progress state                 | Frontend | `useState` inside `TenantOnboardingStepPanel.tsx`                    |
| Last known state-token (rehydration)   | Frontend | `localStorage["auth.tenant-onboarding-state-token"]`                 |
| Continuation token (resume-by-email)   | Frontend | `localStorage["auth.tenant-continuation"]`                           |
| Authenticated session (post-activation)| Frontend | `localStorage["auth.tenant-session"]`                                |

The rule we enforce everywhere: **anything the user could lose by
refreshing the page must live in the backend**. The frontend caches and
optimistic state are convenience only — a hard refresh + cache wipe
must yield the exact same UI as long as the URL and the backend rows
are intact.

---

## 2. What the state token represents

The state token is an **AES-256-GCM-encrypted credential** that proves
the bearer is allowed to act on a specific application instance. It is
*not* a session — it is bound to a single application and rotates
whenever the application reaches a terminal state.

Payload (see `apps/api/src/modules/tenant-onboarding/tenant-onboarding.tokens.ts`):

```ts
type StateTokenPayload = {
  applicationId:   string;  // row id in TenantOnboardingApplication
  tenantAccountId: string;  // owner of the application
  status:          string;  // status at issuance (informational)
  currentStep:     string;  // step at issuance (informational)
  tokenSalt:       string;  // MUST match application.tokenSalt at use-time
};
```

The salt is the load-bearing field. On every request, the server:

1. Decrypts the token (`CryptoUtil.decryptStateToken`).
2. Validates the shape (`validateStateTokenPayload`).
3. Loads `TenantOnboardingApplication` by `applicationId`.
4. Checks `application.tokenSalt === payload.tokenSalt`.

If the salt was rotated server-side (e.g. application moved to a terminal
status by an admin), all previously issued tokens are instantly invalid
and the controller returns `403 Forbidden`.

`status` and `currentStep` in the payload are **snapshots at issuance,
not authoritative**. The authoritative status is always the value on the
row at request time. The frontend should never assume the payload's
`currentStep` matches the URL slug — they can legitimately diverge after
an admin action that re-rotates progress.

### Token refresh lifecycle

A fresh token is built **at the end of every state-mutating request**:

| Endpoint                                                   | Returns new token? |
| ---------------------------------------------------------- | ------------------ |
| `POST /start`                                              | yes                |
| `PATCH /:stateToken/steps/:stepKey`                        | yes                |
| `POST /:stateToken/steps/:stepKey/complete`                | yes                |
| `POST /:stateToken/documents/upload`                       | yes (inside workspace) |
| `POST /:stateToken/submit`                                 | yes (inside workspace) |
| `GET  /:stateToken/workspace`                              | yes (re-issued every read) |
| `POST /:stateToken/phone-verification/{send,verify}`       | only via workspace inside verify response |

The frontend hook (`useTenantOnboardingWorkspace.ts`) writes the latest
token to `currentStateTokenRef`, to `localStorage`, and (via
`writeOnboardingStateToken`) re-uses it on the next call. The URL itself
is **not** rewritten on every save — the in-memory ref is the source of
truth between renders, and the URL is updated only when the user
navigates between steps.

> **Current Risk:** the URL can carry a *stale* but still-valid token
> after a save (because we did not `router.replace`). The user opening
> the page later via "share link" or the browser back button will hit
> the server with the older token. The server accepts it as long as the
> salt still matches, so this is currently safe — but it means the
> in-URL token is not always the same string as the one the next API
> call uses. Don't rely on URL token equality for cache keys.

---

## 3. URL `stepSlug` vs. backend `stepKey`

The single biggest source of confusion in this module. They are two
different vocabularies.

| Frontend `stepSlug` (URL)        | Backend `stepKey`           | Notes                                       |
| -------------------------------- | --------------------------- | ------------------------------------------- |
| `welcome`                        | (none — informational)      | UI-only intro page                          |
| `phone-verification`             | (none — gated by in-memory Map) | Affects `workspace.phoneVerification.verified`, not a backend step |
| `business-intro`                 | (none — informational)      | UI-only "here's what we'll ask" page        |
| `location`                       | `business_info`             | UI asks for company name + address          |
| `business-details`               | `legal_tax_info` AND `owner_contact_info` | One UI page writes two backend records via two PATCH calls |
| `bank-details`                   | (none yet)                  | UI-only; data not persisted to onboarding tables today |
| `plan-selection`                 | `operations_info`           |                                             |
| `verification`                   | `documents`                 | Document uploads                            |
| `review`                         | `final_review`              | Submit gate                                 |
| `waiting`                        | (none — terminal UI route)  | Status-poll page                            |

The mapping is owned by
`apps/tenant/src/components/tenant/onboarding/onboarding-routing.ts`
(`workflowStepByBackendStep`) and the reverse map
(`tenantOnboardingWorkflowStepBySlug`). The backend's only equivalent
is `workflowSlugFromBackendStep` in `tenant-onboarding.tokens.ts`, used
when emailing a "continue here" link — both maps must agree.

> **Current Risk:** `tenantOnboardingWorkflowStepBySlug` accepts both
> kebab-case slugs (`business-info`) AND the canonical workflow slugs
> (`location`). This makes the URL forgiving but means two URLs can
> render the same step. Pick one canonical slug per step before merging
> any new public deeplink (today: `location`, `business-details`,
> `plan-selection`, `verification`, `review`).
>
> **Future Cleanup:** drop the alias keys and 404 on the legacy
> backend-step slugs. Coordinated with whatever emails / external
> deeplinks may have shipped them.

---

## 4. What "source of truth" looks like at each layer

Take a single onboarding application and walk top-to-bottom:

```
Browser URL          /onboarding/<stateToken>/business-details
                          │
                          ▼
localStorage         auth.tenant-onboarding-state-token  ← typically same string,
                                                          can lag if not rewritten
                          │
                          ▼
React state          currentStateTokenRef                ← updated synchronously
                     workspace (cached)                  ← cached snapshot
                     formState (per-field)               ← user-uncommitted
                          │
                          ▼ (HTTP)
                          │
                          ▼
Backend memory       phoneVerificationChallenges Map
                     verifiedPhoneApplications Map
                          │
                          ▼
PostgreSQL           TenantOnboardingApplication ←─────── AUTHORITATIVE for status
                     TenantOnboardingStepProgress ←────── AUTHORITATIVE for step progress
                     Tenant<Step>Detail rows ←─────────── AUTHORITATIVE for step data
                     TenantDocument + FileAsset ←──────── AUTHORITATIVE for documents
```

In one sentence: **the DB rows are the truth, the in-memory Maps are
fragile, and the frontend caches are optional convenience**.

If a render disagrees with the DB, the DB wins, and the fix is in the
frontend.

---

## 5. Frontend state surface

`useTenantOnboardingWorkspace.ts` exposes the following pieces to its
consumers. All are derived from the workspace returned by the backend
plus a small amount of UI-only book-keeping:

| Returned name      | Type                                     | Lifetime                                                   |
| ------------------ | ---------------------------------------- | ---------------------------------------------------------- |
| `workspace`        | `TenantOnboardingWorkspace \| null`      | Set after first successful load; refreshed on every save / complete / submit / SSE-driven `onboardingStatus` change |
| `loading`          | `boolean`                                | True until first workspace lands (cached or fresh)         |
| `error`            | `string \| null`                         | Cleared at start of every action                           |
| `savingStep`       | `TenantOnboardingStepKey \| null`        | `'documents'` while uploading, `step` while saving / completing, `'final_review'` while submitting |
| `lastCheckedAt`    | `Date \| null`                           | Wall-clock of last successful workspace load               |
| `session`          | `StoredTenantSession \| null`            | Pulled from `TenantAuthContext` — present only after activation |

There is **no separate "optimistic" state** for step data: a save call
sets `savingStep`, then awaits the server response, then replaces the
workspace from the server. The UI does not show a step as "saved" until
the server confirmed.

The lone optimistic-ish behaviour is the `workspaceCache` map (module-
scoped, in `useTenantOnboardingWorkspace.ts`): a cache hit renders the
last-known workspace immediately so the page does not flash a spinner
on every back/forward navigation. The hook still refetches in the
background.

> **Current Risk:** the cache map is **module-scoped, not per-route**.
> It persists across navigations to other tenant routes (e.g. the
> waiting page → step page → waiting again). If the workspace shape
> changes in a backend deploy, the cache can serve a stale shape to a
> page that expected the new fields. Mitigation today: every hook
> consumer awaits at least one fresh fetch — the cached value is only
> ever the initial render. But: do not start writing optimistic mutations
> into this cache without invalidating on a deploy version.
>
> **Future Cleanup:** key the cache by `stateToken` + `workspaceVersion`
> and bump the version on every workspace-shape change.

---

## 6. localStorage usage — three distinct keys

`apps/tenant/src/lib/storage/tenant-session.ts` owns three keys:

| Key                                       | Purpose                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `auth.tenant-session`                     | Full `StoredTenantSession` — bearer + CSRF + tenant snapshot. Only present after activation. |
| `auth.tenant-continuation`                | Long-lived continuation token (single-purpose; lets a tenant resume after session expiry).   |
| `auth.tenant-onboarding-state-token`      | Last-known canonical state token for the in-flight application. Read on landing / rehydration. |

Read paths:

- `TenantAuthProvider` reads `auth.tenant-session` on boot.
- The landing page reads `auth.tenant-onboarding-state-token` so
  "Devam et" / continuation banners can preflight a workspace fetch.
- `tenant-status.ts` infers routing from session + onboarding signals.

Write paths:

- `auth.tenant-session` — written by `loginTenant` / `bootstrapTenantSession`.
- `auth.tenant-continuation` — written by `resumeTenantOnboarding`.
- `auth.tenant-onboarding-state-token` — written by
  `rememberStateToken` inside `useTenantOnboardingWorkspace.ts` after
  every successful save / complete / load.

Clear paths:

- `clearTenantSession()` / `clearContinuationToken()` /
  `clearOnboardingStateToken()` from sign-out and "abandon onboarding"
  paths.

> **Current Risk:** `auth.tenant-onboarding-state-token` is not
> cleared when the application reaches a terminal status (approved /
> active / suspended). A signed-out tenant rehydrating the landing page
> can briefly try to load a workspace with an invalid token and see a
> 403 in DevTools. Visually harmless (UI falls back to the landing
> form), but noisy.
>
> **Future Cleanup:** in `useTenantOnboardingWorkspace`, when
> `application.status` lands in `{approved, active, suspended}`, call
> `clearOnboardingStateToken()`.

---

## 7. What changes vs. what doesn't on each action

| Action                           | URL change? | localStorage change? | workspace cache change? | DB rows changed |
| -------------------------------- | ----------- | -------------------- | ----------------------- | ---------------- |
| Open `/onboarding/[token]/[slug]`| no          | yes (token rememb.)  | yes (fresh fetch)       | none             |
| Save step (PATCH)                | no          | yes (token rotated)  | yes (refetch)           | `Tenant<Step>Detail`, `TenantOnboardingStepProgress` |
| Complete step                    | typically yes (user navigates next) | yes (token rotated)  | yes (refetch)           | `TenantOnboardingStepProgress` |
| Upload document                  | no          | yes (token rotated)  | yes (from response)     | `TenantDocument`, `FileAsset`, `TenantOnboardingStepProgress` |
| Phone send/verify                | no          | usually no (no token in response) | yes (verify includes workspace) | in-memory Maps + (verify) workspace refresh |
| Submit                           | yes (→ waiting) | yes (token rotated)  | yes (from response)     | `TenantOnboardingApplication`, `TenantOnboardingStepProgress`, `TenantAccount`, `AuditLog` |

---

## 8. Risks summary

| ID  | Risk                                                                                           | Severity | Suggested fix                                                                                        |
| --- | ---------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| R1  | Phone verification state is in-memory; server restart loses challenges + verified markers      | HIGH for HA, OK for single-instance | Persist on `TenantOnboardingApplication` (`phoneVerifiedAt`, `phoneNumber`) and store the challenge in `TenantOnboardingPhoneChallenge` row |
| R2  | URL `stateToken` can lag the in-memory ref after a save                                        | LOW | `router.replace` after every save, OR document explicitly that URL token may be stale                |
| R3  | `tenantOnboardingWorkflowStepBySlug` accepts duplicate slugs (alias)                           | LOW | Pick canonical slugs, 404 the aliases                                                                |
| R4  | `workspaceCache` is module-scoped and never invalidated by version                             | MED | Add a `workspaceVersion` field, invalidate on bump                                                   |
| R5  | `auth.tenant-onboarding-state-token` not cleared on terminal status                            | LOW | Call `clearOnboardingStateToken()` when application status enters terminal set                       |
| R6  | `TenantOnboardingStepPanel.tsx` shares local state across all step branches in one file        | MED | See [onboarding-step-panel-split-plan.md](./onboarding-step-panel-split-plan.md)                     |
| R7  | Session/`me` onboarding helpers still imported by hook + waiting screen                        | LOW | Switch both consumers to `*ByStateToken`, then delete @deprecated helpers + `me/*` routes            |

None of these block shipping. They are the queue of follow-up tickets
the next onboarding sprint should pull from.

---

## 9. Mental model in one paragraph

A tenant onboarding session is fully described by **one DB row**
(`TenantOnboardingApplication`) plus its dependent rows. The state
token is just a stateless capability to act on that row — losing it
means signing back in or being re-issued a continuation link.
Everything in the browser (URL slug, form fields, cache, localStorage)
is a hint about what the user is looking at right now; on a hard refresh
those hints rebuild themselves from a single `GET /workspace` call. The
in-memory phone Maps are the only piece of backend state that is not in
the DB, and they should be the first thing moved when this surface
scales horizontally.
