import { safeOrigin } from "@/lib/url-privacy";
import { assertResourceEnvironment, securityEnvironment } from "@/lib/security-environment";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import {
  todayBusinessCalendarDate,
} from "@/lib/calendar-date";

// ─── Invoice domain helpers ───────────────────────────────────────────────────
// Built on the existing Invoice/Payment models (extended additively).
// Money is stored as integer cents everywhere.

export type InvoiceLineItem = {
  description: string;
  quantity: number; // hours or units
  rateCents: number;
  amountCents: number; // quantity * rateCents
};

export const INVOICE_PAYMENT_TERMS_PRESETS: Record<string, string> = {
  DEPOSIT_50:
    "A 50% deposit is required before work begins; the remaining balance is due upon completion.",
  DUE_ON_RECEIPT: "Payment is due upon receipt of this invoice.",
  NET_15: "Payment is due within 15 days of the invoice date.",
  NET_30: "Payment is due within 30 days of the invoice date.",
};

export function parseLineItems(raw: string): InvoiceLineItem[] {
  try {
    const items = JSON.parse(raw) as InvoiceLineItem[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

/** Validate + normalize submitted line items. Recomputes amounts server-side. */
export function normalizeLineItems(
  input: unknown
): { items: InvoiceLineItem[]; subtotalCents: number } {
  if (!Array.isArray(input) || input.length === 0) {
    throw ApiError.badRequest("At least one line item is required.");
  }
  const items: InvoiceLineItem[] = input.map((raw, i) => {
    const item = raw as Partial<InvoiceLineItem>;
    const description = String(item.description ?? "").trim();
    if (!description) {
      throw ApiError.badRequest(`Line item ${i + 1}: description is required.`);
    }
    const quantity = Number(item.quantity);
    const rateCents = Math.round(Number(item.rateCents));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw ApiError.badRequest(
        `Line item ${i + 1}: quantity/hours must be greater than zero.`
      );
    }
    if (!Number.isFinite(rateCents) || rateCents < 0) {
      throw ApiError.badRequest(
        `Line item ${i + 1}: rate must be zero or greater.`
      );
    }
    return {
      description,
      quantity,
      rateCents,
      amountCents: Math.round(quantity * rateCents * 100) / 100 === Math.round(quantity * rateCents)
        ? Math.round(quantity * rateCents)
        : Math.round(quantity * rateCents),
    };
  });
  const subtotalCents = items.reduce((sum, it) => sum + it.amountCents, 0);
  return { items, subtotalCents };
}

/** Derive display status: payment state + overdue check. */
export function effectiveStatus(
  status: string,
  amountCents: number,
  paidCents: number,
  dueAt: Date | null
): string {
  if (status === "VOID" || status === "CANCELLED" || status === "DRAFT") {
    return status;
  }
  if (paidCents >= amountCents && amountCents > 0) return "PAID";
  if (paidCents > 0) return "PARTIALLY_PAID";
  if (
    dueAt &&
    dueAt.toISOString().slice(0, 10) < todayBusinessCalendarDate() &&
    (status === "SENT" || status === "VIEWED")
  ) {
    return "OVERDUE";
  }
  return status; // SENT / VIEWED / UNPAID
}

export function paidCentsOf(
  payments: Array<{ status: string; amountCents: number }>
): number {
  return payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amountCents, 0);
}

export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key || !process.env.STRIPE_WEBHOOK_SECRET?.trim()) return false;
  try {
    assertResourceEnvironment("STRIPE");
    const environment = securityEnvironment();
    const mode = key.match(/^(?:sk|rk)_(test|live)_/)?.[1];
    return mode === (environment === "production" ? "live" : "test");
  } catch { return false; }
}

export async function logActivity(
  invoiceId: string,
  event: string,
  detail?: string,
  actorId?: string
) {
  await prisma.invoiceActivity.create({
    data: { invoiceId, event, detail: detail ?? null, actorId: actorId ?? null },
  });
}

/** Generate the next sequential invoice number: PK-YYYYMMDD-NNN */
export async function nextInvoiceNumber(): Promise<string> {
  const today = new Date();
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const prefix = `PK-${ymd}-`;
  const recent = await prisma.invoice.findMany({
    where: { invoiceNumber: { startsWith: prefix } },
    select: { invoiceNumber: true },
    orderBy: { invoiceNumber: "desc" },
    take: 1,
  });
  const lastSeq = recent[0]?.invoiceNumber
    ? parseInt(recent[0].invoiceNumber.slice(prefix.length), 10) || 0
    : 0;
  return `${prefix}${String(lastSeq + 1).padStart(3, "0")}`;
}

export const PUBLIC_PAY_URL = (() => {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) {
    try { return securityEnvironment() === "production" ? "https://www.pkservices.business/pay" : "/pay"; }
    catch { return "/pay"; }
  }
  try { return `${safeOrigin(configured)}/pay`; }
  catch { return "/pay"; } // Never return configuration credentials/query data to a browser.
})();

export function buildInvoiceEmailHtml(opts: {
  invoiceNumber: string;
  clientName: string;
  totalCents: number;
  dueAt: Date | null;
  paymentTerms: string | null;
  portalUrl: string;
  isResend: boolean;
}): string {
  // All invoice details remain in the authenticated portal, never ordinary email.
  void opts;
  return '<p>An invoice is available in your PK Business Services portal.</p><p>Sign in to view your invoice and payment options.</p>';
}

/**
 * Deliver the invoice notification. Records a Notification row (the app's
 * existing notification record) and attempts email delivery through the
 * configured provider. Returns the delivery result — callers must not mark
 * an invoice SENT unless this returns delivered=true.
 */
export async function deliverInvoiceNotification(opts: {
  userId: string;
  toEmail: string;
  invoiceNumber: string;
  clientName: string;
  totalCents: number;
  dueAt: Date | null;
  paymentTerms: string | null;
  portalUrl: string;
  isResend: boolean;
}): Promise<{ delivered: boolean; detail: string }> {
  const subject = "Invoice available — PK Business Services";
  const html = buildInvoiceEmailHtml(opts);

  const notification = await prisma.notification.create({
    data: {
      userId: opts.userId,
      channel: "EMAIL",
      status: "PENDING",
      subject,
      body: html,
      metadata: JSON.stringify({
        type: "INVOICE_SENT",
      }),
    },
  });

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    // No email provider configured: record the notification as queued and
    // report honestly. The invoice is still viewable in the client portal.
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "PENDING", body: html + "\n\n[QUEUED — email provider not configured]" },
    });
    return {
      delivered: false,
      detail:
        "Email delivery is not configured (missing RESEND_API_KEY). The invoice was recorded and is available in the client portal, but no email was sent. Set RESEND_API_KEY in Settings → Environment to enable email delivery.",
    };
  }

  try {
    assertResourceEnvironment("EMAIL");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          process.env.INVOICE_FROM_EMAIL?.trim() ||
          "PK Business Services <invoices@pkservices.business>",
        to: [opts.toEmail],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      // Provider response bodies can contain recipient/client content; never retain them.
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED" },
      });
      return { delivered: false, detail: "Email provider rejected delivery" };
    }
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { delivered: true, detail: "Email delivered" };
  } catch {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED" },
    });
    return {
      delivered: false,
      detail: "Email delivery failed",
    };
  }
}

/** Fetch an invoice with payments/activities, enforcing admin auth upstream. */
export async function getInvoiceOr404(id: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true } },
      payments: { orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!invoice) throw ApiError.notFound("Invoice not found.");
  return invoice;
}
