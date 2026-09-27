-- Cash on delivery only (no online payment) + Kafe klub loyalty.
-- Hand-written so existing orders keep their status and history: enum values are renamed, not recreated.

ALTER TYPE "OrderStatus" RENAME VALUE 'AWAITING_PAYMENT' TO 'NEW';
ALTER TYPE "OrderStatus" RENAME VALUE 'PAID' TO 'CONFIRMED';
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'NEW';

ALTER TABLE "Order"
  ADD COLUMN "emailNormalized" TEXT,
  ADD COLUMN "discountRsd" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loyaltyTier" TEXT,
  ADD COLUMN "totalRsd" INTEGER;

UPDATE "Order" SET "emailNormalized" = lower(trim("email")), "totalRsd" = "subtotalRsd";

ALTER TABLE "Order"
  ALTER COLUMN "emailNormalized" SET NOT NULL,
  ALTER COLUMN "totalRsd" SET NOT NULL,
  DROP COLUMN "paymentPlan",
  DROP COLUMN "dueNowRsd",
  DROP COLUMN "dueOnDeliveryRsd",
  DROP COLUMN "paymentReference";

DROP TYPE "PaymentPlan";

CREATE INDEX "Order_emailNormalized_status_idx" ON "Order"("emailNormalized", "status");
