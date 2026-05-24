CREATE TABLE IF NOT EXISTS "OrderStatusEvent" (
  "id" UUID NOT NULL PRIMARY KEY,
  "orderId" UUID NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" UUID NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "OrderStatusEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "OrderStatusEvent_orderId_createdAt_idx"
  ON "OrderStatusEvent" ("orderId", "createdAt");
