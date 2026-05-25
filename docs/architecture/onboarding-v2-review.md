# Onboarding V2 Review

## Stability Pre-flight

Slice 9 preserved the stable session-resolve contract from the earlier render-loop fix.
The local API on port `4000` returned finite, authoritative redirects for direct
`plan-selection` and `review` requests made against a new locked application:
both resolved to `phone-verification`.

A browser re-check was attempted before implementation. The `localhost:3060` route
was served by an older Next runtime with a missing `.next/vendor-chunks` module, and
an isolated `3061` runtime CDP navigation did not complete within the bounded timeout.
No new repeated `/session` or `/workspace` request was observed, but full visual
stability verification remains to be repeated after the local runtime collision is
cleaned up.

## Review Step

`/onboarding/:stateToken/review` now renders an explicit `ReviewStep` component.
It requests a read-only review summary after the authoritative session resolver has
allowed the route. The page displays separate summary blocks for:

- phone/contact verification
- location selection
- business address
- commercial/legal/tax details
- authorized person
- bank details
- billing address
- selected plan snapshot
- remaining legacy operations/document requirements

The API masks the IBAN before sending review data. Missing persisted values remain
visible in the page instead of being omitted.

## API Contract

New endpoint:

- `GET /v2/tenant/onboarding/:stateToken/review`

The endpoint resolves the existing state token, requires completed
`membership_plan` for access, and returns:

- `redirectStep` when review is still locked
- `canSubmitForReview`
- `missingRequiredBlocks`
- canonical edit targets
- review summary data assembled from the existing persisted onboarding records

Final submission reuses the existing endpoint:

- `POST /v2/tenant/onboarding/:stateToken/submit`

No duplicate submit lifecycle was added. The existing service continues to set the
application status, complete `final_review`, update tenant compliance status, and
write the audit event.

## Summary Data Sources

Review data is read from the existing V2 persistence surfaces:

- phone verification state
- `TenantOnboardingLocationSelection`
- `TenantBusinessDetail`
- `TenantLegalDetail`
- `TenantOwnerContact`
- `TenantOnboardingBankDetail`
- `TenantOnboardingBillingAddress`
- `TenantOnboardingPlanSelection`
- current document records and `operations_info` progress for legacy requirements

No database migration is required for this slice.

## Edit Routing

Each migrated summary block links to its canonical V2 route. Edit navigation remains
subject to `GET /session?step=...`; the frontend does not grant access locally.
The remaining document requirement links to the existing `verification` route.

## Remaining Legacy Requirements

The current submit lifecycle still requires completed `operations_info` and at least
one required current document. Slice 9 does not silently remove or auto-complete
either requirement. The review page exposes both as remaining requirements and
disables submit while they are missing.

After `membership_plan` completes, `verification` is permitted so required documents
can still be uploaded through the legacy page. A dedicated V2 decision for collecting
or retiring `operations_info` is still required before brand-new V2 applications can
submit without legacy seeded data.

## Redirect Rules

- `review` remains locked until `membership_plan` is completed.
- Opening a locked review route resolves to the backend-calculated current step.
- Opening `submitted`/waiting before successful submit remains locked by the existing
  session/status rules.
- The review summary request is read-only and does not rotate the URL token or
  advance application status.

## Remaining Slices

- decide and implement the V2 handling of legacy `operations_info`
- explicit documents/consent page if documents remain required
- explicit submitted/waiting completion page
- final browser stability pass after the local runtime conflict is resolved
