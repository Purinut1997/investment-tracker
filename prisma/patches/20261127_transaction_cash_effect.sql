BEGIN;
ALTER TABLE "Transaction"
  ADD COLUMN IF NOT EXISTS "cashDeltaApplied" DECIMAL(65,30),
  ADD COLUMN IF NOT EXISTS "cashSyncEnabled" BOOLEAN NOT NULL DEFAULT FALSE;
-- Legacy transactions have no reliable history of how much cash was applied.
CREATE TABLE IF NOT EXISTS "TransactionRequestReceipt" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "key" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "response" JSONB NOT NULL,
  PRIMARY KEY ("userId", "key")
);
COMMIT;
