CREATE TABLE "PkHolidayCredit" (
"id" TEXT NOT NULL,
"auntPennyOrderId" TEXT NOT NULL,
"buyerEmailHash" TEXT NOT NULL,
"status" TEXT NOT NULL DEFAULT 'ISSUED',
"amountCents" INTEGER NOT NULL DEFAULT 1000,
"startsAt" TIMESTAMP(3) NOT NULL,
"expiresAt" TIMESTAMP(3) NOT NULL,
"readinessAssessmentId" TEXT,
"redeemedAt" TIMESTAMP(3),
"revokedAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "PkHolidayCredit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PkHolidayCredit_auntPennyOrderId_key" ON "PkHolidayCredit"("auntPennyOrderId");
CREATE UNIQUE INDEX "PkHolidayCredit_readinessAssessmentId_key" ON "PkHolidayCredit"("readinessAssessmentId");
CREATE INDEX "PkHolidayCredit_buyerEmailHash_status_idx" ON "PkHolidayCredit"("buyerEmailHash","status");
CREATE INDEX "PkHolidayCredit_status_expiresAt_idx" ON "PkHolidayCredit"("status","expiresAt");
