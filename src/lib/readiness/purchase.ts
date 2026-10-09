import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  hashToken,
  hashPassword,
  createSession,
  buildSessionCookie,
} from "@/lib/auth";
import { isStripeConfigured } from "@/lib/invoices";
import { ApiError } from "@/lib/api-error";
import {
  securityEnvironment,
  localSyntheticSetupAllowed,
} from "@/lib/security-environment";
import { safeOrigin } from "@/lib/url-privacy";
import { PRICE_CENTS, PRODUCT_NAME, preliminaryInput } from "./policy";
import { audit, session, type Tx } from "./access";
import { track } from "./analytics";
import { mailConfigured, sendMail, notify } from "./notifications";

export const PURCHASE_COOKIE = "pk_readiness_purchase";
export function purchaseToken(request: Request) {
  const values = (request.headers.get("cookie") || "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(`${PURCHASE_COOKIE}=`));
  if (values.length !== 1) return null;
  const token = values[0].slice(PURCHASE_COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function purchaseCookie(token: string) {
  return `${PURCHASE_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
export function readinessEnabled() {
  // Production launch is deliberately closed until the independently qualified secure workflow exists.
  return (
    process.env.PK_READINESS_ENABLED === "true" && localSyntheticSetupAllowed()
  );
}
export function availability() {
  return {
    enabled: readinessEnabled(),
    checkoutAvailable:
      readinessEnabled() && isStripeConfigured() && mailConfigured(),
    priceCents: PRICE_CENTS,
    currency: "USD",
  };
}
export function requireEnabled() {
  if (!readinessEnabled())
    throw new ApiError(
      503,
      "Readiness purchasing is not available in this environment",
    );
}
export async function limitPublic(
  tx: Tx,
  request: Request,
  operation: string,
  maximum = 30,
) {
  const address =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local";
  const key = hashToken(`readiness-rate:${operation}:${address}`);
  const now = new Date();
  const old = await tx.readinessPublicRateLimit.findUnique({ where: { key } });
  if (!old || old.expiresAt <= now) {
    await tx.readinessPublicRateLimit.upsert({
      where: { key },
      update: { count: 1, expiresAt: new Date(now.getTime() + 900000) },
      create: { key, count: 1, expiresAt: new Date(now.getTime() + 900000) },
    });
    return;
  }
  const result = await tx.readinessPublicRateLimit.updateMany({
    where: { key, count: { lt: maximum }, expiresAt: { gt: now } },
    data: { count: { increment: 1 } },
  });
  if (!result.count) throw new ApiError(429, "Please wait before trying again");
}
export async function purchaseAssessment(tx: Tx, request: Request) {
  const token = purchaseToken(request);
  if (!token) throw ApiError.unauthorized();
  const assessment = await tx.readinessAssessment.findUnique({
    where: { purchaseTokenHash: hashToken(`readiness-purchase:${token}`) },
  });
  if (!assessment || assessment.purchaseExpiresAt <= new Date())
    throw ApiError.unauthorized();
  return assessment;
}
export async function startPurchase(request: Request, input: unknown) {
  requireEnabled();
  const fields = preliminaryInput.parse(input);
  let token = purchaseToken(request) || randomBytes(32).toString("hex");
  const result = await prisma.$transaction(async (tx) => {
    await limitPublic(tx, request, "start", 20);
    let tokenHash = hashToken(`readiness-purchase:${token}`);
    const existing = await tx.readinessAssessment.findUnique({
      where: { purchaseTokenHash: tokenHash },
    });
    if (existing && existing.purchaseExpiresAt > new Date()) return existing;
    if (existing) {
      token = randomBytes(32).toString("hex");
      tokenHash = hashToken(`readiness-purchase:${token}`);
    }
    // A random server token is the retry key, not browser-supplied pricing or account identity.
    const service = await tx.service.upsert({
      where: { slug: "readiness-assessment" },
      update: {},
      create: {
        slug: "readiness-assessment",
        name: PRODUCT_NAME,
        shortName: "Readiness Assessment",
        description: "Professional readiness diagnostic and written report",
        shortDescription: "Books, business and tax-season readiness",
        priceDisplay: "$99 one time",
        priceCents: PRICE_CENTS,
      },
    });
    if (service.priceCents !== PRICE_CENTS || service.status !== "ACTIVE")
      throw new ApiError(
        503,
        "The readiness product configuration requires review",
      );
    const preliminary = await tx.intakeSubmission.create({
      data: {
        fullName: fields.name,
        email: fields.email,
        serviceSlug: service.slug,
        description: JSON.stringify({
          businessType: fields.businessType,
          bookkeeping: fields.bookkeeping,
          concern: fields.concern,
          consent: true,
        }),
      },
    });
    const client = await tx.client.create({ data: { name: fields.name } });
    const engagement = await tx.verificationRequest.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        requestType: "READINESS_ASSESSMENT",
      },
    });
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: `PK-RA-${randomUUID()}`,
        clientId: client.id,
        requestId: engagement.id,
        serviceId: service.id,
        description: PRODUCT_NAME,
        amountCents: PRICE_CENTS,
        subtotalCents: PRICE_CENTS,
        currency: "USD",
        status: "SENT",
        issueAt: new Date(),
        lineItems: JSON.stringify([
          {
            description: PRODUCT_NAME,
            quantity: 1,
            rateCents: PRICE_CENTS,
            amountCents: PRICE_CENTS,
          },
        ]),
      },
    });
    const a = await tx.readinessAssessment.create({
      data: {
        clientId: client.id,
        requestId: engagement.id,
        intakeSubmissionId: preliminary.id,
        invoiceId: invoice.id,
        purchaseTokenHash: tokenHash,
        purchaseExpiresAt: new Date(Date.now() + 86400000),
      },
    });
    await audit(tx, null, a, "PURCHASE_STARTED");
    await track(tx, "preliminary_intake_completed", a.id);
    return a;
  });
  return {
    assessmentId: result.id,
    status: result.status,
    cookie: purchaseCookie(token),
  };
}
function checkoutOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return safeOrigin(configured);
  const url = new URL(request.url);
  if (
    !["production", "preview"].includes(securityEnvironment()) &&
    ["localhost", "127.0.0.1"].includes(url.hostname)
  )
    return url.origin;
  throw new ApiError(503, "Approved checkout origin is required");
}
export async function beginCheckout(request: Request) {
  requireEnabled();
  if (!isStripeConfigured())
    throw new ApiError(503, "Card checkout is not configured");
  if (!mailConfigured())
    throw new ApiError(503, "Approved onboarding email is not configured");
  const a = await prisma.$transaction(async (tx) => {
    await limitPublic(tx, request, "checkout", 30);
    const assessment = await purchaseAssessment(tx, request);
    if (assessment.paymentStatus === "PAID") return assessment;
    if (!["PURCHASE_STARTED", "PAYMENT_PENDING"].includes(assessment.status))
      throw ApiError.conflict("Checkout is not available for this assessment");
    await tx.readinessAssessment.update({
      where: { id: assessment.id },
      data: { status: "PAYMENT_PENDING" },
    });
    return assessment;
  });
  if (a.paymentStatus === "PAID")
    return { paid: true, url: "/readiness/start" };
  const origin = checkoutOrigin(request);
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("payment_method_types[0]", "card");
  form.set("client_reference_id", a.id);
  form.set("metadata[readinessAssessmentId]", a.id);
  form.set("line_items[0][price_data][currency]", "usd");
  form.set("line_items[0][price_data][unit_amount]", String(PRICE_CENTS));
  form.set("line_items[0][price_data][product_data][name]", PRODUCT_NAME);
  form.set("line_items[0][quantity]", "1");
  form.set("success_url", `${origin}/readiness/start?checkout=success`);
  form.set("cancel_url", `${origin}/readiness/start?checkout=cancelled`);
  let response: Response;
  try {
    response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY!.trim()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `pk-readiness-${a.id}`,
      },
      body: form,
    });
  } catch {
    throw new ApiError(502, "Checkout could not be started; retry safely");
  }
  const data = await response.json().catch(() => null);
  let url: URL;
  try {
    url = new URL(data.url);
  } catch {
    throw new ApiError(502, "Invalid checkout response");
  }
  if (
    !response.ok ||
    typeof data.id !== "string" ||
    !/^cs_[A-Za-z0-9_]+$/.test(data.id) ||
    data.mode !== "payment" ||
    data.livemode !== (securityEnvironment() === "production") ||
    data.amount_total !== PRICE_CENTS ||
    data.currency !== "usd" ||
    data.client_reference_id !== a.id ||
    data.metadata?.readinessAssessmentId !== a.id ||
    url.protocol !== "https:" ||
    url.hostname !== "checkout.stripe.com" ||
    url.port ||
    url.username ||
    url.password
  )
    throw new ApiError(502, "Invalid checkout response");
  if (data.status === "expired")
    throw ApiError.conflict(
      "Checkout has expired; contact PK before starting another purchase",
    );
  await prisma.$transaction(async (tx) => {
    const current = await tx.readinessAssessment.findUniqueOrThrow({
      where: { id: a.id },
    });
    if (current.stripeSessionId && current.stripeSessionId !== data.id)
      throw ApiError.conflict("Checkout association changed");
    await tx.readinessAssessment.update({
      where: { id: a.id },
      data: { stripeSessionId: data.id },
    });
    await track(tx, "checkout_started", a.id);
  });
  return { paid: false, url: url.href };
}
export async function publicStatus(request: Request) {
  return prisma.$transaction(async (tx) => {
    const a = await purchaseAssessment(tx, request);
    return {
      assessmentId: a.id,
      clientId: a.clientId,
      status: a.status,
      paymentStatus: a.paymentStatus,
      accountReady: !!a.ownerUserId,
      ...availability(),
    };
  });
}
/** Called only inside the existing verified Stripe webhook transaction. */
export async function recordPayment(
  tx: Tx,
  sessionData: Record<string, unknown>,
) {
  const metadata = sessionData.metadata as Record<string, unknown> | undefined;
  const id = metadata?.readinessAssessmentId;
  if (typeof id !== "string")
    throw ApiError.badRequest("Readiness association is missing");
  const a = await tx.readinessAssessment.findUnique({ where: { id } });
  if (
    !a ||
    sessionData.client_reference_id !== a.id ||
    typeof sessionData.id !== "string" ||
    !/^cs_[A-Za-z0-9_]+$/.test(sessionData.id) ||
    (a.stripeSessionId && a.stripeSessionId !== sessionData.id) ||
    sessionData.amount_total !== PRICE_CENTS ||
    sessionData.currency !== "usd" ||
    sessionData.payment_status !== "paid" ||
    sessionData.mode !== "payment" ||
    sessionData.status !== "complete" ||
    a.priceCents !== PRICE_CENTS ||
    a.currency !== "USD"
  )
    throw ApiError.badRequest("Readiness payment does not match the purchase");
  if (a.paymentStatus === "PAID") return { duplicate: true };
  if (
    !["PURCHASE_STARTED", "PAYMENT_PENDING"].includes(a.status) ||
    a.paymentStatus !== "PENDING"
  )
    throw ApiError.conflict("Payment requires administrative review");
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: a.invoiceId },
  });
  if (
    invoice.amountCents !== PRICE_CENTS ||
    invoice.currency !== "USD" ||
    invoice.clientId !== a.clientId ||
    !["SENT", "VIEWED"].includes(invoice.status)
  )
    throw ApiError.conflict("Purchase invoice requires administrative review");
  const intent =
    typeof sessionData.payment_intent === "string"
      ? sessionData.payment_intent
      : null;
  if (!intent || !/^pi_[A-Za-z0-9_]+$/.test(intent))
    throw ApiError.badRequest("Verified payment reference is required");
  if (
    await tx.payment.findFirst({
      where: {
        OR: [
          { method: "STRIPE", transactionReference: sessionData.id },
          { method: "STRIPE", providerReference: intent },
        ],
      },
    })
  )
    throw ApiError.conflict(
      "Payment reference is already associated with a purchase",
    );
  const payment = await tx.payment.create({
    data: {
      clientId: a.clientId,
      requestId: a.requestId,
      invoiceId: a.invoiceId,
      amountCents: PRICE_CENTS,
      currency: "USD",
      status: "PAID",
      method: "STRIPE",
      transactionReference: sessionData.id,
      providerReference: intent,
      paidAt: new Date(),
    },
  });
  const updated = await tx.readinessAssessment.updateMany({
    where: { id: a.id, paymentStatus: "PENDING" },
    data: {
      paymentStatus: "PAID",
      status: "PAID",
      paymentId: payment.id,
      stripeSessionId: sessionData.id,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1)
    throw ApiError.conflict("Payment changed; retry the verified webhook");
  await tx.invoice.update({
    where: { id: a.invoiceId },
    data: { status: "PAID", paidAt: new Date() },
  });
  await tx.invoiceActivity.create({
    data: { invoiceId: a.invoiceId, event: "READINESS_PAYMENT_VERIFIED" },
  });
  await audit(tx, null, a, "PAYMENT_VERIFIED", { amountCents: PRICE_CENTS });
  await notify(tx, a.id, a.ownerUserId, "PAYMENT", `${a.id}:payment`);
  await track(tx, "purchase_success", a.id);
  return { duplicate: false };
}
export async function requestOnboardingCode(request: Request) {
  requireEnabled();
  const code = String(randomInt(100000, 1000000));
  const result = await prisma.$transaction(async (tx) => {
    await limitPublic(tx, request, "onboarding_code", 10);
    const a = await purchaseAssessment(tx, request);
    if (a.paymentStatus !== "PAID" || a.ownerUserId)
      throw ApiError.conflict("Account setup is not available");
    if (
      a.onboardingCodeSentAt &&
      Date.now() - a.onboardingCodeSentAt.getTime() < 60000
    )
      throw new ApiError(429, "Please wait before requesting another code");
    const preliminary = await tx.intakeSubmission.findUniqueOrThrow({
      where: { id: a.intakeSubmissionId },
    });
    await tx.readinessAssessment.update({
      where: { id: a.id },
      data: {
        onboardingCodeHash: hashToken(`readiness-code:${a.id}:${code}`),
        onboardingCodeExpiresAt: new Date(Date.now() + 600000),
        onboardingCodeAttempts: 0,
        onboardingCodeSentAt: new Date(),
      },
    });
    return { a, email: preliminary.email };
  });
  try {
    await sendMail(
      result.email,
      "Verify your PK Readiness Assessment account",
      `Your one-time PK account setup code is ${code}. It expires in 10 minutes. Do not share this code. PK will never ask you to send taxpayer documents by email.`,
    );
  } catch {
    await prisma.readinessAssessment.update({
      where: { id: result.a.id },
      data: { onboardingCodeHash: null, onboardingCodeSentAt: null },
    });
    throw new ApiError(
      503,
      "Account verification email could not be delivered",
    );
  }
  await prisma.$transaction((tx) =>
    audit(tx, null, result.a, "ONBOARDING_CODE_SENT"),
  );
  return { sent: true };
}
export async function onboard(request: Request, input: unknown) {
  requireEnabled();
  const fields = z
    .object({
      code: z
        .string()
        .regex(/^\d{6}$/)
        .optional(),
      password: z
        .string()
        .min(12)
        .max(72)
        .refine((s) => Buffer.byteLength(s) <= 72)
        .optional(),
      useExistingAccount: z.boolean().default(false),
    })
    .strict()
    .parse(input);
  const pre = await prisma.$transaction(async (tx) => {
    await limitPublic(tx, request, "onboard", 15);
    const a = await purchaseAssessment(tx, request);
    if (a.paymentStatus !== "PAID")
      throw ApiError.conflict("Verified payment is required");
    const p = await tx.intakeSubmission.findUniqueOrThrow({
      where: { id: a.intakeSubmissionId },
    });
    if (!fields.useExistingAccount) {
      if (
        !fields.code ||
        !fields.password ||
        !a.onboardingCodeHash ||
        !a.onboardingCodeExpiresAt ||
        a.onboardingCodeExpiresAt <= new Date() ||
        a.onboardingCodeAttempts >= 5 ||
        a.onboardingCodeHash !==
          hashToken(`readiness-code:${a.id}:${fields.code}`)
      ) {
        await tx.readinessAssessment.update({
          where: { id: a.id },
          data: { onboardingCodeAttempts: { increment: 1 } },
        });
        return { invalid: true as const };
      }
    }
    return { invalid: false as const, a, p };
  });
  if (pre.invalid)
    throw ApiError.badRequest("Account verification was not accepted");
  const passwordHash = fields.password
    ? await hashPassword(fields.password)
    : null;
  const userId = await prisma.$transaction(async (tx) => {
    const a = await purchaseAssessment(tx, request);
    if (a.ownerUserId) {
      const u = await session(tx, request);
      if (u.id !== a.ownerUserId)
        throw ApiError.conflict("Sign in to the existing account");
      return u.id;
    }
    let u;
    if (fields.useExistingAccount) {
      u = await session(tx, request);
      if (u.role !== "CLIENT" || u.email !== pre.p.email)
        throw ApiError.forbidden(
          "Sign in with the email used for this purchase",
        );
    } else {
      if (
        !passwordHash ||
        a.onboardingCodeHash !== pre.a.onboardingCodeHash ||
        !a.onboardingCodeExpiresAt ||
        a.onboardingCodeExpiresAt <= new Date() ||
        a.onboardingCodeAttempts >= 5
      )
        throw ApiError.conflict("Verification changed; request a fresh code");
      if (await tx.user.findUnique({ where: { email: pre.p.email } }))
        throw ApiError.conflict(
          "Sign in to your existing PK account; its credentials will not be changed",
        );
      u = await tx.user.create({
        data: {
          email: pre.p.email,
          name: pre.p.fullName,
          passwordHash,
          role: "CLIENT",
        },
      });
    }
    await tx.clientMember.upsert({
      where: { clientId_userId: { clientId: a.clientId, userId: u.id } },
      update: {},
      create: { clientId: a.clientId, userId: u.id, role: "OWNER" },
    });
    const updated = await tx.readinessAssessment.updateMany({
      where: { id: a.id, ownerUserId: null },
      data: {
        ownerUserId: u.id,
        emailVerifiedAt: new Date(),
        onboardingCodeHash: null,
        status: "INTAKE_IN_PROGRESS",
        version: { increment: 1 },
      },
    });
    if (!updated.count)
      throw ApiError.conflict("Account setup changed; retry safely");
    await audit(tx, u.id, a, "ACCOUNT_BOUND");
    await track(tx, "intake_started", a.id);
    return u.id;
  });
  // Existing-account binding does not silently replace its session or active client.
  let cookie: string | undefined;
  if (!fields.useExistingAccount)
    cookie = buildSessionCookie(await createSession(userId));
  return {
    accountReady: true,
    clientId: pre.a.clientId,
    assessmentId: pre.a.id,
    cookie,
  };
}

/** Reconcile provider-confirmed refunds; this never initiates a refund or overrides PK policy. */
export async function recordRefund(tx: Tx, charge: Record<string, unknown>) {
  if (typeof charge.payment_intent !== "string") return { ignored: true };
  const payment = await tx.payment.findFirst({
    where: { method: "STRIPE", providerReference: charge.payment_intent },
    include: { readinessPurchase: true },
  });
  if (!payment?.readinessPurchase) return { ignored: true };
  const a = payment.readinessPurchase;
  if (
    charge.object !== "charge" ||
    charge.amount !== PRICE_CENTS ||
    charge.currency !== "usd" ||
    !Number.isSafeInteger(charge.amount_refunded) ||
    (charge.amount_refunded as number) <= 0 ||
    (charge.amount_refunded as number) > PRICE_CENTS
  )
    throw ApiError.badRequest("Refund does not match the readiness payment");
  const full = charge.amount_refunded === PRICE_CENTS;
  if (
    a.paymentStatus === "REFUNDED" ||
    (!full && a.paymentStatus === "REFUND_REVIEW")
  )
    return { duplicate: true };
  await tx.readinessAssessment.update({
    where: { id: a.id },
    data: {
      paymentStatus: full ? "REFUNDED" : "REFUND_REVIEW",
      status: full ? "REFUNDED" : "CLOSED",
      closedAt: new Date(),
      version: { increment: 1 },
    },
  });
  if (full) {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: "REFUNDED" },
    });
    await tx.invoice.update({
      where: { id: a.invoiceId },
      data: { status: "REFUNDED" },
    });
  }
  const credit = await tx.readinessCredit.findUnique({
    where: { assessmentId: a.id },
  });
  if (credit && !["APPLIED", "VOIDED"].includes(credit.status))
    await tx.readinessCredit.update({
      where: { id: credit.id },
      data: { status: "VOIDED", version: { increment: 1 } },
    });
  await audit(
    tx,
    null,
    a,
    full ? "PROVIDER_REFUND_VERIFIED" : "PROVIDER_PARTIAL_REFUND_REVIEW",
    { amountCents: charge.amount_refunded as number },
  );
  if (credit?.status === "APPLIED")
    await audit(tx, null, a, "APPLIED_CREDIT_REFUND_REVIEW_REQUIRED");
  return {
    refunded: full,
    reviewRequired: !full || credit?.status === "APPLIED",
  };
}
