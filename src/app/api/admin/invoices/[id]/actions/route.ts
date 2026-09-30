import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import {
  getInvoiceOr404,
  effectiveStatus,
  paidCentsOf,
  logActivity,
  deliverInvoiceNotification,
} from "@/lib/invoices";

async function requireAdmin(request: Request) {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);
  if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();
  return user;
}

/**
 * POST /api/admin/invoices/[id]/actions
 * Actions: send | resend | record-payment | void | mark-viewed
 * All validation happens server-side; failures return the actual reason and
 * never falsely update the invoice status.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const action = String(body.action ?? "");

    // ─── SEND / RESEND ────────────────────────────────────────────────────
    if (action === "send" || action === "resend") {
      const invoice = await getInvoiceOr404(id);
      const isResend = action === "resend";

      if (isResend && invoice.status === "DRAFT") {
        throw ApiError.badRequest("This invoice has not been sent yet. Use Send instead.");
      }
      if (!isResend && invoice.status !== "DRAFT") {
        throw ApiError.badRequest(
          `Invoice is already ${invoice.status.toLowerCase()}. Use Resend to notify the client again.`
        );
      }
      if (invoice.status === "VOID" || invoice.status === "CANCELLED") {
        throw ApiError.badRequest("A voided invoice cannot be sent.");
      }
      if (paidCentsOf(invoice.payments) >= invoice.amountCents) {
        throw ApiError.badRequest("This invoice is already fully paid.");
      }

      // Validate content before sending.
      const lineItems = JSON.parse(invoice.lineItems || "[]");
      if (!Array.isArray(lineItems) || lineItems.length === 0) {
        throw ApiError.badRequest("Cannot send: the invoice has no line items.");
      }
      if (invoice.amountCents <= 0) {
        throw ApiError.badRequest("Cannot send: the invoice total must be greater than zero.");
      }

      // Resolve the client's primary contact.
      const ownerMember = await prisma.clientMember.findFirst({
        where: { clientId: invoice.clientId },
        include: { user: { select: { id: true, email: true, name: true, status: true } } },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      });
      const recipient = ownerMember?.user;
      if (!recipient || recipient.status !== "ACTIVE" || !recipient.email) {
        throw ApiError.badRequest(
          "Cannot send: this client has no active portal contact with an email address. Add a team member to the client account first."
        );
      }

      const portalUrl = `${(process.env.NEXT_PUBLIC_APP_URL || "https://www.pkservices.business").replace(/\/$/, "")}/portal/invoices?invoice=${encodeURIComponent(invoice.id)}`;

      const result = await deliverInvoiceNotification({
        userId: recipient.id,
        toEmail: recipient.email,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.client.name,
        totalCents: invoice.amountCents,
        dueAt: invoice.dueAt,
        paymentTerms: invoice.paymentTerms,
        portalUrl,
        isResend,
      });

      await logActivity(invoice.id, isResend ? "RESENT" : "SEND_ATTEMPTED", result.detail, admin.id);

      if (!result.delivered) {
        // Do NOT update status — report the actual failure reason.
        return NextResponse.json(
          { error: `Send failed: ${result.detail}`, delivered: false },
          { status: 502 }
        );
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      await logActivity(
        invoice.id,
        isResend ? "RESENT" : "SENT",
        `Invoice ${isResend ? "resent" : "sent"} to ${recipient.email}`,
        admin.id
      );
      return NextResponse.json({
        delivered: true,
        message: `Invoice #${invoice.invoiceNumber} ${isResend ? "resent" : "sent"} successfully to ${recipient.email}.`,
      });
    }

    // ─── RECORD PAYMENT ───────────────────────────────────────────────────
    if (action === "record-payment") {
      const invoice = await getInvoiceOr404(id);
      if (invoice.status === "DRAFT") {
        throw ApiError.badRequest("Send the invoice before recording a payment.");
      }
      if (invoice.status === "VOID" || invoice.status === "CANCELLED") {
        throw ApiError.badRequest("Cannot record a payment against a voided invoice.");
      }

      const amountCents = Math.round(Number(body.amountCents));
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        throw ApiError.badRequest("Payment amount must be greater than zero.");
      }
      const paidSoFar = paidCentsOf(invoice.payments);
      if (paidSoFar + amountCents > invoice.amountCents) {
        throw ApiError.badRequest(
          `Payment exceeds the remaining balance of $${((invoice.amountCents - paidSoFar) / 100).toFixed(2)}.`
        );
      }
      const method = String(body.method ?? "MANUAL");
      if (!["STRIPE", "CASH_APP", "ZELLE", "MANUAL"].includes(method)) {
        throw ApiError.badRequest("Invalid payment method.");
      }

      const payment = await prisma.payment.create({
        data: {
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          requestId: invoice.requestId,
          amountCents,
          status: "PAID",
          method: method as never,
          transactionReference: body.reference ? String(body.reference) : null,
          notes: body.notes ? String(body.notes) : null,
          paidAt: body.paidAt ? new Date(String(body.paidAt)) : new Date(),
        },
      });

      const newPaid = paidSoFar + amountCents;
      const fullyPaid = newPaid >= invoice.amountCents;
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: fullyPaid ? "PAID" : "PARTIALLY_PAID", paidAt: fullyPaid ? new Date() : null },
      });
      await logActivity(
        invoice.id,
        "PAYMENT_RECORDED",
        `$${(amountCents / 100).toFixed(2)} via ${method}${body.reference ? ` (ref: ${body.reference})` : ""} by ${admin.name}${fullyPaid ? " — invoice fully paid" : ""}`,
        admin.id
      );

      return NextResponse.json({
        ok: true,
        paymentId: payment.id,
        paidCents: newPaid,
        balanceCents: invoice.amountCents - newPaid,
        status: fullyPaid ? "PAID" : "PARTIALLY_PAID",
        message: fullyPaid
          ? `Payment recorded — invoice #${invoice.invoiceNumber} is now fully paid.`
          : `Payment of $${(amountCents / 100).toFixed(2)} recorded. Remaining balance: $${((invoice.amountCents - newPaid) / 100).toFixed(2)}.`,
      });
    }

    // ─── VOID ─────────────────────────────────────────────────────────────
    if (action === "void") {
      const invoice = await getInvoiceOr404(id);
      if (invoice.status === "VOID") throw ApiError.badRequest("Invoice is already void.");
      const paid = paidCentsOf(invoice.payments);
      if (paid > 0) {
        throw ApiError.badRequest(
          "This invoice has payments recorded. Refund/adjust payments before voiding, or leave the invoice in place for the record."
        );
      }
      await prisma.invoice.update({ where: { id }, data: { status: "VOID" } });
      await logActivity(id, "VOIDED", `Invoice voided by ${admin.name}`, admin.id);
      return NextResponse.json({ ok: true, message: `Invoice #${invoice.invoiceNumber} voided.` });
    }

    // ─── MARK VIEWED (manual) ─────────────────────────────────────────────
    if (action === "mark-viewed") {
      const invoice = await getInvoiceOr404(id);
      if (invoice.status === "SENT") {
        await prisma.invoice.update({ where: { id }, data: { status: "VIEWED", viewedAt: new Date() } });
        await logActivity(id, "VIEWED", "Marked as viewed", admin.id);
      }
      return NextResponse.json({ ok: true });
    }

    throw ApiError.badRequest(`Unknown action: ${action || "(none)"}`);
  } catch (error) {
    return handleApiError(error);
  }
}
