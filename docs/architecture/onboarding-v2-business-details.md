# Onboarding V2 Business Details Slice

## Render Loop Fix

The flicker/request loop came from state-token churn. The backend intentionally
builds a fresh encrypted state token on workspace/session responses because the
token includes a random IV and an `issuedAt` value.

The frontend hook treated every fresh read-only token as the new
`currentStateToken`. Because `currentStateToken` was a dependency of the
session resolve callback, `/session?step=...` could run again after every
successful resolve, producing another token and another resolve.

The fix keeps backend authority but separates read-only session resolution from
token persistence:

- session/workspace read responses no longer update the hook's request token
- mutation responses can still remember the returned token
- a `lastResolvedKey` guard prevents resolving the same
  `stateToken:requestedStep` repeatedly
- stale request sequencing still prevents older responses from replacing newer
  workspace state
- `router.replace` is guarded so the same target URL is not replaced repeatedly

The repeating request was expected to be
`GET /v2/tenant/onboarding/:stateToken/session?step=...`, with possible
follow-on workspace reads from background refreshes after mutations.

## Business Details Step

`/onboarding/:stateToken/business-details` is now an explicit V2 custom
component. It is rendered only after backend session resolve allows the step.

The page collects commercial/legal/tax registration information only. Owner or
authorized-person fields remain separate.

## Progressive Reveal

Initial state shows only the registration number input. The user must run the
mock registration check before the rest of the form is shown.

The mock check endpoint is:

```http
POST /v2/tenant/onboarding/:stateToken/business-details/verify-registration
```

No real tax authority or commercial registry integration is performed in this
slice.

## Persistence Model

The final save endpoint is:

```http
POST /v2/tenant/onboarding/:stateToken/business-details
```

It writes to the existing `TenantLegalDetail` / `legal_tax_info` model:

- registered business name -> `legalEntityName`
- tax number or registration number -> `taxId`
- VAT number -> `vatId`
- registration country -> `registrationCountry`
- registered address -> `registeredAddress`

`legal_tax_info` is marked complete only after required fields validate.

## Country-Pack Strategy

The frontend includes a small `onboarding-country-pack.ts` helper for labels,
required flags, and help text. This is not a generic schema renderer; the page
remains custom. The helper defaults to CH/de-CH/CHF data from session resolve
and uses placeholder labels that must be legally reviewed before production.

## Redirect Rules

Session resolve remains authoritative:

- `business-details` is allowed only after `business_info` is completed by the
  address step.
- Before address completion, `business-details` redirects to `address`.
- `authorized-person` remains locked until `legal_tax_info` is complete.
- After saving business details, the backend returns `authorized-person`.
- Terminal submitted/waiting status rules remain unchanged.

## Remaining Legacy Bridges

- `authorized-person` and later steps still use legacy or bridge components.
- Real commercial registry/tax authority integration is deferred.
- Country-pack validation is placeholder-only.
- The existing `TenantLegalDetail` model does not store every future commercial
  concept separately.
