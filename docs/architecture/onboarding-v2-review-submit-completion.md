# Onboarding V2 Review, Requirements, And Completion

## Runtime validation

Slice 9 review was validated after removing stale `apps/tenant/.next` output and starting clean local API and tenant runtimes. A temporary headless Chrome profile was created only under the operating-system temp directory and removed after validation.

- `ReviewStep` rendered persisted V2 summaries, including a masked IBAN and selected plan snapshot.
- Edit actions navigated to the canonical V2 pages and to the retained `verification` document bridge.
- Request monitoring settled with no repeating `/workspace` loop and no ongoing `/session` or `/review` traffic after initial development-mode requests.
- The existing submit endpoint rejected submission while `operations_info` and required documents were incomplete.

## Operations decision

`operations_info` contains meaningful operational input (`primaryCity`, `primaryPostalCode`, `deliveryModel`, pickup support, and optional readiness notes). It is therefore not retired or silently inferred from other V2 data.

The V2 flow now exposes `/onboarding/:stateToken/operations` as a custom page:

- It is available only once `membership_plan` is complete.
- `POST /v2/tenant/onboarding/:stateToken/operations` validates and persists the existing `operations_info` model.
- Completing the page marks only `operations_info` complete and continues to document verification, or back to review when documents already exist.
- Review remains available after plan selection so missing requirements stay visible and editable.

## Documents decision

Required documents remain enforced by the existing submit lifecycle. This slice keeps the working `verification` upload path as a deliberate legacy bridge:

- Review displays missing required documents explicitly.
- The Documents edit action routes to `/verification`.
- Session access permits `/verification` after plan selection, without completing or bypassing documents.

A dedicated V2 document page remains a future migration.

## Submitted route

`/onboarding/:stateToken/submitted` is the canonical terminal page rendered by the custom `SubmittedStep`.

- It displays the stored application status and submission timestamp.
- Reading or refreshing this route does not mutate application status.
- Session resolution allows it only for existing terminal statuses handled by the current lifecycle.
- Opening it before successful submit is redirected by the backend to the currently permitted step.
- `/waiting` remains a compatibility route and redirects terminal applications to `/submitted`.
- The `/waiting` bridge keeps the incoming route token stable and does not persist refreshed tokens returned by read-only workspace reads.

## Lifecycle and country packs

Review submission continues to call the existing safe `POST /v2/tenant/onboarding/:stateToken/submit` endpoint; no alternate submit lifecycle was introduced. Copy on operations and completion pages is placeholder wording suitable for later country/language pack expansion and makes no reviewed legal or commercial promise.

## Remaining work

- Replace the legacy `verification` document bridge with a V2 custom upload page when its document policy is finalized.
- Expand country packs with reviewed operational and completion copy.
- Add end-to-end browser coverage for complete submit and revision lifecycles.
