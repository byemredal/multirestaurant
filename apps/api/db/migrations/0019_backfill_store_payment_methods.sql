-- 0019 — Backfill canonical StorePaymentMethod assignments.
--
-- Payment methods are seeded per store into StorePaymentMethod, which is the
-- canonical source checkout/order readiness reads. Stores created before this
-- was wired up have NO assignments, so checkout used to block with
-- NO_ACTIVE_PAYMENT_METHOD until self-healed, and the tenant settings page
-- showed no payment toggles.
--
-- This migration is a one-shot, IDEMPOTENT, NON-DESTRUCTIVE backfill:
--   * Only stores with ZERO assignments are touched (admin/tenant config kept).
--   * Pay-on-delivery methods (cash, credit_card) are seeded active.
--   * Provider-backed methods (online_card, meal_card, wallet) are seeded
--     inactive until a payment provider is configured.
--   * ON CONFLICT DO NOTHING + the "no existing rows" guard keep re-runs safe.
--
-- No rows are deleted or updated; only inserts for stores missing assignments.

INSERT INTO "StorePaymentMethod" (
  "id", "storeId", "paymentMethodId", "customLabel", "isActive", "sortOrder",
  "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  s."id",
  pm."id",
  NULL,
  CASE pm."code"
    WHEN 'cash'        THEN TRUE
    WHEN 'credit_card' THEN TRUE
    ELSE FALSE
  END,
  CASE pm."code"
    WHEN 'cash'        THEN 0
    WHEN 'credit_card' THEN 1
    WHEN 'online_card' THEN 2
    WHEN 'meal_card'   THEN 3
    WHEN 'wallet'      THEN 4
    ELSE 9
  END,
  NOW(),
  NOW()
FROM "Store" s
CROSS JOIN "PaymentMethod" pm
WHERE pm."isActive" = TRUE
  AND pm."code" IN ('cash', 'credit_card', 'online_card', 'meal_card', 'wallet')
  AND NOT EXISTS (
    SELECT 1 FROM "StorePaymentMethod" existing
    WHERE existing."storeId" = s."id"
  )
ON CONFLICT ("storeId", "paymentMethodId") DO NOTHING;
