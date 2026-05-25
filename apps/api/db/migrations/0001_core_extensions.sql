-- 0001 — Core PostgreSQL extensions.
--
-- Enabled once for every database. The remaining baseline files assume
-- `gen_random_uuid()` is available. On managed Postgres (>= 13) the function
-- ships with pgcrypto; the explicit CREATE EXTENSION makes us portable to
-- minimal images that ship without it pre-enabled.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
