CREATE TABLE IF NOT EXISTS "CustomerSocialAccount" (
  "id" UUID NOT NULL PRIMARY KEY,
  "customerAccountId" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "providerEmail" TEXT,
  "profileFirstName" TEXT,
  "profileLastName" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CustomerSocialAccount_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSocialAccount_provider_providerAccountId_key"
  ON "CustomerSocialAccount" ("provider", "providerAccountId");

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSocialAccount_customerAccountId_provider_key"
  ON "CustomerSocialAccount" ("customerAccountId", "provider");

CREATE INDEX IF NOT EXISTS "CustomerSocialAccount_customerAccountId_idx"
  ON "CustomerSocialAccount" ("customerAccountId");
