-- CreateTable
CREATE TABLE "WebAuthnCredential" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "publicKey" BLOB NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT NOT NULL DEFAULT '[]',
    "label" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" DATETIME,
    CONSTRAINT "WebAuthnCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "passwordVerifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "securityVersion" INTEGER NOT NULL,
    "sessionId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecoveryCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CapabilityGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "clientId" TEXT NOT NULL DEFAULT '',
    "requestId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CapabilityGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" DATETIME,
    "securityVersion" INTEGER NOT NULL DEFAULT 0,
    "mfaEnrollmentAllowed" BOOLEAN NOT NULL DEFAULT false,
    "mfaEnrollmentExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "id", "lastLoginAt", "name", "passwordHash", "phone", "role", "status", "updatedAt") SELECT "createdAt", "email", "id", "lastLoginAt", "name", "passwordHash", "phone", "role", "status", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "securityVersion" INTEGER NOT NULL DEFAULT -1,
    "assurance" TEXT NOT NULL DEFAULT 'PASSWORD',
    "passwordVerifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mfaVerifiedAt" DATETIME,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeClientId" TEXT,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("createdAt", "expiresAt", "id", "tokenHash", "userId") SELECT "createdAt", "expiresAt", "id", "tokenHash", "userId" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WebAuthnCredential_userId_idx" ON "WebAuthnCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityChallenge_tokenHash_key" ON "SecurityChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "SecurityChallenge_userId_idx" ON "SecurityChallenge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecoveryCode_codeHash_key" ON "RecoveryCode"("codeHash");

-- CreateIndex
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");

-- CreateIndex
CREATE INDEX "CapabilityGrant_userId_clientId_idx" ON "CapabilityGrant"("userId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "CapabilityGrant_userId_capability_scope_clientId_requestId_key" ON "CapabilityGrant"("userId", "capability", "scope", "clientId", "requestId");
