# Onboarding V2 Address Slice

## Address Step

`/onboarding/:stateToken/address` is now an explicit V2 custom component. It is
rendered only after the backend session resolve endpoint allows the requested
step.

The page shows the selected `locationSelection` summary and then full address
fields. It uses generic Switzerland-compatible labels until country/language
packs provide field copy and validation rules.

## Persistence Model

The address step saves into the existing `TenantBusinessDetail` /
`business_info` persistence model so admin review and existing business detail
surfaces remain compatible.

The endpoint is:

```http
POST /v2/tenant/onboarding/:stateToken/address
```

Required fields:

- `country`
- `city`
- `postalCode`
- `addressLine1`

Optional detail fields such as building, floor, door, and address note are
currently composed into `addressLine2` because the existing business detail
model does not yet have dedicated columns.

## Location vs Address

`TenantOnboardingLocationSelection` remains separate from full address data.
Location selection alone does not complete `business_info`.

- `location` means search/selection.
- `address` means full address fields.
- `business_info` is completed only after address save validates required data.

## redirectStep Rules

Session resolve remains authoritative:

- Before phone verification, address redirects through the phone/OTP gate.
- Before location selection, address redirects to `location`.
- After location selection but before full address completion, current step is
  `address`.
- `business-details` is locked until `business_info` is completed by address.
- Submitted/waiting terminal states continue to use the existing status rules.

## Remaining Legacy Bridges

- `business-details` and later steps still render through the legacy panel.
- Country-pack driven address fields are not implemented yet.
- Real map/geocoding provider integration is still deferred.
- Dedicated address columns for building/floor/door/note are deferred.

## Next Slices

- Custom business/commercial details page.
- Country-pack field definitions and validation expansion.
- Authorized person refinement.
- Bank, billing, plan selection, review, and submitted pages.
