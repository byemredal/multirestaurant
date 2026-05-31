-- 0021 — Public storefront discovery index (MR-DB-HARDENING-01 Slice 4).
--
-- Indexes-only pass. No data mutation, no table/constraint drops, no business
-- logic. Adds exactly one missing, query-supported index.
--
-- After Slice 1 the live public storefront list (StoresService.listPublic)
-- scans "Store" with the always-applied predicate
--     WHERE "status" = 'active' AND "isActive" = TRUE
-- and (default / 'newest' sorts) orders by "createdAt" DESC. The only existing
-- "Store" indexes are the slug UNIQUE and ("ownerTenantId","createdAt") — neither
-- serves this public scan, so every storefront browse sequential-scans "Store".
--
-- A PARTIAL index over only the publicly-listable rows keeps the index small
-- (drafts / inactive stores excluded) and serves both the filter and the
-- createdAt ordering. acceptingOrders is deliberately NOT in the predicate:
-- listPublic reflects that flag in the response (Slice 1) but does not filter
-- rows by it, and the /discover path is id-driven (candidate ids resolved via
-- the already-indexed coverage tables), so it needs no Store status index.
--
-- LOCK / CONCURRENCY: the migration runner wraps each file in a single
-- transaction, so CREATE INDEX CONCURRENTLY is NOT usable here. A plain
-- CREATE INDEX takes a SHARE lock (blocks writes) on "Store" while it builds.
-- "Store" is small in this product, so the impact is negligible. If this is
-- ever applied to a very large "Store" table, build it out-of-band with
-- CREATE INDEX CONCURRENTLY (outside a transaction) instead.

CREATE INDEX IF NOT EXISTS "IDX_Store_public_active_createdAt"
  ON "Store" ("createdAt" DESC)
  WHERE "status" = 'active' AND "isActive" = TRUE;
