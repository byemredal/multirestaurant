CREATE TABLE IF NOT EXISTS "CustomerRewardLedger" (
  "id" UUID NOT NULL PRIMARY KEY,
  "customerAccountId" UUID NOT NULL,
  "pointsDelta" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceReferenceId" UUID,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CustomerRewardLedger_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CustomerRewardLedger_customerAccountId_createdAt_idx"
  ON "CustomerRewardLedger" ("customerAccountId", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "StoreStampProgram" (
  "id" UUID NOT NULL PRIMARY KEY,
  "storeId" UUID NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "stampsRequired" INTEGER NOT NULL,
  "rewardTitle" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "StoreStampProgram_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "CustomerStampCard" (
  "id" UUID NOT NULL PRIMARY KEY,
  "customerAccountId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "stampProgramId" UUID NOT NULL,
  "currentStamps" INTEGER NOT NULL DEFAULT 0,
  "isCompleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CustomerStampCard_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "CustomerStampCard_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
  CONSTRAINT "CustomerStampCard_stampProgramId_fkey"
    FOREIGN KEY ("stampProgramId") REFERENCES "StoreStampProgram" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerStampCard_customerAccountId_storeId_key"
  ON "CustomerStampCard" ("customerAccountId", "storeId");
