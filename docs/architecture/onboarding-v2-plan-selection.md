# Onboarding V2 Plan Selection

## Stability Pre-flight

Before this slice, the tenant onboarding UI was exercised through `billing-address` and
`plan-selection` in a headless browser with network inspection enabled. Each navigation
settled after two development-mode session resolution requests and produced no
`/workspace` polling loop. The custom plan page also guards its catalog request by
sequence so a React Strict Mode remount or a stale catalog response cannot leave the
cards empty or overwrite a newer token load.

## Step Behavior

`/onboarding/:stateToken/plan-selection` is an explicit V2 custom page. It renders
backend-provided plan cards, requires one selection, and sends the choice only when the
user continues. The page navigates to `review` only after the save response succeeds.

The selection step is represented by the dedicated progress key `membership_plan`;
it is no longer represented by `operations_info`.

## Catalog Strategy

`GET /v2/tenant/onboarding/:stateToken/plans` returns a small static/config-backed
catalog from the API for now. The initial CH/CHF catalog deliberately uses placeholder
commission and fee wording. It does not assert final pricing, service availability, or
contract terms.

The catalog shape includes:

- plan key and display content
- fee and commission summaries
- included services, benefits, and limitations
- recommended state, country, currency, active state, and sort order

This shape can later be fed by setup country/language choices or a database catalog
without turning the custom page into a generic schema renderer.

## Persistence

`TenantOnboardingPlanSelection` stores a selected-plan snapshot:

- `applicationId`
- `planKey`
- `planNameSnapshot`
- `commissionSummarySnapshot`
- `currency`
- `selectedAt`

The API validates that the selected key is active in the current session catalog before
persisting it and completing `membership_plan`.

## Access And Redirects

- `plan-selection` is available only after `billing_address` is complete.
- A locked plan route resolves to `billing-address` or the earlier authoritative step.
- `review` is available only after `membership_plan` is complete.
- Saving a plan returns `nextStep: "review"` and does not submit the application.

`stateToken` validation and the backend-authoritative session resolver remain unchanged.

## Legacy Bridge And Remaining Work

`TenantOnboardingStepPanel` remains for review and submitted/waiting screens. Existing
`operations_info` and document/submission requirements are preserved for compatibility;
the explicit review slice must decide how those remaining legacy requirements are shown
and edited before final submission.

Future slices still need:

- explicit review/edit blocks and submitted/completion pages
- admin review display for selected plan snapshots if required
- country/legal plan catalog expansion and approved commercial copy
