// Public Catch-Up 1040 intake endpoint. Strictly non-sensitive: the form
// never collects SSNs, DOBs, bank details, tax documents, or IRS credentials,
// and server-side screening rejects any sensitive content typed into free
// text BEFORE persistence. Storage policy: reject-before-persist, no
// sensitive values ever stored, synthetic test data only in CI.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseCatchupIntake,
  simpleEligibleFromScreening,
} from "@/lib/tax/catchup-intake";
import { sendCatchupIntakeEmails } from "@/lib/catchup-intake-email";
import { logSecurityEvent } from "@/lib/security-log";

const EMAIL_COOLDOWN_MS = 10 * 60 * 1000;
const EMAIL_WINDOW_MAX = 3;
const GLOBAL_HOURLY_MAX = 30;

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsed = parseCatchupIntake(body);

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
    const now = Date.now();

    const [sameEmailRecent, globalRecent] = await Promise.all([
      prisma.taxCatchupIntake.count({
        where: { email: payload.email, createdAt: { gte: new Date(now - EMAIL_COOLDOWN_MS) } },
      }),
      prisma.taxCatchupIntake.count({
        where: { createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
      }),
    ]);
    if (sameEmailRecent >= EMAIL_WINDOW_MAX || globalRecent >= GLOBAL_HOURLY_MAX) {
      return NextResponse.json(
        { error: "Too many requests right now. Please try again shortly." },
        { status: 429 },
      );
    }

    // Persist first: the record is durable and admin-visible even if a
    // notification email fails.
    const submission = await prisma.taxCatchupIntake.create({
      data: {
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        contactMethod: payload.contactMethod,
        contactTime: payload.contactTime,
        taxYears: JSON.stringify(payload.taxYears),
        filingStatuses: JSON.stringify(payload.filingStatuses),
        alreadyFiled: JSON.stringify(payload.alreadyFiled),
        complexity: JSON.stringify(payload.complexity),
        notes: payload.notes,
        states: JSON.stringify(payload.states),
        hasNotices: payload.hasNotices,
        recordsStatus: payload.recordsStatus,
        simpleEligible: simpleEligibleFromScreening(parsed.screening),
      },
    });

    const emails = await sendCatchupIntakeEmails(payload, parsed.screening);
    const emailSent = emails.notificationSent || emails.confirmationSent;
    if (emailSent) {
      await prisma.taxCatchupIntake.update({
        where: { id: submission.id },
        data: { emailSent },
      });
    } else {
      logSecurityEvent("CATCHUP_EMAIL_FAILURE");
    }

    return NextResponse.json({
      success: true,
      id: submission.id,
      notificationSent: emails.notificationSent,
      confirmationSent: emails.confirmationSent,
    });
  } catch {
    logSecurityEvent("CONTACT_SUBMISSION_FAILURE");
    return NextResponse.json(
      { error: "We could not send your request right now. Please try again shortly." },
      { status: 500 },
    );
  }
}
