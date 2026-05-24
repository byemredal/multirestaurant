# Onboarding V2 Welcome and Location Slice

## Welcome Step

`/onboarding/:stateToken/welcome` is an explicit V2 custom component. It is
allowed only after phone verification is complete through the backend session
resolve contract.

Continue calls:

```http
POST /v2/tenant/onboarding/:stateToken/welcome/complete
```

The welcome step is informational and does not create a separate workflow row.
The backend still participates so the frontend does not route optimistically.

## Location Step

`/onboarding/:stateToken/location` is an explicit V2 custom component. It first
shows only a location search/manual input plus country code. No map provider is
integrated in this slice.

Continue calls:

```http
POST /v2/tenant/onboarding/:stateToken/location
```

The persisted draft shape is:

```json
{
  "locationLabel": "...",
  "latitude": null,
  "longitude": null,
  "country": "CH",
  "city": null,
  "postalCode": null,
  "rawInput": "..."
}
```

## Location vs Address

Location selection is stored in `TenantOnboardingLocationSelection`. Full
address fields still live in the legacy `TenantBusinessDetail` / `business_info`
step.

This separates the V2 concepts without breaking the existing admin review and
business-info flow:

- `location` means search/selection.
- `address` means full address fields.
- `address` is allowed after a location selection exists.
- `address` currently bridges to the legacy business-info panel until a custom
  address page lands.

## redirectStep Rules

Session resolve remains authoritative:

- Before phone verification, `welcome`, `location`, and `address` redirect to
  `phone-verification` or `otp`.
- After phone verification, `welcome` and `location` are allowed.
- `address` is locked until location selection is saved.
- Opening `address` too early redirects to `location`.

## Remaining Legacy Bridges

- Full address fields are still rendered by the legacy `TenantOnboardingStepPanel`.
- `business_info` is not completed by location selection alone.
- Map/geocoding provider integration is deferred.
- Country/legal/schema-pack driven address fields are deferred.

## Next Slices

- Custom address page.
- Business/commercial details page with country-pack fields.
- Authorized person page refinement.
- Bank/billing/plan/review custom pages.
