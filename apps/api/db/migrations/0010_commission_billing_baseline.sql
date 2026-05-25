-- 0010 — Commission / billing baseline.
--
-- The full Plan / TenantPlan / StoreEnrollment / OrderCommission model is
-- specified by `ADR-plan-commission-store-model.md` and scheduled for
-- MR-ARCH-04. This baseline file deliberately ships **no tables** so that
-- the MR-ARCH-04 sprint can introduce them as a focused, reviewable slice.
--
-- For the current MVP, plan information chosen by a tenant during onboarding
-- is captured in `TenantOnboardingPlanSelection` (see 0006). It is a
-- selection record, not yet a billing source of truth.
--
-- This file is intentionally a no-op SQL block (a comment-only statement)
-- so the migration runner records it in `schema_migrations` and the file
-- numbering stays stable as MR-ARCH-04 ALTERs land later.

-- no-op
SELECT 1 WHERE FALSE;
