# Onboarding V2 Session Resolve Contract

## Purpose

The onboarding URL may request a step, but the backend now decides whether
that step can render. This prevents the browser from showing a locked or stale
step while the workspace is still being resolved.

The contract is intentionally small and compatible with the current legacy
workspace UI. It is a foundation for later custom page onboarding, not a full
visual rewrite.

## Endpoint

```http
GET /api/v1/v2/tenant/onboarding/:stateToken/session?step=:requestedStep
```

The endpoint:

- resolves and validates the existing encrypted `stateToken`
- loads the existing workspace-compatible onboarding data
- derives completed steps from database step progress
- derives allowed steps from database progress and phone verification state
- normalizes old aliases where safe
- returns `redirectStep` when the requested step is invalid or locked
- returns a minimal `countryPack` snapshot

The existing `GET /workspace`, draft save, complete, upload, and submit
endpoints remain in place.

## Step Fields

`requestedStep` is the normalized version of the URL step when known. If the
URL contains an unknown step, the response keeps the original value and returns
`redirectStep`.

`currentStep` is the backend-derived step the user should currently work on.
It does not come from the state-token payload.

`redirectStep` is `null` when the requested step can render. Otherwise the
frontend must `router.replace` to the returned step and keep showing a loading
state until the next session resolve completes.

## State Token Rule

The `currentStep` inside the encrypted state-token payload is informational
only. The authoritative state is:

- `TenantOnboardingApplication.status`
- `TenantOnboardingStepProgress`
- step detail tables
- document rows
- the current phone verification marker

The token still remains the capability credential and the token-salt validation
logic is unchanged.

## Current Legacy Bridge

The V2 canonical registry includes future steps such as `otp`, `address`,
`billing-address`, and `submitted`. The current legacy renderer does not have
custom pages for all of them yet, so the shell bridges them carefully:

- `otp` renders the current phone verification panel
- `address` renders the current location/business address panel
- `billing-address` renders the current bank placeholder panel
- `submitted` maps to the existing waiting/status route

`authorized-person` is now distinct and maps to `owner_contact_info`.
`business-details` maps only to `legal_tax_info`.

## Known Remaining Gaps

- Phone send and OTP entry are still one legacy panel.
- Most step routes still rely on the parent layout and large branch renderer.
- Bank details are not persisted yet.
- Billing address is not persisted yet.
- Plan selection still persists through `operations_info`, not a plan model.
- Country/legal packs are placeholders and need expansion.
- Review/edit blocks are not implemented yet.
- The legacy `verification` document step remains until country-specific
  document requirements are designed.
