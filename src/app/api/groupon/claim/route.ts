// Public Groupon voucher claim endpoint for the Nov 1 pilot (staging).
// Strictly non-sensitive: the form collects a redemption code plus basic
// contact fields, and never payment details, SSNs, or tax documents.
// Atomicity: the redemption code is unique, so a code can be claimed at most
// once. Every claim lands in PENDING_REVIEW for staff verification in
// Groupon Merchant Center; the voucher is marked redeemed in Groupon only
// after PK approves it. Every claim writes an audit-trail entry.
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { detectSensitiveData } from "@/lib/sensitive-data";
import { logSecurityEvent, safeAuditMetadata } from "@/lib/security-log";

const EMAIL_COOLDOWN_MS = 10 * 60 * 1000;
const EMAIL_WINDOW_MAX = 3;
const GLOBAL_HOURLY_MAX = 30;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{5,39}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const raw = (body ?? {}) as Record<string, unknown>;

  // Honeypot: bots fill the hidden field. Accept silently, persist nothing.
  if (str(raw.website, 200)) {
    return NextResponse.json({ success: true, id: "ok" });
  }

  const redemptionCode = str(raw.redemptionCode, 40);
  const fullName = str(raw.fullName, 120);
  const email = str(raw.email, 200).toLowerCase();
  const phone = str(raw.phone, 40);

  if (!CODE_PATTERN.test(redemptionCode)) {
    return NextResponse.json(
      { error: "Enter the redemption code exactly as it appears on your Groupon voucher." },
      { status: 400 },
    );
  }
  if (fullName.length < 2) {
    return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const contactBlob = `${fullName} ${email} ${phone}`;
  if (detectSensitiveData(contactBlob).length > 0) {
    // Reject-before-persist: never store sensitive content.
    logSecurityEvent("API_FAILURE");
    return NextResponse.json(
      { error: "For your security, this form cannot accept that information. Please remove it and try again." },
      { status: 400 },
    );
  }

  try {
    const now = Date.now();
    const [sameEmailRecent, globalRecent] = await Promise.all([
      prisma.grouponRedemption.count({
        where: { email, createdAt: { gte: new Date(now - EMAIL_COOLDOWN_MS) } },
      }),
      prisma.grouponRedemption.count({
        where: { createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
      }),
    ]);
    if (sameEmailRecent >= EMAIL_WINDOW_MAX || globalRecent >= GLOBAL_HOURLY_MAX) {
      return NextResponse.json(
        { error: "Too many requests right now. Please try again shortly." },
        { status: 429 },
      );
    }

    const claim = await prisma.grouponRedemption.create({
      data: {
        redemptionCode,
        fullName,
        email,
        phone: phone || null,
        auditTrail: JSON.stringify([
          {
            at: new Date().toISOString(),
            action: "claim_submitted",
            by: "customer",
          },
        ]),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "FORM_SUBMITTED",
        resource: "groupon_redemption",
        resourceId: claim.id,
        metadata: safeAuditMetadata({ action: "groupon_claim_submitted" }),
      },
    });

    return NextResponse.json({ success: true, id: claim.id });
  } catch (error) {
    // The unique constraint makes the claim atomic: a code already claimed
    // (in any state) rejects with one clear message, no duplicate rows.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "This code has already been claimed. If this is your voucher and you have not heard from us, reply to your confirmation email or contact PK Business Services.",
        },
        { status: 409 },
      );
    }
    logSecurityEvent("API_FAILURE");
    return NextResponse.json(
      { error: "Something went wrong. Please try again shortly." },
      { status: 500 },
    );
  }
}
