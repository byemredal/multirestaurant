-- 0009 — Cart, ordering, payment, store reviews.
--
-- Order carries the fulfillment-snapshot columns (delivery address JSON,
-- customer phone, courier notes) inline — what the old 0020 ALTER added.
-- StoreReview lives here rather than in the catalog file because it FKs to
-- Order, which is created here.

-- ===========================================================================
-- Cart
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Cart" (
  "id" UUID NOT NULL PRIMARY KEY,
  "customerAccountId" UUID NOT NULL UNIQUE,
  "storeId" UUID NOT NULL,
  "subtotalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currencyId" UUID,
  "currencySnapshot" TEXT NOT NULL,
  "serviceTypeId" UUID,
  "serviceTypeSnapshot" VARCHAR(40) NOT NULL,
  "paymentMethodId" UUID,
  "paymentMethodSnapshot" VARCHAR(40),
  "deliveryDistanceKm" NUMERIC(6,2),
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Cart_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE CASCADE,
  CONSTRAINT "Cart_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE CASCADE,
  CONSTRAINT "Cart_currencyId_fkey"
    FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE SET NULL,
  CONSTRAINT "Cart_serviceTypeId_fkey"
    FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType" ("id") ON DELETE SET NULL,
  CONSTRAINT "Cart_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod" ("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Cart_storeId_idx" ON "Cart" ("storeId");

CREATE TABLE IF NOT EXISTS "CartItem" (
  "id" UUID NOT NULL PRIMARY KEY,
  "cartId" UUID NOT NULL,
  "menuItemId" UUID NOT NULL,
  "itemNameSnapshot" TEXT NOT NULL,
  "unitBasePriceSnapshot" DOUBLE PRECISION NOT NULL,
  "currencySnapshot" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lineBaseTotal" DOUBLE PRECISION NOT NULL,
  "lineOptionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lineTotal" DOUBLE PRECISION NOT NULL,
  "selectionSignature" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CartItem_cartId_fkey"
    FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE CASCADE,
  CONSTRAINT "CartItem_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT,
  CONSTRAINT "CartItem_cartId_menuItemId_selectionSignature_key"
    UNIQUE ("cartId", "menuItemId", "selectionSignature")
);

CREATE INDEX IF NOT EXISTS "CartItem_cartId_createdAt_idx"
  ON "CartItem" ("cartId", "createdAt");
CREATE INDEX IF NOT EXISTS "CartItem_menuItemId_idx" ON "CartItem" ("menuItemId");

CREATE TABLE IF NOT EXISTS "CartItemOptionSelection" (
  "id" UUID NOT NULL PRIMARY KEY,
  "cartItemId" UUID NOT NULL,
  "optionGroupId" UUID NOT NULL,
  "optionItemId" UUID NOT NULL,
  "optionGroupNameSnapshot" TEXT NOT NULL,
  "optionItemNameSnapshot" TEXT NOT NULL,
  "optionPriceDeltaSnapshot" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "CartItemOptionSelection_cartItemId_fkey"
    FOREIGN KEY ("cartItemId") REFERENCES "CartItem" ("id") ON DELETE CASCADE,
  CONSTRAINT "CartItemOptionSelection_optionGroupId_fkey"
    FOREIGN KEY ("optionGroupId") REFERENCES "MenuOptionGroup" ("id") ON DELETE RESTRICT,
  CONSTRAINT "CartItemOptionSelection_optionItemId_fkey"
    FOREIGN KEY ("optionItemId") REFERENCES "MenuOptionItem" ("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "CartItemOptionSelection_cartItemId_idx"
  ON "CartItemOptionSelection" ("cartItemId");
CREATE INDEX IF NOT EXISTS "CartItemOptionSelection_optionGroupId_idx"
  ON "CartItemOptionSelection" ("optionGroupId");
CREATE INDEX IF NOT EXISTS "CartItemOptionSelection_optionItemId_idx"
  ON "CartItemOptionSelection" ("optionItemId");

-- ===========================================================================
-- Order — fulfillment-snapshot columns baked in (no follow-up ALTER needed)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Order" (
  "id" UUID NOT NULL PRIMARY KEY,
  "customerAccountId" UUID NOT NULL,
  "storeId" UUID NOT NULL,
  "status" TEXT NOT NULL,
  "rejectedReason" TEXT,
  "statusNote" TEXT,
  "lastStatusChangedAt" TIMESTAMPTZ,
  "lastStatusChangedByType" TEXT,
  "subtotalAmount" DOUBLE PRECISION NOT NULL,
  "totalAmount" DOUBLE PRECISION NOT NULL,
  "currencyId" UUID,
  "currencySnapshot" TEXT NOT NULL,
  "serviceTypeId" UUID,
  "serviceTypeSnapshot" VARCHAR(40) NOT NULL,
  "paymentMethodId" UUID,
  "paymentMethodSnapshot" VARCHAR(40),
  "deliveryFeeAmount" NUMERIC(10,2) NOT NULL DEFAULT 0,
  "deliveryDistanceKm" NUMERIC(6,2),
  -- Fulfillment snapshot (frozen at order time): preserves the customer's
  -- delivery address + phone + notes even if their profile changes later.
  "deliveryAddressSnapshotJson" JSONB,
  "customerPhoneSnapshot" TEXT,
  "courierNotes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Order_customerAccountId_fkey"
    FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount" ("id") ON DELETE RESTRICT,
  CONSTRAINT "Order_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT,
  CONSTRAINT "Order_currencyId_fkey"
    FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE SET NULL,
  CONSTRAINT "Order_serviceTypeId_fkey"
    FOREIGN KEY ("serviceTypeId") REFERENCES "ServiceType" ("id") ON DELETE SET NULL,
  CONSTRAINT "Order_paymentMethodId_fkey"
    FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod" ("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "Order_customerAccountId_createdAt_idx"
  ON "Order" ("customerAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_storeId_createdAt_idx"
  ON "Order" ("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_storeId_status_createdAt_idx"
  ON "Order" ("storeId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" UUID NOT NULL PRIMARY KEY,
  "orderId" UUID NOT NULL,
  "menuItemId" UUID NOT NULL,
  "itemNameSnapshot" TEXT NOT NULL,
  "unitBasePriceSnapshot" DOUBLE PRECISION NOT NULL,
  "currencySnapshot" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lineBaseTotal" DOUBLE PRECISION NOT NULL,
  "lineOptionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lineTotal" DOUBLE PRECISION NOT NULL,
  "selectionSignature" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "OrderItem_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE,
  CONSTRAINT "OrderItem_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem" ("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_createdAt_idx"
  ON "OrderItem" ("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderItem_menuItemId_idx" ON "OrderItem" ("menuItemId");

CREATE TABLE IF NOT EXISTS "OrderItemOptionSelection" (
  "id" UUID NOT NULL PRIMARY KEY,
  "orderItemId" UUID NOT NULL,
  "optionGroupId" UUID NOT NULL,
  "optionItemId" UUID NOT NULL,
  "optionGroupNameSnapshot" TEXT NOT NULL,
  "optionItemNameSnapshot" TEXT NOT NULL,
  "optionPriceDeltaSnapshot" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "OrderItemOptionSelection_orderItemId_fkey"
    FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE,
  CONSTRAINT "OrderItemOptionSelection_optionGroupId_fkey"
    FOREIGN KEY ("optionGroupId") REFERENCES "MenuOptionGroup" ("id") ON DELETE RESTRICT,
  CONSTRAINT "OrderItemOptionSelection_optionItemId_fkey"
    FOREIGN KEY ("optionItemId") REFERENCES "MenuOptionItem" ("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "OrderItemOptionSelection_orderItemId_idx"
  ON "OrderItemOptionSelection" ("orderItemId");
CREATE INDEX IF NOT EXISTS "OrderItemOptionSelection_optionGroupId_idx"
  ON "OrderItemOptionSelection" ("optionGroupId");
CREATE INDEX IF NOT EXISTS "OrderItemOptionSelection_optionItemId_idx"
  ON "OrderItemOptionSelection" ("optionItemId");

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

-- ===========================================================================
-- Per-order legal proof (canonical pipeline; references PlatformLegalDocumentVersion)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "OrderLegalAcceptance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId" UUID NOT NULL UNIQUE REFERENCES "Order"("id") ON DELETE CASCADE,
  "distanceSalesContractVersionId" UUID NOT NULL
    REFERENCES "PlatformLegalDocumentVersion"("id") ON DELETE RESTRICT,
  "preInformationFormVersionId" UUID NOT NULL
    REFERENCES "PlatformLegalDocumentVersion"("id") ON DELETE RESTRICT,
  "acceptedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ipAddress" INET,
  "userAgent" VARCHAR(500),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_OrderLegalAcceptance_distanceSales"
  ON "OrderLegalAcceptance" ("distanceSalesContractVersionId");
CREATE INDEX IF NOT EXISTS "IDX_OrderLegalAcceptance_preInfoForm"
  ON "OrderLegalAcceptance" ("preInformationFormVersionId");

-- ===========================================================================
-- Stripe payment + webhook ledger
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" UUID NOT NULL PRIMARY KEY,
  "orderId" UUID NOT NULL UNIQUE,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "status" TEXT NOT NULL DEFAULT 'requires_payment',
  "amount" NUMERIC(12, 2) NOT NULL,
  "currency" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT,
  "stripePaymentIntentId" TEXT,
  "lastEventId" TEXT,
  "lastEventType" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "Payment_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Payment_stripeCheckoutSessionId_idx"
  ON "Payment" ("stripeCheckoutSessionId");
CREATE INDEX IF NOT EXISTS "Payment_stripePaymentIntentId_idx"
  ON "Payment" ("stripePaymentIntentId");

CREATE TABLE IF NOT EXISTS "StripeWebhookEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'received',
  "orderId" UUID,
  "note" TEXT,
  "receivedAt" TIMESTAMPTZ NOT NULL,
  "processedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "StripeWebhookEvent_receivedAt_idx"
  ON "StripeWebhookEvent" ("receivedAt");

-- ===========================================================================
-- Store reviews — depends on Order and CustomerAccount + TenantAccount
-- ===========================================================================

CREATE TABLE IF NOT EXISTS "StoreReview" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "storeId" UUID NOT NULL REFERENCES "Store"("id") ON DELETE CASCADE,
  "orderId" UUID NOT NULL UNIQUE REFERENCES "Order"("id") ON DELETE CASCADE,
  "customerAccountId" UUID NOT NULL REFERENCES "CustomerAccount"("id") ON DELETE CASCADE,
  "rating" SMALLINT NOT NULL,
  "title" VARCHAR(160),
  "body" TEXT,
  "status" VARCHAR(24) NOT NULL DEFAULT 'visible',
  "moderationNote" TEXT,
  "flaggedAt" TIMESTAMPTZ,
  "flaggedReason" TEXT,
  "tenantReplyBody" TEXT,
  "tenantReplyAt" TIMESTAMPTZ,
  "tenantReplyByTenantId" UUID REFERENCES "TenantAccount"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "CHK_StoreReview_rating"
    CHECK ("rating" BETWEEN 1 AND 5),
  CONSTRAINT "CHK_StoreReview_status"
    CHECK ("status" IN ('visible', 'hidden', 'flagged', 'deleted'))
);

CREATE INDEX IF NOT EXISTS "IDX_StoreReview_store_status_createdAt"
  ON "StoreReview" ("storeId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "IDX_StoreReview_customerAccountId"
  ON "StoreReview" ("customerAccountId");
CREATE INDEX IF NOT EXISTS "IDX_StoreReview_store_visible_rating"
  ON "StoreReview" ("storeId") WHERE "status" = 'visible';
