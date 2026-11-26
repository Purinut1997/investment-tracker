-- This project uses Prisma db push and has no migration baseline.
-- Apply this additive patch on a staging database before enrolling pilot users.
BEGIN;

CREATE TABLE "AdvisorReport" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reportDate" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "requestId" TEXT NOT NULL,
  "asOf" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "snapshot" JSONB NOT NULL,
  "text" TEXT NOT NULL,
  "modelUsed" TEXT NOT NULL,
  "durationMs" INTEGER NOT NULL
);
CREATE UNIQUE INDEX "AdvisorReport_userId_reportDate_revision_key" ON "AdvisorReport"("userId", "reportDate", "revision");
CREATE UNIQUE INDEX "AdvisorReport_userId_reportDate_requestId_key" ON "AdvisorReport"("userId", "reportDate", "requestId");

CREATE TABLE "AdvisorJob" (
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "date" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "leaseEnd" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("userId", "date")
);

CREATE TABLE "AdvisorPolicy" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "config" JSONB NOT NULL
);
CREATE UNIQUE INDEX "AdvisorPolicy_userId_version_key" ON "AdvisorPolicy"("userId", "version");

CREATE TABLE "AdvisorRun" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "policyVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "asOf" TIMESTAMP(3) NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "snapshot" JSONB NOT NULL,
  "result" JSONB NOT NULL,
  "durationMs" INTEGER NOT NULL
);
CREATE INDEX "AdvisorRun_userId_createdAt_idx" ON "AdvisorRun"("userId", "createdAt");

COMMIT;
