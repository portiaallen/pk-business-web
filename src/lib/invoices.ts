import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

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
  if (dueAt && dueAt < new Date() && (status === "SENT" || status === "VIEWED")) {
    return "OVERDUE";
  }
  return status; // SENT / VIEWED / UNPAID
}

export function paidCentsOf(
  payments: Array<{ status: string; amountCents: number }>
): number {
  return payments
    .filter((p) => p.status === "PAID" || p.status === "PENDING")
    .reduce((sum, p) => sum + p.amountCents, 0);
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

export const PUBLIC_PAY_URL =
  process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/pay`
    : "https://www.pkservices.business/pay";

export function buildInvoiceEmailHtml(opts: {
  invoiceNumber: string;
  clientName: string;
  totalCents: number;
  dueAt: Date | null;
  paymentTerms: string | null;
  portalUrl: string;
  isResend: boolean;
}): string {
  const { invoiceNumber, clientName, totalCents, dueAt, paymentTerms, portalUrl, isResend } = opts;
  const amount = `$${(totalCents / 100).toFixed(2)}`;
  const due = dueAt ? dueAt.toLocaleDateString("en-US", { dateStyle: "long" }) : "upon receipt";
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#faf9f7;font-family:Georgia,serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <h1 style="font-size:20px;margin:0 0 4px;">PK Business Services</h1>
    <p style="font-size:13px;color:#6b7280;margin:0 0 24px;">Invoice ${invoiceNumber}</p>
    <p style="font-size:15px;">Hi ${clientName},</p>
    <p style="font-size:15px;">
      ${isResend ? "Resending for your reference — here is" : "Please find"} your invoice
      <strong>${invoiceNumber}</strong> for <strong>${amount}</strong>, due ${due}.
    </p>
    ${paymentTerms ? `<p style="font-size:14px;color:#4b5563;">Payment terms: ${paymentTerms}</p>` : ""}
    <p style="margin:28px 0;">
      <a href="${portalUrl}" style="display:inline-block;background:#1c1917;color:#faf9f7;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px;">
        View Invoice & Payment Options
      </a>
    </p>
    <p style="font-size:13px;color:#6b7280;">
      Payment options: card (Stripe), Zelle, or Cash App — available at
      <a href="${PUBLIC_PAY_URL}" style="color:#1c1917;">${PUBLIC_PAY_URL.replace("https://", "")}</a>
      or inside your client portal. No card-payment service fee is charged.
    </p>
    <p style="font-size:13px;color:#6b7280;margin-top:32px;">
      — PK Business Services
    </p>
  </div>
</body></html>`;
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
  const subject = `${opts.isResend ? "Reminder: " : ""}Invoice ${opts.invoiceNumber} from PK Business Services — $${(opts.totalCents / 100).toFixed(2)}`;
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
        invoiceNumber: opts.invoiceNumber,
        to: opts.toEmail,
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
      const errText = await res.text().catch(() => res.statusText);
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "FAILED" },
      });
      return { delivered: false, detail: `Email provider error (${res.status}): ${errText.slice(0, 200)}` };
    }
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { delivered: true, detail: `Email sent to ${opts.toEmail}` };
  } catch (err) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED" },
    });
    return {
      delivered: false,
      detail: `Email delivery failed: ${err instanceof Error ? err.message : String(err)}`,
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
