-- 0012 — Dev / test seed slot (reserved).
--
-- Dev / demo data lives in `apps/api/db/seeds/demo-seed.sql` and is applied
-- by `pnpm db:seed`. It is intentionally NOT a migration so production
-- installs don't accumulate demo rows by running `db:migrate`.
--
-- Reference data the runtime requires on every install — currencies,
-- languages, payment methods, service types, cuisines, legal document
-- types — is already seeded inline in 0004 + 0005 + 0007.
--
-- This file exists only to reserve the numbered slot for future
-- migration-time seeds (e.g. minimal CH legal documents once the legacy
-- LegalDocument table is retired).

-- no-op
SELECT 1 WHERE FALSE;
