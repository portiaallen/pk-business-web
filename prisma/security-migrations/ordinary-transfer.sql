-- CreateTable
CREATE TABLE "OrdinaryTransferIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "securityVersion" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "resourceId" TEXT,
    "fileName" TEXT NOT NULL,
    "title" TEXT,
    "category" TEXT,
    "documentRequestId" TEXT,
    "size" INTEGER NOT NULL,
    "mime" TEXT NOT NULL,
    "digest" TEXT,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Additive ordinary-document metadata; no confidential-vault migration.
ALTER TABLE "Document" ADD COLUMN "ordinaryLegalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "transferDeleteState" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Deliverable" ADD COLUMN "ordinaryLegalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Deliverable" ADD COLUMN "transferDeleteState" TEXT NOT NULL DEFAULT 'NONE';

-- CreateIndex
CREATE UNIQUE INDEX "OrdinaryTransferIntent_tokenHash_key" ON "OrdinaryTransferIntent"("tokenHash");

-- CreateIndex
CREATE INDEX "OrdinaryTransferIntent_status_expiresAt_idx" ON "OrdinaryTransferIntent"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "OrdinaryTransferIntent_clientId_requestId_idx" ON "OrdinaryTransferIntent"("clientId", "requestId");

