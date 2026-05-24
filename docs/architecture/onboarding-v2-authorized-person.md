# Onboarding V2 Authorized Person

## Pre-flight browser stability

Before this slice added a new page, the onboarding shell was checked in headless Chrome through the real tenant frontend runtime. A fresh application was created, phone OTP was completed through the development code path, and the draft was advanced through welcome, location, and address. The browser then opened and refreshed:

- `phone-verification`
- `otp`
- `welcome`
- `location`
- `address`
- `business-details`

Observed result: `/v2/tenant/onboarding/:stateToken/session?step=...` settled after a finite number of requests. In development React mounted twice, so session resolve appeared twice for the same route, but it did not continue indefinitely. `/workspace` did not repeat in the browser measurement. No additional render loop fix was required in this slice.

## Step behavior

`/onboarding/:stateToken/authorized-person` is now a V2 custom page. It collects only owner, authorized representative, or signatory person details:

- full legal name
- contact email
- contact phone
- role or signatory capacity
- optional ownership share

It intentionally does not collect commercial, tax, or registry fields. Those remain owned by the `business-details` step and `legal_tax_info` persistence.

The page uses a small country-pack helper for labels and guidance copy, but the UX remains a custom page instead of a generic schema renderer.

## Persistence

The backend writes to the existing `TenantOwnerContact` table through the existing owner contact store:

- `fullName`
- `email`
- `phoneNumber`
- `roleTitle`
- `ownershipPercentage`

No database migration was added. The step completes `owner_contact_info` only after the required owner contact fields are present. Admin review compatibility is preserved because existing admin surfaces already read `TenantOwnerContact`.

## Backend contract

New endpoint:

`POST /v2/tenant/onboarding/:stateToken/authorized-person`

The endpoint:

- resolves the existing stateToken without changing stateToken validation logic
- requires an editable onboarding application
- requires phone verification
- requires `business_info` completion
- requires `legal_tax_info` completion
- saves owner contact data
- completes only `owner_contact_info`
- returns the updated workspace/session and `nextStep: "bank-details"`

If the user calls the endpoint too early, the response returns the backend redirect step instead of completing owner contact data.

## Redirect rules

Session resolve keeps backend authority:

- `authorized-person` is allowed only after `legal_tax_info` is completed
- if `authorized-person` is opened too early, `redirectStep` remains `business-details` or the earlier current step
- `bank-details` is allowed only after `owner_contact_info` is completed
- after successful save, the next canonical step is `bank-details`

## Remaining legacy bridge

`TenantOnboardingStepPanel` still exists for remaining legacy steps. The canonical `authorized-person` route now renders `AuthorizedPersonStep`, not the legacy owner-contact branch.

Remaining next slices:

- explicit bank details page
- explicit billing address page
- plan selection page
- review/edit page
- submitted/completion page
- real country/legal/identity pack expansion
