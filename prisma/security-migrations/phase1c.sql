-- CreateTable
CREATE TABLE "VaultDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'CONFIDENTIAL_CLIENT',
    "category" TEXT NOT NULL,
    "highRisk" BOOLEAN NOT NULL DEFAULT false,
    "taxInformation" BOOLEAN NOT NULL DEFAULT false,
    "mimeType" TEXT NOT NULL,
    "expectedSize" INTEGER NOT NULL,
    "digest" TEXT,
    "state" TEXT NOT NULL DEFAULT 'INTENT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "leaseUntil" DATETIME,
    "uploadedAt" DATETIME,
    "releasedAt" DATETIME,
    "retentionCategory" TEXT NOT NULL,
    "policyReference" TEXT,
    "policyVersion" TEXT,
    "retentionTrigger" TEXT NOT NULL DEFAULT 'ENGAGEMENT_CLOSEOUT',
    "retentionTriggeredAt" DATETIME,
    "disposalEligibleAt" DATETIME,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "holdReference" TEXT,
    "holdReason" TEXT,
    "disposalState" TEXT NOT NULL DEFAULT 'NONE',
    "disposalRequestedAt" DATETIME,
    "disposedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VaultDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VaultDocument_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VaultTombstone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "digest" TEXT,
    "disposedAt" DATETIME NOT NULL,
    "evidence" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "VaultBackup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "digest" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" DATETIME
);

-- CreateTable
CREATE TABLE "VaultRetentionPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'ENGAGEMENT_CLOSEOUT',
    "durationDays" INTEGER,
    "approved" BOOLEAN NOT NULL DEFAULT false
);

-- CreateIndex
CREATE INDEX "VaultDocument_clientId_requestId_state_idx" ON "VaultDocument"("clientId", "requestId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "VaultDocument_createdBy_idempotencyKey_key" ON "VaultDocument"("createdBy", "idempotencyKey");

-- CreateIndex
CREATE INDEX "VaultBackup_clientId_idx" ON "VaultBackup"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultRetentionPolicy_category_policyVersion_key" ON "VaultRetentionPolicy"("category", "policyVersion");
