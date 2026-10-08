import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { ApiError } from "@/lib/api-error";
import { logSecurityEvent } from "@/lib/security-log";
import { audit, type Tx } from "./access";
import { PRICE_CENTS } from "./policy";
import { limitPublic, purchaseCookie, requireEnabled } from "./purchase";
import { mailConfigured, sendMail } from "./notifications";

export const recoveryEmail = z
  .email()
  .max(254)
  .transform((s) => s.toLowerCase());
const accepted = { accepted: true };
const ttl = 10 * 60000;
const setupTtl = 15 * 60000;
const paidPurchase = {
  ownerUserId: null,
  status: "PAID",
  paymentStatus: "PAID",
  priceCents: PRICE_CENTS,
  currency: "USD",
  client: { status: "ACTIVE" as const },
  payment: {
    status: "PAID" as const,
    method: "STRIPE" as const,
    amountCents: PRICE_CENTS,
    currency: "USD",
  },
};

// Commit rate counters separately, including for unknown email and rejected credentials.
async function limit(
  request: Request,
  email: string,
  operation: "send" | "verify",
) {
  await prisma.$transaction(async (tx) => {
    await limitPublic(
      tx,
      request,
      `recovery_${operation}`,
      operation === "send" ? 10 : 30,
    );
    const key = hashToken(`readiness-recovery-rate:${operation}:${email}`);
    const now = new Date();
    const old = await tx.readinessPublicRateLimit.findUnique({
      where: { key },
    });
    if (!old || old.expiresAt <= now) {
      await tx.readinessPublicRateLimit.upsert({
        where: { key },
        update: { count: 1, expiresAt: new Date(now.getTime() + 900000) },
        create: { key, count: 1, expiresAt: new Date(now.getTime() + 900000) },
      });
    } else {
      const increment = await tx.readinessPublicRateLimit.updateMany({
        where: {
          key,
          count: { lt: operation === "send" ? 3 : 10 },
          expiresAt: { gt: now },
        },
        data: { count: { increment: 1 } },
      });
      if (!increment.count)
        throw new ApiError(429, "Please wait before trying again");
    }
  });
}
function digest(email: string, code: string) {
  return hashToken(`readiness-recovery:${email}:${code}`);
}
async function eligible(tx: Tx, email: string, codeHash?: string) {
  const a = await tx.readinessAssessment.findFirst({
    where: {
      ...paidPurchase,
      preliminary: { email },
      ...(codeHash
        ? {
            recoveryCodeHash: codeHash,
            recoveryCodeExpiresAt: { gt: new Date() },
          }
        : {}),
    },
    include: { payment: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  // Match the original verified ledger, not merely a mutable fulfillment label.
  if (!a?.payment) return null;
  return a.payment.clientId === a.clientId &&
    a.payment.invoiceId === a.invoiceId &&
    a.payment.requestId === a.requestId
    ? a
    : null;
}

export async function requestRecovery(request: Request, input: unknown) {
  requireEnabled();
  if (!mailConfigured())
    throw new ApiError(503, "Approved email delivery is not configured");
  const { email } = z.object({ email: recoveryEmail }).strict().parse(input);
  try {
    await limit(request, email, "send");
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 429) return accepted;
    throw error;
  }
  const code = randomBytes(16).toString("hex");
  const codeHash = digest(email, code);
  const a = await prisma
    .$transaction(async (tx) => {
      const purchase = await eligible(tx, email);
      if (!purchase) return null;
      await tx.readinessAssessment.update({
        where: { id: purchase.id },
        data: {
          recoveryCodeHash: codeHash,
          recoveryCodeExpiresAt: new Date(Date.now() + ttl),
        },
      });
      await audit(tx, null, purchase, "SETUP_RECOVERY_REQUESTED");
      return purchase;
    })
    .catch(() => {
      // An assessment-specific persistence failure must not identify its purchaser.
      logSecurityEvent("API_FAILURE");
      return null;
    });
  try {
    // Same email and SMTP path for every valid address. No name, assessment ID,
    // bearer URL or report data, even when challenge persistence fails.
    await sendMail(
      email,
      "PK Readiness setup recovery",
      `If you have a paid Readiness Assessment awaiting account setup, enter this recovery code on the PK readiness setup page: ${code}. It expires in 10 minutes and can be used once. Use only the most recent code. If your account is already set up, sign in to the PK client portal. Do not share this code or send confidential records by email.`,
    );
  } catch {
    if (a)
      await prisma.readinessAssessment
        .updateMany({
          where: { id: a.id, recoveryCodeHash: codeHash },
          data: { recoveryCodeHash: null, recoveryCodeExpiresAt: null },
        })
        .catch(() => {
          logSecurityEvent("API_FAILURE");
        });
    // Delivery failure must not reveal whether a purchase exists.
  }
  return accepted;
}

export async function recoverSetup(request: Request, input: unknown) {
  requireEnabled();
  const { email, code } = z
    .object({
      email: recoveryEmail,
      code: z.string().regex(/^[a-f0-9]{32}$/),
    })
    .strict()
    .parse(input);
  await limit(request, email, "verify");
  const codeHash = digest(email, code);
  const token = randomBytes(32).toString("hex");
  await prisma.$transaction(async (tx) => {
    const a = await eligible(tx, email, codeHash);
    if (!a)
      throw ApiError.badRequest(
        "Recovery could not be verified; request a fresh code",
      );
    const consumed = await tx.readinessAssessment.updateMany({
      where: {
        id: a.id,
        version: a.version,
        ...paidPurchase,
        recoveryCodeHash: codeHash,
        recoveryCodeExpiresAt: { gt: new Date() },
      },
      data: {
        recoveryCodeHash: null,
        recoveryCodeExpiresAt: null,
        purchaseTokenHash: hashToken(`readiness-purchase:${token}`),
        purchaseExpiresAt: new Date(Date.now() + setupTtl),
        onboardingCodeHash: null,
        onboardingCodeExpiresAt: null,
        onboardingCodeSentAt: null,
        onboardingCodeAttempts: 0,
        version: { increment: 1 },
      },
    });
    if (!consumed.count)
      throw ApiError.badRequest(
        "Recovery could not be verified; request a fresh code",
      );
    await audit(tx, null, a, "SETUP_RECOVERY_VERIFIED");
  });
  // Recovery restores only setup access, never an authenticated client session.
  return {
    cookie: purchaseCookie(token, setupTtl / 1000),
  };
}
