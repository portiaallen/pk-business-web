import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, handleApiError } from "@/lib/api-error";
import { paidCentsOf, isStripeConfigured } from "@/lib/invoices";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function verifyStripeSignature(
  payload: string,
  header: string | null,
  webhookSecret: string
): boolean {
  if (!header) return false;

  const fields = header.split(",").map((field) => field.split("=", 2));
  const timestamp = fields.find(([key]) => key === "t")?.[1];
  const signatures = fields
    .filter(([key]) => key === "v1")
    .map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;

  const timestampSeconds = Number(timestamp);
  if (
    !Number.isSafeInteger(timestampSeconds) ||
    Math.abs(Date.now() / 1000 - timestampSeconds) > 300
  ) {
    return false;
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest();
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const candidate = Buffer.from(signature, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

function configuredStripeMode(secretKey: string): "test" | "live" | null {
  const mode = /^(?:sk|rk)_(test|live)_/.exec(secretKey)?.[1];
  return mode === "test" || mode === "live" ? mode : null;
}

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!isStripeConfigured() || !webhookSecret || !secretKey) {
      throw new ApiError(503, "Stripe webhook processing is not configured.");
    }
    const keyMode = configuredStripeMode(secretKey);
    if (!keyMode) throw new ApiError(503, "Stripe webhook processing is not configured.");

    const payload = await request.text();
    if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), webhookSecret)) {
      throw ApiError.badRequest("Invalid Stripe signature.");
    }

    let event: unknown;
    try {
      event = JSON.parse(payload);
    } catch {
      throw ApiError.badRequest("Invalid Stripe event.");
    }
    if (!isRecord(event) || typeof event.type !== "string" || typeof event.livemode !== "boolean") {
      throw ApiError.badRequest("Invalid Stripe event.");
    }
    if (event.livemode !== (keyMode === "live")) {
      throw ApiError.badRequest("Stripe event mode does not match the configured key.");
    }

    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded"
    ) {
      return NextResponse.json({ received: true });
    }

    const data = isRecord(event.data) ? event.data : null;
    const session = data && isRecord(data.object) ? data.object : null;
    if (!session || session.object !== "checkout.session") {
      throw ApiError.badRequest("Invalid Checkout session event.");
    }

    if (session.payment_status !== "paid") {
      if (event.type === "checkout.session.completed") {
        return NextResponse.json({ received: true, pending: true });
      }
      throw ApiError.badRequest("Checkout session is not paid.");
    }

    const sessionId = session.id;
    const invoiceId = session.client_reference_id;
    const metadata = isRecord(session.metadata) ? session.metadata : null;
    const clientId = metadata?.clientId;
    const metadataInvoiceId = metadata?.invoiceId;
    const metadataBalance = metadata?.balanceCents;
    const amountCents = session.amount_total;
    const currency = session.currency;
    if (
      typeof sessionId !== "string" ||
      !sessionId.startsWith("cs_") ||
      typeof invoiceId !== "string" ||
      typeof clientId !== "string" ||
      metadataInvoiceId !== invoiceId ||
      typeof metadataBalance !== "string" ||
      !/^\d+$/.test(metadataBalance) ||
      !Number.isSafeInteger(amountCents) ||
      (amountCents as number) <= 0 ||
      Number(metadataBalance) !== amountCents ||
      typeof currency !== "string" ||
      session.mode !== "payment" ||
      session.status !== "complete" ||
      typeof session.livemode !== "boolean" ||
      session.livemode !== event.livemode
    ) {
      throw ApiError.badRequest("Checkout session details are invalid.");
    }

    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : isRecord(session.payment_intent) && typeof session.payment_intent.id === "string"
          ? session.payment_intent.id
          : null;
    const paymentAmount = amountCents as number;
    const paymentCurrency = currency.toLowerCase();

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findFirst({
        where: { method: "STRIPE", transactionReference: sessionId },
        select: { id: true },
      });
      if (existing) return { duplicate: true, overpaymentCents: 0 };

      const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          payments: {
            where: { status: "PAID" },
            select: { status: true, amountCents: true },
          },
        },
      });
      if (!invoice || invoice.clientId !== clientId) {
        throw ApiError.notFound("Invoice association not found.");
      }
      if (
        invoice.currency.toLowerCase() !== paymentCurrency ||
        invoice.amountCents <= 0 ||
        paymentAmount > invoice.amountCents
      ) {
        throw ApiError.badRequest("Checkout session does not match the invoice.");
      }

      const paidBefore = paidCentsOf(invoice.payments);
      const remainingBefore = invoice.amountCents - paidBefore;
      const overpaymentCents = Math.max(0, paymentAmount - remainingBefore);
      const paidAfter = paidBefore + paymentAmount;
      const fullyPaid = paidAfter >= invoice.amountCents;
      const now = new Date();
      const nextUpdatedAt = new Date(
        Math.max(now.getTime(), invoice.updatedAt.getTime() + 1)
      );

      const claimed = await tx.invoice.updateMany({
        where: { id: invoice.id, updatedAt: invoice.updatedAt },
        data: {
          status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
          paidAt: fullyPaid ? now : null,
          updatedAt: nextUpdatedAt,
        },
      });
      if (claimed.count !== 1) {
        throw new Error("Invoice changed while recording Stripe payment; retry webhook.");
      }

      await tx.payment.create({
        data: {
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          requestId: invoice.requestId,
          amountCents: paymentAmount,
          currency: invoice.currency,
          status: "PAID",
          method: "STRIPE",
          transactionReference: sessionId,
          providerReference: paymentIntent,
          notes: "Paid through Stripe Checkout.",
          paidAt: now,
        },
      });
      await tx.invoiceActivity.create({
        data: {
          invoiceId: invoice.id,
          event: "STRIPE_PAYMENT_RECORDED",
          detail: `Stripe Checkout session ${sessionId} recorded for $${(paymentAmount / 100).toFixed(2)}.${
            overpaymentCents > 0
              ? ` Overpayment of $${(overpaymentCents / 100).toFixed(2)} requires review.`
              : ""
          }`,
        },
      });
      if (overpaymentCents > 0) {
        await tx.invoiceActivity.create({
          data: {
            invoiceId: invoice.id,
            event: "STRIPE_PAYMENT_OVERPAYMENT",
            detail: `Stripe payment exceeded the remaining balance by $${(overpaymentCents / 100).toFixed(2)}. Review and refund or apply the excess.`,
          },
        });
      }

      return { duplicate: false, overpaymentCents };
    });

    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}