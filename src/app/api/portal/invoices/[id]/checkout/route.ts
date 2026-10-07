import { safeOrigin } from "@/lib/url-privacy";
import { isHostedRuntime } from "@/lib/security-environment";
import { logSecurityEvent } from "@/lib/security-log";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionTokenFromRequest, requireAuthContext } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { effectiveStatus, isStripeConfigured, paidCentsOf } from "@/lib/invoices";

type StripeCheckoutSession = {
  id?: unknown;
  url?: unknown;
  mode?: unknown;
  livemode?: unknown;
  amount_total?: unknown;
  currency?: unknown;
  client_reference_id?: unknown;
  metadata?: Record<string, unknown> | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getSessionTokenFromRequest(request);
    const context = await requireAuthContext(token);
    const { id } = await params;

    if (!isStripeConfigured()) {
      throw new ApiError(503, "Card payments are currently unavailable.");
    }

    const secretKey = process.env.STRIPE_SECRET_KEY!.trim();
    const keyMode = /^(?:sk|rk)_(test|live)_/.exec(secretKey)?.[1];
    if (!keyMode) throw new ApiError(503, "Card payments are currently unavailable.");

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: { select: { status: true, amountCents: true } }, readinessPurchase: { select: { id: true } } },
    });
    if (!invoice || invoice.clientId !== context.clientId) {
      throw ApiError.notFound("Invoice not found.");
    }
    if (invoice.readinessPurchase) throw ApiError.conflict("Use the Readiness purchase checkout");
    const paidCents = paidCentsOf(invoice.payments);
    const status = effectiveStatus(invoice.status, invoice.amountCents, paidCents, invoice.dueAt);
    if (!["SENT", "VIEWED", "OVERDUE", "PARTIALLY_PAID", "UNPAID"].includes(status)) {
      throw ApiError.badRequest("This invoice cannot be paid online.");
    }

    const balanceCents = invoice.amountCents - paidCents;
    if (!Number.isSafeInteger(balanceCents) || balanceCents <= 0) {
      throw ApiError.badRequest("This invoice has no outstanding balance.");
    }
    const currency = invoice.currency.toLowerCase();
    if (!/^[a-z]{3}$/.test(currency)) {
      throw ApiError.badRequest("This invoice currency cannot be paid online.");
    }

    const portalInvoiceUrl = `/portal/invoices?invoice=${encodeURIComponent(invoice.id)}`;
    let appUrl: string;
    try {
      appUrl = safeOrigin(process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin);
      if (isHostedRuntime() && appUrl !== process.env.PK_WEBAUTHN_ORIGIN?.trim()) throw new Error();
    } catch { throw new ApiError(503,"Payment return origin is not configured."); }
    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("payment_method_types[0]", "card");
    form.set("client_reference_id", invoice.id);
    form.set("line_items[0][price_data][currency]", currency);
    form.set("line_items[0][price_data][product_data][name]", `Invoice ${invoice.invoiceNumber}`);
    form.set("line_items[0][price_data][unit_amount]", String(balanceCents));
    form.set("line_items[0][quantity]", "1");
    form.set("metadata[invoiceId]", invoice.id);
    form.set("metadata[clientId]", invoice.clientId);
    form.set("metadata[balanceCents]", String(balanceCents));
    form.set("payment_intent_data[metadata][invoiceId]", invoice.id);
    form.set("payment_intent_data[metadata][clientId]", invoice.clientId);
    form.set("payment_intent_data[metadata][balanceCents]", String(balanceCents));
    form.set("success_url", `${appUrl}${portalInvoiceUrl}&checkout=success`);
    form.set("cancel_url", `${appUrl}${portalInvoiceUrl}&checkout=cancelled`);

    let stripeResponse: Response;
    try {
      stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      });
    } catch {
      logSecurityEvent("CHECKOUT_NETWORK_FAILURE");
      throw new ApiError(502, "Card checkout could not be started. Please try again.");
    }

    const session = (await stripeResponse.json().catch(() => null)) as StripeCheckoutSession | null;
    if (!stripeResponse.ok) {
      logSecurityEvent("CHECKOUT_PROVIDER_FAILURE");
      throw new ApiError(502, "Card checkout could not be started. Please try again.");
    }

    let checkoutUrl: URL;
    try {
      if (typeof session?.url !== "string") throw new Error("Missing checkout URL");
      checkoutUrl = new URL(session.url);
    } catch {
      throw new ApiError(502, "Stripe returned an invalid checkout session.");
    }

    if (
      typeof session?.id !== "string" ||
      !session.id.startsWith("cs_") ||
      session.mode !== "payment" ||
      session.livemode !== (keyMode === "live") ||
      session.amount_total !== balanceCents ||
      session.currency !== currency ||
      session.client_reference_id !== invoice.id ||
      session.metadata?.invoiceId !== invoice.id ||
      session.metadata?.clientId !== invoice.clientId ||
      session.metadata?.balanceCents !== String(balanceCents) ||
      checkoutUrl.protocol !== "https:" ||
      checkoutUrl.hostname !== "checkout.stripe.com" || checkoutUrl.username !== "" || checkoutUrl.password !== "" || checkoutUrl.port !== ""
    ) {
      throw new ApiError(502, "Stripe returned an invalid checkout session.");
    }

    return NextResponse.json({ url: checkoutUrl.toString() });
  } catch (error) {
    return handleApiError(error);
  }
}