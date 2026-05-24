# Onboarding V2 Bank And Billing

## Pre-flight stability

Before adding Slice 7 pages, the onboarding shell was checked with headless Chrome/CDP against the real tenant runtime. The test opened:

- `business-details`
- `authorized-person`
- `bank-details`

Observed result: `/v2/tenant/onboarding/:stateToken/session?step=...` settled after a small finite number of requests. `/workspace` did not loop. Early `bank-details` access redirected to `authorized-person` without a replace loop.

After the Slice 7 changes, CDP checked:

- `authorized-person`
- `bank-details`
- `billing-address`

Each route settled with finite `/session` requests and no `/workspace` loop.

## Bank-details step

`/onboarding/:stateToken/bank-details` is now an explicit V2 custom page. It collects payout setup data only:

- bank name
- account holder name
- IBAN
- currency

The account holder name is prefilled from legal entity name when available, then authorized person name as a fallback. IBAN validation is intentionally basic and country-ready. No real bank provider integration or hard legal/banking claims are included.

## Billing-address step

`/onboarding/:stateToken/billing-address` is now an explicit V2 custom page. It stores an invoice/billing address snapshot separately from the physical business address:

- same-as-business-address flag
- billing name
- country
- city / region
- postal code
- address line 1
- address line 2

When same-as-business-address is selected, the UI prefills from `business_info` and still saves a billing-address snapshot.

## Persistence

Two minimal DB-backed models were added:

- `TenantOnboardingBankDetail`
- `TenantOnboardingBillingAddress`

Two workflow progress keys were added:

- `bank_details`
- `billing_address`

Existing applications receive missing progress rows through migration `0024_tenant_onboarding_bank_billing.sql`.

## Backend contract

New endpoints:

- `POST /v2/tenant/onboarding/:stateToken/bank-details`
- `POST /v2/tenant/onboarding/:stateToken/billing-address`

Bank details:

- resolves the existing stateToken
- requires editable application status
- requires phone verification, `business_info`, `legal_tax_info`, and `owner_contact_info`
- writes `TenantOnboardingBankDetail`
- completes only `bank_details`
- returns `nextStep: "billing-address"`

Billing address:

- resolves the existing stateToken
- requires the bank prerequisites and completed `bank_details`
- writes `TenantOnboardingBillingAddress`
- completes only `billing_address`
- returns `nextStep: "plan-selection"`

## Redirect rules

Session resolve is still backend-authoritative:

- `bank-details` is allowed only after `owner_contact_info`
- `billing-address` is allowed only after `bank_details`
- `plan-selection` is allowed only after `billing_address`
- opening `bank-details` too early redirects to `authorized-person` or the earlier current step
- opening `billing-address` too early redirects to `bank-details`
- opening `plan-selection` too early redirects to `billing-address`

## Country-pack strategy

The existing onboarding country-pack helper now exposes simple bank and billing label/helper configs. Pages remain custom components; the config only controls labels/help text and basic future-ready defaults such as `CHF`.

## Remaining legacy bridge

`TenantOnboardingStepPanel` still exists for later legacy steps. Canonical `bank-details` and `billing-address` now render explicit V2 components. `plan-selection`, verification, review, and submitted/completion remain future slices.
