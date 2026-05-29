-- 0018 — Backfill canonical StoreServiceType assignments.
--
-- Service types (delivery / pickup / dine_in) are seeded per store into the
-- StoreServiceType table, which is the canonical source the cart reads. Stores
-- created before this was wired up have NO assignments, so:
--   * add-to-cart used to 409 ("no active service types") until self-healed, and
--   * the public store API returns an empty serviceTypes[] until then.
--
-- This migration is a one-shot, IDEMPOTENT, NON-DESTRUCTIVE backfill:
--   * It only touches stores that currently have ZERO assignments — any store
--     an admin/tenant already configured is left completely untouched.
--   * It derives delivery/pickup active flags from StoreOrderingPolicy when one
--     exists, otherwise falls back to the product default (both active).
--   * dine_in is seeded inactive (out of product scope for now).
--   * ON CONFLICT DO NOTHING + the "no existing rows" guard make re-runs safe.
--
-- No rows are deleted or updated; only inserts for stores missing assignments.

INSERT INTO "StoreServiceType" (
  "id", "storeId", "serviceTypeId", "customLabel", "isActive", "sortOrder",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  s."id",
  st."id",
  NULL,
  CASE st."code"
    WHEN 'pickup'   THEN COALESCE(op."acceptsPickup", TRUE)
    WHEN 'delivery' THEN COALESCE(op."acceptsDelivery", TRUE)
    ELSE FALSE
  END,
  CASE st."code"
    WHEN 'pickup'   THEN 0
    WHEN 'delivery' THEN 1
    ELSE 2
  END,
  NOW(),
  NOW()
FROM "Store" s
CROSS JOIN "ServiceType" st
LEFT JOIN "StoreOrderingPolicy" op ON op."storeId" = s."id"
WHERE st."isActive" = TRUE
  AND st."code" IN ('pickup', 'delivery', 'dine_in')
  AND NOT EXISTS (
    SELECT 1 FROM "StoreServiceType" existing
    WHERE existing."storeId" = s."id"
  )
ON CONFLICT ("storeId", "serviceTypeId") DO NOTHING;
