-- Baseline missing payment columns (schema drift: these existed in schema.prisma
-- but were never recorded in a migration). IF NOT EXISTS keeps this safe both on
-- fresh databases and on production where the columns are already present.
ALTER TABLE "Installment" ADD COLUMN IF NOT EXISTS "paymentWallet" TEXT;
ALTER TABLE "Installment" ADD COLUMN IF NOT EXISTS "paymentBank" TEXT;
ALTER TABLE "Installment" ADD COLUMN IF NOT EXISTS "senderInfo" TEXT;
ALTER TABLE "Installment" ADD COLUMN IF NOT EXISTS "paymentDest" TEXT;
ALTER TABLE "Installment" ADD COLUMN IF NOT EXISTS "paymentSubMethod" TEXT;
ALTER TABLE "Installment" ADD COLUMN IF NOT EXISTS "paymentWalletRef" TEXT;
ALTER TABLE "Installment" ADD COLUMN IF NOT EXISTS "checkNumber" TEXT;
ALTER TABLE "Installment" ADD COLUMN IF NOT EXISTS "hawalaNumber" TEXT;

-- Add performance indexes for the installments table (paginated/filtered list + stats).
CREATE INDEX IF NOT EXISTS "Installment_studentId_idx" ON "Installment"("studentId");
CREATE INDEX IF NOT EXISTS "Installment_subscriptionId_idx" ON "Installment"("subscriptionId");
CREATE INDEX IF NOT EXISTS "Installment_studentId_status_idx" ON "Installment"("studentId", "status");
CREATE INDEX IF NOT EXISTS "Installment_status_dueDate_idx" ON "Installment"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "Installment_paymentDest_idx" ON "Installment"("paymentDest");
CREATE INDEX IF NOT EXISTS "Installment_createdAt_idx" ON "Installment"("createdAt");
