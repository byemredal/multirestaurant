-- Migration 0014: System bootstrap lifecycle state.
-- A single-row table that tracks where the platform is in its one-time
-- bootstrap: UNINITIALIZED -> INITIALIZING -> READY. The CHECK constraints
-- pin the table to one canonical row and a known set of states.
--
-- If a platform was already bootstrapped before this migration, the row is
-- seeded as READY so setup stays correctly closed.

CREATE TABLE IF NOT EXISTS "SystemState" (
  "id" TEXT PRIMARY KEY DEFAULT 'system' CHECK ("id" = 'system'),
  "state" TEXT NOT NULL DEFAULT 'UNINITIALIZED'
    CHECK ("state" IN ('UNINITIALIZED', 'INITIALIZING', 'READY')),
  "initializingStartedAt" TIMESTAMPTZ,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO "SystemState" ("id", "state", "updatedAt")
VALUES (
  'system',
  CASE
    WHEN EXISTS (SELECT 1 FROM "PlatformSetup") THEN 'READY'
    ELSE 'UNINITIALIZED'
  END,
  NOW()
)
ON CONFLICT ("id") DO NOTHING;
