# Onboarding V2 Phone and OTP Slice

## Phone Verification Step

`/onboarding/:stateToken/phone-verification` is now an explicit V2 step
component. It reads the resolved onboarding session/workspace and shows the
phone number seeded from the original owner contact data when available.

The page only navigates to `otp` after the backend send-code request succeeds.
It does not optimistically advance.

## OTP Step

`/onboarding/:stateToken/otp` is now an explicit V2 step component. It renders
only after the session resolve endpoint allows the requested step. The OTP input
supports numeric mobile keyboards and paste.

Wrong codes keep the user on the OTP page with an inline error. Successful
verification applies the returned workspace and routes to the backend response
step, currently `welcome`.

## Persistence Decision

Phone verification challenges are persisted in
`TenantOnboardingPhoneVerification` instead of in-memory service maps. The row
stores:

- phone number
- hashed OTP code
- expiry
- attempt and resend counters
- last sent timestamp
- verified timestamp

The OTP code itself is not stored as plain text.

## Dev OTP Behavior

The backend returns `debugCode` only outside production or when email log
transport is active. The frontend shows it only behind development-safe copy and
does not present it as production SMS behavior.

## redirectStep Rules

Session resolve remains authoritative:

- `phone-verification` is allowed before verification.
- `otp` is allowed only while an unexpired code is pending.
- `welcome` is locked until phone verification succeeds.
- Opening `otp` too early redirects to `phone-verification`.
- Opening `welcome` too early redirects to `phone-verification` or `otp`,
  depending on whether a pending OTP challenge exists.
- Opening phone/otp after verification redirects to the current backend step.

## Remaining Limitations

- Real SMS provider integration is still not implemented.
- Rate limiting is basic: expiry, resend count, and attempt count exist, but no
  global abuse throttling has been added.
- The legacy phone branch still exists in `TenantOnboardingStepPanel` for
  compatibility but is no longer used by canonical phone/otp routes.
- The rest of onboarding still uses the legacy panel until future slices split
  custom pages.
