-- Forward-only addition after readiness-v1; no purchase/history changes.
ALTER TABLE "ReadinessAssessment" ADD COLUMN "recoveryCodeHash" TEXT;
ALTER TABLE "ReadinessAssessment" ADD COLUMN "recoveryCodeExpiresAt" DATETIME;
