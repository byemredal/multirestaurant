-- 0016 — Persist provider metadata on TenantOnboardingLocationSelection.
--
-- Partner application form (apps/tenant) now ships an autocomplete-backed
-- address picker. The selected suggestion includes provider-side metadata
-- (place id, normalized street, etc.) that previously did not survive the
-- POST /v2/tenant/onboarding/start call. Adding the columns here keeps the
-- legal/audit trail (we now know which provider gave us the address) and
-- preserves the normalized parts so downstream onboarding steps don't have
-- to re-geocode the same input.
--
-- Columns are nullable: the table is also written from the unauthenticated
-- onboarding location step which still allows a manual string. The
-- application service writes `provider = 'manual'` for free-text submissions
-- and `provider = 'locationiq'` (or future providers) when a suggestion is
-- chosen.

ALTER TABLE "TenantOnboardingLocationSelection"
  ADD COLUMN IF NOT EXISTS "street" TEXT;

ALTER TABLE "TenantOnboardingLocationSelection"
  ADD COLUMN IF NOT EXISTS "provider" TEXT;

ALTER TABLE "TenantOnboardingLocationSelection"
  ADD COLUMN IF NOT EXISTS "providerPlaceId" TEXT;
