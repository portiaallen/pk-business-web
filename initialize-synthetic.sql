-- EMPTY DISPOSABLE QUALIFICATION DATABASE ONLY. No production resources.
PRAGMA foreign_keys=ON;
BEGIN IMMEDIATE;
-- CreateTable
CREATE TABLE "User" (
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

-- CreateTable
CREATE TABLE "Session" (
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

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClientMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "priceDisplay" TEXT NOT NULL,
    "priceCents" INTEGER,
    "processingExpectation" TEXT,
    "requiredDocuments" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requesterName" TEXT,
    "requesterEmail" TEXT,
    "requesterPhone" TEXT,
    "subjectName" TEXT,
    "subjectEmail" TEXT,
    "subjectPhone" TEXT,
    "clientNotes" TEXT,
    "assignedStaffId" TEXT,
    "submittedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VerificationRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VerificationRequest_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "VerificationRequest_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InternalNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InternalNote_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InternalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationFinding_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reportPath" TEXT,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationResult_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "retentionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "uploadedAt" DATETIME,
    "reviewedAt" DATETIME,
    "reviewerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ordinaryLegalHold" BOOLEAN NOT NULL DEFAULT false,
    "transferDeleteState" TEXT NOT NULL DEFAULT 'NONE',
    CONSTRAINT "Document_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Document_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "formKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "data" TEXT NOT NULL DEFAULT '{}',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "lastSavedAt" DATETIME,
    "submittedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FormSubmission_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "clientInstruction" TEXT,
    "documentId" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentRequest_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentRequest_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isFromStaff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClientMessageRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientMessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ClientMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClientMessageRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'DRAFT',
    "releasedAt" DATETIME,
    "releasedById" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ordinaryLegalHold" BOOLEAN NOT NULL DEFAULT false,
    "transferDeleteState" TEXT NOT NULL DEFAULT 'NONE',
    CONSTRAINT "Deliverable_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deliverable_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deliverable_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IntakeSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "businessName" TEXT,
    "serviceSlug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "contactMethod" TEXT NOT NULL DEFAULT 'email',
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestId" TEXT,
    "serviceId" TEXT,
    "description" TEXT,
    "lineItems" TEXT NOT NULL DEFAULT '[]',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "adjustmentCents" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "paymentTerms" TEXT,
    "notes" TEXT,
    "paymentInstructions" TEXT,
    "dueAt" DATETIME,
    "issueAt" DATETIME,
    "sentAt" DATETIME,
    "viewedAt" DATETIME,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "detail" TEXT,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceActivity_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "requestId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL,
    "transactionReference" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "providerReference" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "engine" TEXT NOT NULL DEFAULT 'rules',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiReview_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "relatedAccounts" TEXT,
    "recommendation" TEXT,
    "humanDecision" TEXT,
    "humanNotes" TEXT,
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'SYSTEM_GENERATED',
    "checklistItemKey" TEXT,
    "estimatedHours" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiFinding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AiReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiDecision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "findingId" TEXT NOT NULL,
    "recommendation" TEXT,
    "humanDecision" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiDecision_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AiFinding" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiScopeAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "estimatedHours" REAL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiScopeAlert_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AiReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiClarification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "findingId" TEXT,
    "question" TEXT NOT NULL,
    "reason" TEXT,
    "relatedTransactions" TEXT,
    "relatedAccount" TEXT,
    "relatedPeriod" TEXT,
    "amountCents" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "clientResponse" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiClarification_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AiReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiClarification_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AiFinding" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM_GENERATED',
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiActivityLog_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AiReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "startedAt" DATETIME NOT NULL,
    "stoppedAt" DATETIME,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TimeEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QbCleanupReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "reviewerId" TEXT NOT NULL,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "notes" TEXT DEFAULT '',
    CONSTRAINT "QbCleanupReview_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QbCleanupReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QbCleanupChecklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QbCleanupChecklist_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "QbCleanupReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QbCleanupChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checklistId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_REVIEWED',
    "notes" TEXT,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "isDocumentationNeeded" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "notApplicable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QbCleanupChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "QbCleanupChecklist" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QbCleanupChecklistItem_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "QbCleanupReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QbCleanupFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "checklistItemId" TEXT,
    "category" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEEDS_INVESTIGATION',
    "notes" TEXT,
    "isFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "isDocumentationNeeded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QbCleanupFinding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "QbCleanupReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QbCleanupQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "findingId" TEXT,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "clientResponse" TEXT,
    "internalNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QbCleanupQuestion_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "QbCleanupReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QbCleanupDocLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "dateOrPeriod" TEXT,
    "description" TEXT,
    "checklistItemId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QbCleanupDocLog_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "QbCleanupReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginRateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastFailedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "clientId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryLocation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'each',
    "currentQuantity" INTEGER NOT NULL DEFAULT 0,
    "reorderThreshold" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryProduct_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryProduct_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "quantityChange" INTEGER NOT NULL,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryTransaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransaction_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "ClientMember_clientId_idx" ON "ClientMember"("clientId");

-- CreateIndex
CREATE INDEX "ClientMember_userId_idx" ON "ClientMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMember_clientId_userId_key" ON "ClientMember"("clientId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_slug_key" ON "Service"("slug");

-- CreateIndex
CREATE INDEX "VerificationRequest_clientId_idx" ON "VerificationRequest"("clientId");

-- CreateIndex
CREATE INDEX "VerificationRequest_serviceId_idx" ON "VerificationRequest"("serviceId");

-- CreateIndex
CREATE INDEX "VerificationRequest_status_idx" ON "VerificationRequest"("status");

-- CreateIndex
CREATE INDEX "VerificationRequest_assignedStaffId_idx" ON "VerificationRequest"("assignedStaffId");

-- CreateIndex
CREATE INDEX "InternalNote_requestId_idx" ON "InternalNote"("requestId");

-- CreateIndex
CREATE INDEX "VerificationFinding_requestId_idx" ON "VerificationFinding"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationResult_requestId_key" ON "VerificationResult"("requestId");

-- CreateIndex
CREATE INDEX "Document_requestId_idx" ON "Document"("requestId");

-- CreateIndex
CREATE INDEX "Document_category_idx" ON "Document"("category");

-- CreateIndex
CREATE INDEX "FormSubmission_requestId_idx" ON "FormSubmission"("requestId");

-- CreateIndex
CREATE INDEX "FormSubmission_status_idx" ON "FormSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FormSubmission_requestId_formKey_key" ON "FormSubmission"("requestId", "formKey");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRequest_documentId_key" ON "DocumentRequest"("documentId");

-- CreateIndex
CREATE INDEX "DocumentRequest_requestId_idx" ON "DocumentRequest"("requestId");

-- CreateIndex
CREATE INDEX "DocumentRequest_status_idx" ON "DocumentRequest"("status");

-- CreateIndex
CREATE INDEX "ClientMessage_requestId_idx" ON "ClientMessage"("requestId");

-- CreateIndex
CREATE INDEX "ClientMessage_createdAt_idx" ON "ClientMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ClientMessageRead_userId_idx" ON "ClientMessageRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientMessageRead_messageId_userId_key" ON "ClientMessageRead"("messageId", "userId");

-- CreateIndex
CREATE INDEX "Deliverable_requestId_idx" ON "Deliverable"("requestId");

-- CreateIndex
CREATE INDEX "IntakeSubmission_email_idx" ON "IntakeSubmission"("email");

-- CreateIndex
CREATE INDEX "IntakeSubmission_createdAt_idx" ON "IntakeSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "InvoiceActivity_invoiceId_idx" ON "InvoiceActivity"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_clientId_idx" ON "Payment"("clientId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_requestId_idx" ON "Payment"("requestId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiReview_requestId_key" ON "AiReview"("requestId");

-- CreateIndex
CREATE INDEX "AiReview_requestId_idx" ON "AiReview"("requestId");

-- CreateIndex
CREATE INDEX "AiReview_status_idx" ON "AiReview"("status");

-- CreateIndex
CREATE INDEX "AiFinding_reviewId_idx" ON "AiFinding"("reviewId");

-- CreateIndex
CREATE INDEX "AiFinding_status_idx" ON "AiFinding"("status");

-- CreateIndex
CREATE INDEX "AiFinding_priority_idx" ON "AiFinding"("priority");

-- CreateIndex
CREATE INDEX "AiDecision_findingId_idx" ON "AiDecision"("findingId");

-- CreateIndex
CREATE INDEX "AiScopeAlert_reviewId_idx" ON "AiScopeAlert"("reviewId");

-- CreateIndex
CREATE INDEX "AiScopeAlert_status_idx" ON "AiScopeAlert"("status");

-- CreateIndex
CREATE INDEX "AiClarification_reviewId_idx" ON "AiClarification"("reviewId");

-- CreateIndex
CREATE INDEX "AiClarification_findingId_idx" ON "AiClarification"("findingId");

-- CreateIndex
CREATE INDEX "AiClarification_status_idx" ON "AiClarification"("status");

-- CreateIndex
CREATE INDEX "AiActivityLog_reviewId_idx" ON "AiActivityLog"("reviewId");

-- CreateIndex
CREATE INDEX "AiActivityLog_action_idx" ON "AiActivityLog"("action");

-- CreateIndex
CREATE INDEX "TimeEntry_requestId_idx" ON "TimeEntry"("requestId");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_idx" ON "TimeEntry"("userId");

-- CreateIndex
CREATE INDEX "TimeEntry_requestId_startedAt_idx" ON "TimeEntry"("requestId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QbCleanupReview_requestId_key" ON "QbCleanupReview"("requestId");

-- CreateIndex
CREATE INDEX "QbCleanupReview_requestId_idx" ON "QbCleanupReview"("requestId");

-- CreateIndex
CREATE INDEX "QbCleanupReview_status_idx" ON "QbCleanupReview"("status");

-- CreateIndex
CREATE INDEX "QbCleanupReview_reviewerId_idx" ON "QbCleanupReview"("reviewerId");

-- CreateIndex
CREATE INDEX "QbCleanupChecklist_reviewId_idx" ON "QbCleanupChecklist"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "QbCleanupChecklist_reviewId_category_itemKey_key" ON "QbCleanupChecklist"("reviewId", "category", "itemKey");

-- CreateIndex
CREATE INDEX "QbCleanupChecklistItem_checklistId_idx" ON "QbCleanupChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "QbCleanupChecklistItem_reviewId_idx" ON "QbCleanupChecklistItem"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "QbCleanupChecklistItem_checklistId_key" ON "QbCleanupChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "QbCleanupFinding_reviewId_idx" ON "QbCleanupFinding"("reviewId");

-- CreateIndex
CREATE INDEX "QbCleanupFinding_checklistItemId_idx" ON "QbCleanupFinding"("checklistItemId");

-- CreateIndex
CREATE INDEX "QbCleanupFinding_status_idx" ON "QbCleanupFinding"("status");

-- CreateIndex
CREATE INDEX "QbCleanupQuestion_reviewId_idx" ON "QbCleanupQuestion"("reviewId");

-- CreateIndex
CREATE INDEX "QbCleanupQuestion_findingId_idx" ON "QbCleanupQuestion"("findingId");

-- CreateIndex
CREATE INDEX "QbCleanupQuestion_status_idx" ON "QbCleanupQuestion"("status");

-- CreateIndex
CREATE INDEX "QbCleanupDocLog_reviewId_idx" ON "QbCleanupDocLog"("reviewId");

-- CreateIndex
CREATE INDEX "QbCleanupDocLog_checklistItemId_idx" ON "QbCleanupDocLog"("checklistItemId");

-- CreateIndex
CREATE INDEX "QbCleanupDocLog_docType_idx" ON "QbCleanupDocLog"("docType");

-- CreateIndex
CREATE UNIQUE INDEX "LoginRateLimit_email_key" ON "LoginRateLimit"("email");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_clientId_idx" ON "AuditLog"("clientId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_resource_resourceId_idx" ON "AuditLog"("resource", "resourceId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryMember_clientId_idx" ON "InventoryMember"("clientId");

-- CreateIndex
CREATE INDEX "InventoryMember_userId_idx" ON "InventoryMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryMember_clientId_userId_key" ON "InventoryMember"("clientId", "userId");

-- CreateIndex
CREATE INDEX "InventoryLocation_clientId_idx" ON "InventoryLocation"("clientId");

-- CreateIndex
CREATE INDEX "InventoryLocation_isActive_idx" ON "InventoryLocation"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_clientId_name_key" ON "InventoryLocation"("clientId", "name");

-- CreateIndex
CREATE INDEX "InventoryProduct_clientId_idx" ON "InventoryProduct"("clientId");

-- CreateIndex
CREATE INDEX "InventoryProduct_locationId_idx" ON "InventoryProduct"("locationId");

-- CreateIndex
CREATE INDEX "InventoryProduct_isActive_idx" ON "InventoryProduct"("isActive");

-- CreateIndex
CREATE INDEX "InventoryProduct_category_idx" ON "InventoryProduct"("category");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProduct_clientId_sku_key" ON "InventoryProduct"("clientId", "sku");

-- CreateIndex
CREATE INDEX "InventoryTransaction_clientId_idx" ON "InventoryTransaction"("clientId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_productId_idx" ON "InventoryTransaction"("productId");

-- CreateIndex
CREATE INDEX "InventoryTransaction_performedById_idx" ON "InventoryTransaction"("performedById");

-- CreateIndex
CREATE INDEX "InventoryTransaction_transactionType_idx" ON "InventoryTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "InventoryTransaction_createdAt_idx" ON "InventoryTransaction"("createdAt");

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

-- CreateIndex
CREATE INDEX "VaultDocument_clientId_requestId_state_idx" ON "VaultDocument"("clientId", "requestId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "VaultDocument_createdBy_idempotencyKey_key" ON "VaultDocument"("createdBy", "idempotencyKey");

-- CreateIndex
CREATE INDEX "VaultBackup_clientId_idx" ON "VaultBackup"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultRetentionPolicy_category_policyVersion_key" ON "VaultRetentionPolicy"("category", "policyVersion");

-- CreateIndex
CREATE UNIQUE INDEX "OrdinaryTransferIntent_tokenHash_key" ON "OrdinaryTransferIntent"("tokenHash");

-- CreateIndex
CREATE INDEX "OrdinaryTransferIntent_status_expiresAt_idx" ON "OrdinaryTransferIntent"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "OrdinaryTransferIntent_clientId_requestId_idx" ON "OrdinaryTransferIntent"("clientId", "requestId");


INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-client-a','client-a@qualification.example.test','Synthetic client-a','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','CLIENT','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),0,NULL);
INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-client-b','client-b@qualification.example.test','Synthetic client-b','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','CLIENT','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),0,NULL);
INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-multi-client','multi-client@qualification.example.test','Synthetic multi-client','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','CLIENT','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),0,NULL);
INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-inactive-client','inactive-client@qualification.example.test','Synthetic inactive-client','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','CLIENT','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),0,NULL);
INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-owner','owner@qualification.example.test','Synthetic owner','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','ADMIN','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),1,((CAST(strftime('%s','now') AS INTEGER)*1000)+900000));
INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-assigned-bookkeeper','assigned-bookkeeper@qualification.example.test','Synthetic assigned-bookkeeper','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','STAFF','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),0,NULL);
INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-unassigned-staff','unassigned-staff@qualification.example.test','Synthetic unassigned-staff','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','STAFF','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),0,NULL);
INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-support','support@qualification.example.test','Synthetic support','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','STAFF','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),0,NULL);
INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-data-entry','data-entry@qualification.example.test','Synthetic data-entry','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','STAFF','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),0,NULL);
INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-reviewer','reviewer@qualification.example.test','Synthetic reviewer','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','STAFF','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),0,NULL);
INSERT INTO "User" ("id","email","name","passwordHash","role","status","updatedAt","mfaEnrollmentAllowed","mfaEnrollmentExpiresAt") VALUES ('qual-filing','filing@qualification.example.test','Synthetic filing','$2b$12$udNG.TXghjxalkt5V9ipOOQeRjFiafkZdcf5CwHlaegL1C22WaSwC','STAFF','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000),0,NULL);
INSERT INTO "Client" ("id","name","status","updatedAt") VALUES ('qual-client-a','Synthetic client a','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "Client" ("id","name","status","updatedAt") VALUES ('qual-client-b','Synthetic client b','ACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "Client" ("id","name","status","updatedAt") VALUES ('qual-client-inactive','Synthetic client inactive','INACTIVE',(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "ClientMember" ("id","clientId","userId","role","updatedAt") VALUES ('qual-member-client-a-a','qual-client-a','qual-client-a','OWNER',(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "ClientMember" ("id","clientId","userId","role","updatedAt") VALUES ('qual-member-client-b-b','qual-client-b','qual-client-b','OWNER',(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "ClientMember" ("id","clientId","userId","role","updatedAt") VALUES ('qual-member-multi-client-a','qual-client-a','qual-multi-client','OWNER',(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "ClientMember" ("id","clientId","userId","role","updatedAt") VALUES ('qual-member-multi-client-b','qual-client-b','qual-multi-client','OWNER',(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "ClientMember" ("id","clientId","userId","role","updatedAt") VALUES ('qual-member-inactive-client-inactive','qual-client-inactive','qual-inactive-client','OWNER',(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "Service" ("id","slug","name","shortName","description","shortDescription","priceDisplay","priceCents","updatedAt") VALUES ('qual-service','qualification-synthetic','Synthetic qualification service','Synthetic','Synthetic only','Synthetic only','Synthetic — not for sale',NULL,(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "VerificationRequest" ("id","clientId","serviceId","requestType","status","assignedStaffId","updatedAt") VALUES ('qual-request-a','qual-client-a','qual-service','Synthetic bookkeeping','SUBMITTED','qual-assigned-bookkeeper',(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "VerificationRequest" ("id","clientId","serviceId","requestType","status","assignedStaffId","updatedAt") VALUES ('qual-request-a-unassigned','qual-client-a','qual-service','Synthetic bookkeeping','SUBMITTED',NULL,(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "VerificationRequest" ("id","clientId","serviceId","requestType","status","assignedStaffId","updatedAt") VALUES ('qual-request-b','qual-client-b','qual-service','Synthetic bookkeeping','SUBMITTED',NULL,(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "VerificationRequest" ("id","clientId","serviceId","requestType","status","assignedStaffId","updatedAt") VALUES ('qual-request-inactive','qual-client-inactive','qual-service','Synthetic bookkeeping','SUBMITTED',NULL,(CAST(strftime('%s','now') AS INTEGER)*1000));
INSERT INTO "CapabilityGrant" ("id","userId","capability","scope","clientId","requestId") VALUES ('qual-grant-1','qual-owner','security','GLOBAL','','');
INSERT INTO "CapabilityGrant" ("id","userId","capability","scope","clientId","requestId") VALUES ('qual-grant-2','qual-owner','permissions','GLOBAL','','');
INSERT INTO "CapabilityGrant" ("id","userId","capability","scope","clientId","requestId") VALUES ('qual-grant-3','qual-owner','assignments','GLOBAL','','');
INSERT INTO "CapabilityGrant" ("id","userId","capability","scope","clientId","requestId") VALUES ('qual-grant-4','qual-owner','audit','GLOBAL','','');
INSERT INTO "CapabilityGrant" ("id","userId","capability","scope","clientId","requestId") VALUES ('qual-grant-5','qual-assigned-bookkeeper','confidential_access','CLIENT','qual-client-a','');
INSERT INTO "CapabilityGrant" ("id","userId","capability","scope","clientId","requestId") VALUES ('qual-grant-6','qual-assigned-bookkeeper','bookkeeping','CLIENT','qual-client-a','');
INSERT INTO "CapabilityGrant" ("id","userId","capability","scope","clientId","requestId") VALUES ('qual-grant-7','qual-reviewer','qa','CLIENT','qual-client-a','');
INSERT INTO "CapabilityGrant" ("id","userId","capability","scope","clientId","requestId") VALUES ('qual-grant-8','qual-filing','filing','CLIENT','qual-client-a','');
INSERT INTO "AuditLog" ("id","action","resource","metadata") VALUES ('qual-bootstrap-audit','ADMIN_ACTION','qualification_bootstrap','{"action":"SYNTHETIC_INITIALIZATION"}');
COMMIT;
