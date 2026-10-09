-- CreateTable
CREATE TABLE "ReadinessAssessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "intakeSubmissionId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 9900,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'PURCHASE_STARTED',
    "version" INTEGER NOT NULL DEFAULT 0,
    "purchaseTokenHash" TEXT NOT NULL,
    "purchaseExpiresAt" DATETIME NOT NULL,
    "stripeSessionId" TEXT,
    "onboardingCodeHash" TEXT,
    "onboardingCodeExpiresAt" DATETIME,
    "onboardingCodeAttempts" INTEGER NOT NULL DEFAULT 0,
    "onboardingCodeSentAt" DATETIME,
    "emailVerifiedAt" DATETIME,
    "intakeData" TEXT NOT NULL DEFAULT '{}',
    "policyVersion" TEXT,
    "acknowledgmentText" TEXT,
    "acknowledgmentAcceptedAt" DATETIME,
    "acknowledgmentById" TEXT,
    "submittedAt" DATETIME,
    "reviewReadyAt" DATETIME,
    "reviewStartedAt" DATETIME,
    "slaDueAt" DATETIME,
    "slaPausedAt" DATETIME,
    "reportDeliveredAt" DATETIME,
    "closedAt" DATETIME,
    "summary" TEXT NOT NULL DEFAULT '',
    "strengths" TEXT NOT NULL DEFAULT '',
    "priorityConcerns" TEXT NOT NULL DEFAULT '',
    "limitations" TEXT NOT NULL DEFAULT '',
    "qaReviewedById" TEXT,
    "qaReviewedAt" DATETIME,
    "qaDraftVersion" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReadinessAssessment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReadinessAssessment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VerificationRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReadinessAssessment_intakeSubmissionId_fkey" FOREIGN KEY ("intakeSubmissionId") REFERENCES "IntakeSubmission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReadinessAssessment_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReadinessAssessment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReadinessAssessment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadinessFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "finding" TEXT NOT NULL,
    "evidenceBasis" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "disposition" TEXT NOT NULL,
    "qualifyingServiceId" TEXT,
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ReadinessFinding_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ReadinessAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationLibraryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "recommendationType" TEXT NOT NULL,
    "providerOrResourceName" TEXT,
    "clientFacingDescription" TEXT NOT NULL,
    "whyOrWhenToUse" TEXT NOT NULL,
    "clientNextStep" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "locationOrServiceArea" TEXT,
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "relationshipClassification" TEXT NOT NULL DEFAULT 'INFORMATIONAL',
    "disclosureText" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AssessmentRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "libraryEntryId" TEXT,
    "sourceVersion" INTEGER,
    "snapshot" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "AssessmentRecommendation_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ReadinessAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssessmentRecommendation_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "ReadinessFinding" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AssessmentRecommendation_libraryEntryId_fkey" FOREIGN KEY ("libraryEntryId") REFERENCES "RecommendationLibraryEntry" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadinessReportVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'FINAL',
    "snapshot" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "artifactReference" TEXT NOT NULL,
    "finalizedBy" TEXT NOT NULL,
    "finalizedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveryState" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveredAt" DATETIME,
    "sourceDraftVersion" INTEGER NOT NULL,
    CONSTRAINT "ReadinessReportVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ReadinessAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadinessCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "claimDeadline" DATETIME NOT NULL,
    "redeemDeadline" DATETIME NOT NULL,
    "claimedAt" DATETIME,
    "claimedBy" TEXT,
    "requestedServiceId" TEXT,
    "decidedAt" DATETIME,
    "decidedBy" TEXT,
    "decisionReason" TEXT,
    "qualifyingServiceId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "amountAppliedCents" INTEGER NOT NULL DEFAULT 0,
    "appliedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ReadinessCredit_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ReadinessAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReadinessCredit_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReadinessCredit_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadinessDocumentEvidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assessmentId" TEXT NOT NULL,
    "documentRequestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'PENDING_SECURE_HANDOFF',
    "vaultDocumentId" TEXT,
    "externalReference" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    CONSTRAINT "ReadinessDocumentEvidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "ReadinessAssessment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReadinessDocumentEvidence_documentRequestId_fkey" FOREIGN KEY ("documentRequestId") REFERENCES "DocumentRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReadinessDocumentEvidence_vaultDocumentId_fkey" FOREIGN KEY ("vaultDocumentId") REFERENCES "VaultDocument" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadinessAnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReadinessPublicRateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'EMAIL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dedupeKey" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME,
    "leaseUntil" DATETIME,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("body", "channel", "createdAt", "id", "metadata", "sentAt", "status", "subject", "userId") SELECT "body", "channel", "createdAt", "id", "metadata", "sentAt", "status", "subject", "userId" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_status_idx" ON "Notification"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessAssessment_requestId_key" ON "ReadinessAssessment"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessAssessment_intakeSubmissionId_key" ON "ReadinessAssessment"("intakeSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessAssessment_invoiceId_key" ON "ReadinessAssessment"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessAssessment_paymentId_key" ON "ReadinessAssessment"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessAssessment_purchaseTokenHash_key" ON "ReadinessAssessment"("purchaseTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessAssessment_stripeSessionId_key" ON "ReadinessAssessment"("stripeSessionId");

-- CreateIndex
CREATE INDEX "ReadinessAssessment_clientId_status_idx" ON "ReadinessAssessment"("clientId", "status");

-- CreateIndex
CREATE INDEX "ReadinessAssessment_status_createdAt_idx" ON "ReadinessAssessment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReadinessAssessment_ownerUserId_idx" ON "ReadinessAssessment"("ownerUserId");

-- CreateIndex
CREATE INDEX "ReadinessFinding_assessmentId_area_idx" ON "ReadinessFinding"("assessmentId", "area");

-- CreateIndex
CREATE INDEX "RecommendationLibraryEntry_active_archived_category_idx" ON "RecommendationLibraryEntry"("active", "archived", "category");

-- CreateIndex
CREATE INDEX "AssessmentRecommendation_assessmentId_ordering_idx" ON "AssessmentRecommendation"("assessmentId", "ordering");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessReportVersion_assessmentId_version_key" ON "ReadinessReportVersion"("assessmentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessCredit_assessmentId_key" ON "ReadinessCredit"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessCredit_paymentId_key" ON "ReadinessCredit"("paymentId");

-- CreateIndex
CREATE INDEX "ReadinessCredit_status_redeemDeadline_idx" ON "ReadinessCredit"("status", "redeemDeadline");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessDocumentEvidence_documentRequestId_key" ON "ReadinessDocumentEvidence"("documentRequestId");

-- CreateIndex
CREATE INDEX "ReadinessDocumentEvidence_assessmentId_idx" ON "ReadinessDocumentEvidence"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadinessAnalyticsEvent_dedupeKey_key" ON "ReadinessAnalyticsEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "ReadinessAnalyticsEvent_event_createdAt_idx" ON "ReadinessAnalyticsEvent"("event", "createdAt");


-- Domain evidence is append-only. Ordinary application writes cannot rewrite history.
CREATE TRIGGER readiness_report_immutable
BEFORE UPDATE OF assessmentId, version, sourceDraftVersion, state, snapshot, digest, artifactReference, finalizedBy, finalizedAt ON ReadinessReportVersion
BEGIN SELECT RAISE(ABORT, 'READINESS_FINAL_REPORT_IMMUTABLE'); END;
CREATE TRIGGER readiness_report_no_delete BEFORE DELETE ON ReadinessReportVersion
BEGIN SELECT RAISE(ABORT, 'READINESS_REPORT_HISTORY_REQUIRED'); END;
CREATE TRIGGER readiness_recommendation_snapshot_immutable
BEFORE UPDATE OF assessmentId, findingId, libraryEntryId, sourceVersion, snapshot, createdBy, createdAt ON AssessmentRecommendation
BEGIN SELECT RAISE(ABORT, 'READINESS_RECOMMENDATION_SNAPSHOT_IMMUTABLE'); END;
CREATE TRIGGER readiness_submission_evidence_immutable
BEFORE UPDATE OF policyVersion, acknowledgmentText, acknowledgmentAcceptedAt, acknowledgmentById, submittedAt ON ReadinessAssessment
WHEN OLD.submittedAt IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'READINESS_SUBMISSION_EVIDENCE_IMMUTABLE'); END;
CREATE TRIGGER readiness_price_insert BEFORE INSERT ON ReadinessAssessment
WHEN NEW.priceCents != 9900 OR NEW.currency != 'USD'
BEGIN SELECT RAISE(ABORT, 'READINESS_PRICE_INVALID'); END;
CREATE TRIGGER readiness_price_update BEFORE UPDATE OF priceCents, currency ON ReadinessAssessment
BEGIN SELECT RAISE(ABORT, 'READINESS_PRICE_IMMUTABLE'); END;
