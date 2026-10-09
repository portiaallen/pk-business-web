import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import {
  assertResourceEnvironment,
  securityEnvironment,
  localSyntheticSetupAllowed,
} from "@/lib/security-environment";
import { ApiError } from "@/lib/api-error";
import type { Tx } from "./access";
import { audit } from "./access";
export const NOTICE = {
  PAYMENT:
    "Your readiness assessment payment is confirmed. Continue setup through the PK readiness page.",
  SUBMISSION:
    "Your readiness assessment has been submitted for PK review. Sign in to the PK client portal for updates.",
  MISSING_INFORMATION:
    "PK has requested additional information. Sign in to the PK client portal for secure instructions. Do not reply with confidential records.",
  REPORT:
    "Your final Readiness Report is available in your secure PK client portal. Sign in to review your report and any credit eligibility.",
  CREDIT_APPROVED:
    "PK has approved your readiness service credit. Sign in to the PK client portal for eligibility and deadlines.",
  CREDIT_REJECTED:
    "PK has reviewed your readiness credit claim. Sign in to the PK client portal for the decision.",
  REMINDER:
    "Your paid readiness assessment is waiting for your next step. Sign in to the PK client portal or contact PK if you need help.",
} as const;
export type Notice = keyof typeof NOTICE;
const syntheticMessages: Array<{ to: string; subject: string; text: string }> =
  [];
export function mailConfigured() {
  if (process.env.PK_READINESS_MAIL_MODE === "synthetic")
    return localSyntheticSetupAllowed();
  try {
    assertResourceEnvironment("EMAIL");
  } catch {
    return false;
  }
  return (
    !!process.env.GMAIL_USER?.trim() &&
    !!process.env.GMAIL_APP_PASSWORD?.trim() &&
    (securityEnvironment() === "production" ||
      !!process.env.PK_READINESS_EMAIL_SINK?.trim())
  );
}
export function syntheticMail() {
  if (
    process.env.PK_READINESS_MAIL_MODE !== "synthetic" ||
    !localSyntheticSetupAllowed()
  )
    throw new Error("SYNTHETIC_MAIL_UNAVAILABLE");
  return syntheticMessages;
}
export async function sendMail(to: string, subject: string, text: string) {
  if (!mailConfigured())
    throw new ApiError(503, "Approved email delivery is not configured");
  if (process.env.PK_READINESS_MAIL_MODE === "synthetic") {
    syntheticMessages.push({ to, subject, text });
    return;
  }
  assertResourceEnvironment("EMAIL");
  const recipient =
    securityEnvironment() === "production"
      ? to
      : process.env.PK_READINESS_EMAIL_SINK!.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))
    throw new ApiError(503, "Approved email recipient is not configured");
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER!.trim(),
      pass: process.env.GMAIL_APP_PASSWORD!.trim(),
    },
  });
  await transport.sendMail({
    from: `PK Business Services <${process.env.GMAIL_USER!.trim()}>`,
    to: recipient,
    subject,
    text,
  });
}
export async function notify(
  tx: Tx,
  assessmentId: string,
  userId: string | null,
  type: Notice,
  key: string,
) {
  const metadata = JSON.stringify({ assessmentId, type });
  await tx.notification.upsert({
    where: { dedupeKey: `READINESS_EMAIL:${key}` },
    update: {},
    create: {
      dedupeKey: `READINESS_EMAIL:${key}`,
      userId,
      channel: "EMAIL",
      subject: "PK Readiness Assessment update",
      body: NOTICE[type],
      metadata,
    },
  });
  if (userId)
    await tx.notification.upsert({
      where: { dedupeKey: `READINESS_PORTAL:${key}` },
      update: {},
      create: {
        dedupeKey: `READINESS_PORTAL:${key}`,
        userId,
        channel: "IN_APP",
        status: "SENT",
        sentAt: new Date(),
        subject: "PK Readiness Assessment update",
        body: NOTICE[type],
        metadata,
      },
    });
}
/** Existing Notification table is an outbox. Leases permit bounded retry; no exception details are persisted. */
export async function dispatchNotices(limit = 20) {
  if (!mailConfigured())
    throw new ApiError(503, "Approved email delivery is not configured");
  const now = new Date();
  const pending = await prisma.notification.findMany({
    where: {
      channel: "EMAIL",
      dedupeKey: { startsWith: "READINESS_EMAIL:" },
      status: { in: ["PENDING", "FAILED"] },
      AND: [
        { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
      ],
    },
    take: Math.min(limit, 50),
    orderBy: { createdAt: "asc" },
  });
  let sent = 0,
    failed = 0;
  for (const notice of pending) {
    const leased = await prisma.notification.updateMany({
      where: {
        id: notice.id,
        status: { in: ["PENDING", "FAILED"] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }],
      },
      data: {
        leaseUntil: new Date(now.getTime() + 120000),
        attemptCount: { increment: 1 },
      },
    });
    if (!leased.count) continue;
    try {
      const { assessmentId } = JSON.parse(notice.metadata) as {
        assessmentId: string;
      };
      const a = await prisma.readinessAssessment.findUniqueOrThrow({
        where: { id: assessmentId },
        include: { preliminary: true },
      });
      await sendMail(a.preliminary.email, notice.subject, notice.body);
      await prisma.$transaction(async (tx) => {
        await tx.notification.update({
          where: { id: notice.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            leaseUntil: null,
            nextAttemptAt: null,
          },
        });
        await audit(tx, null, a, "NOTIFICATION_SENT");
      });
      sent++;
    } catch {
      await prisma.notification.update({
        where: { id: notice.id },
        data: {
          status: "FAILED",
          leaseUntil: null,
          nextAttemptAt: new Date(
            Date.now() +
              Math.min(3600000, 60000 * 2 ** Math.min(notice.attemptCount, 6)),
          ),
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}
