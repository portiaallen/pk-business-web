// Public PK Practice Partners CPA firm application endpoint. Strictly
// non-sensitive: the form never collects taxpayer files, SSNs, client data,
// or bank details, and server-side screening rejects any sensitive content
// typed into free text BEFORE persistence. Storage policy:
// reject-before-persist, no sensitive values ever stored, synthetic test
// data only in CI. Persist-first: the application is durable and
// admin-visible even if a notification email fails.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseCpaPartnerApplication,
  screenCpaPartnerApplication,
} from "@/lib/cpa-partners";
import { sendCpaPartnerEmails } from "@/lib/cpa-partners-email";
import { logSecurityEvent } from "@/lib/security-log";
import { SENSITIVE_DATA_GUIDANCE } from "@/lib/sensitive-data";

const EMAIL_COOLDOWN_MS = 10 * 60 * 1000;
const EMAIL_WINDOW_MAX = 3;
const GLOBAL_HOURLY_MAX = 30;
// Duplicate protection: the same firm email within this window is treated as
// a re-submission of the existing application, not a new record.
const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsed = parseCpaPartnerApplication(body);

  if (!parsed.ok && parsed.honeypot) {
    // Anti-spam honeypot: accept silently and persist nothing. The response
    // shape is identical so bots learn nothing about the guard.
    return NextResponse.json({
      success: true,
      id: "ok",
      notificationSent: false,
      confirmationSent: false,
    });
  }

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const payload = parsed.payload;

    // Server-side screen: public forms must never persist sensitive taxpayer
    // or client information, even when the UI warning is ignored or bypassed.
    const sensitiveFindings = screenCpaPartnerApplication({
      firmName: payload.firmName,
      contactName: payload.contactName,
      scopeNotes: payload.scopeNotes,
    });
    if (sensitiveFindings.length > 0) {
      logSecurityEvent("CPA_PARTNER_SENSITIVE_DATA_REJECTED");
      return NextResponse.json({ error: SENSITIVE_DATA_GUIDANCE }, { status: 400 });
    }

    const now = Date.now();
    const [sameEmailRecent, globalRecent] = await Promise.all([
      prisma.cpaPartnerApplication.count({
        where: { email: payload.email, createdAt: { gte: new Date(now - EMAIL_COOLDOWN_MS) } },
      }),
      prisma.cpaPartnerApplication.count({
        where: { createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
      }),
    ]);
    if (sameEmailRecent >= EMAIL_WINDOW_MAX || globalRecent >= GLOBAL_HOURLY_MAX) {
      return NextResponse.json(
        { error: "Too many requests right now. Please try again shortly." },
        { status: 429 },
      );
    }

    // Duplicate protection: an existing live application for the same firm
    // email within 24 hours is returned as-is (idempotent), so a double
    // submit or a retry never creates a second record. A declined
    // application older than the window, or a genuine re-apply later, is
    // accepted as a fresh application.
    const existing = await prisma.cpaPartnerApplication.findFirst({
      where: {
        email: payload.email,
        status: { not: "DECLINED" },
        createdAt: { gte: new Date(now - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        id: existing.id,
        duplicate: true,
        notificationSent: true,
        confirmationSent: true,
      });
    }

    // Persist first: every valid submission creates a durable record that
    // shows up in the admin portal, even if the notification email fails.
    // Two linked records: an identifiable CPA partner application in the
    // existing IntakeSubmission workflow, plus the partner-specific record
    // that carries the CPA pipeline fields.
    const submission = await prisma.intakeSubmission.create({
      data: {
        fullName: payload.contactName,
        email: payload.email,
        phone: payload.phone,
        businessName: payload.firmName,
        serviceSlug: "cpa-partner-application",
        description: payload.scopeNotes,
        contactMethod: "email",
      },
    });

    const application = await prisma.cpaPartnerApplication.create({
      data: {
        intakeSubmissionId: submission.id,
        firmName: payload.firmName,
        contactName: payload.contactName,
        email: payload.email,
        phone: payload.phone,
        serviceNeeds: JSON.stringify(payload.serviceNeeds),
        partnershipModel: payload.partnershipModel,
        scopeNotes: payload.scopeNotes,
        acknowledgement: payload.acknowledgement,
      },
    });

    const emails = await sendCpaPartnerEmails(payload, application.id);
    if (emails.notificationSent || emails.confirmationSent) {
      await prisma.cpaPartnerApplication.update({
        where: { id: application.id },
        data: { emailSent: true },
      });
    }

    return NextResponse.json({
      success: true,
      id: application.id,
      notificationSent: emails.notificationSent,
      confirmationSent: emails.confirmationSent,
    });
  } catch (error) {
    console.error("[cpa-partner-application] submission failed", error);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again shortly." },
      { status: 500 },
    );
  }
}
