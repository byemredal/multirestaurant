-- Migration 0018: Seed CHF as a first-class currency.
--
-- The marketplace target market is Switzerland (CHF). Migration 0001 seeds
-- only TRY/EUR/USD/GBP, and CHF previously existed only in the demo seed.
-- Store-settings defaults resolve the platform currency by code, so CHF must
-- exist in every install — not just demo databases — for those defaults to
-- work. This migration is ADDITIVE and idempotent.

INSERT INTO "Currency" ("code", "displayName", "symbol", "numericCode", "decimalDigits", "sortOrder")
VALUES ('CHF', 'Swiss Franc', 'CHF', '756', 2, 5)
ON CONFLICT ("code") DO NOTHING;
