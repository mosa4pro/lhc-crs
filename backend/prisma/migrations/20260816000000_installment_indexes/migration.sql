-- Add performance indexes for the installments table (paginated/filtered list + stats).
CREATE INDEX IF NOT EXISTS "Installment_studentId_idx" ON "Installment"("studentId");
CREATE INDEX IF NOT EXISTS "Installment_subscriptionId_idx" ON "Installment"("subscriptionId");
CREATE INDEX IF NOT EXISTS "Installment_studentId_status_idx" ON "Installment"("studentId", "status");
CREATE INDEX IF NOT EXISTS "Installment_status_dueDate_idx" ON "Installment"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "Installment_paymentDest_idx" ON "Installment"("paymentDest");
CREATE INDEX IF NOT EXISTS "Installment_createdAt_idx" ON "Installment"("createdAt");
