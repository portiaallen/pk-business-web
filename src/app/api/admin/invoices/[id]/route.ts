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
  normalizeLineItems,
  effectiveStatus,
  paidCentsOf,
  logActivity,
  INVOICE_PAYMENT_TERMS_PRESETS,
} from "@/lib/invoices";

async function requireAdmin(request: Request) {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);
  if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();
  return user;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    const invoice = await getInvoiceOr404(id);
    const paid = paidCentsOf(invoice.payments);
    return NextResponse.json({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId,
        clientName: invoice.client.name,
        requestId: invoice.requestId,
        description: invoice.description,
        lineItems: JSON.parse(invoice.lineItems || "[]"),
        subtotalCents: invoice.subtotalCents,
        adjustmentCents: invoice.adjustmentCents,
        amountCents: invoice.amountCents,
        paidCents: paid,
        balanceCents: invoice.amountCents - paid,
        currency: invoice.currency,
        status: effectiveStatus(invoice.status, invoice.amountCents, paid, invoice.dueAt),
        storedStatus: invoice.status,
        paymentTerms: invoice.paymentTerms,
        notes: invoice.notes,
        paymentInstructions: invoice.paymentInstructions,
        dueAt: invoice.dueAt?.toISOString() ?? null,
        issueAt: invoice.issueAt?.toISOString() ?? null,
        sentAt: invoice.sentAt?.toISOString() ?? null,
        viewedAt: invoice.viewedAt?.toISOString() ?? null,
        createdAt: invoice.createdAt.toISOString(),
        payments: invoice.payments.map((p) => ({
          id: p.id,
          amountCents: p.amountCents,
          status: p.status,
          method: p.method,
          transactionReference: p.transactionReference,
          notes: p.notes,
          paidAt: p.paidAt?.toISOString() ?? null,
          createdAt: p.createdAt.toISOString(),
        })),
        activities: invoice.activities.map((a) => ({
          id: a.id,
          event: a.event,
          detail: a.detail,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH — edit an invoice. Only DRAFT invoices can be structurally edited. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const invoice = await getInvoiceOr404(id);
    const body = await request.json();

    if (invoice.status !== "DRAFT") {
      throw ApiError.badRequest(
        "Only draft invoices can be edited. Void this invoice and create a corrected one instead."
      );
    }

    const data: Record<string, unknown> = {};

    if (body.lineItems !== undefined) {
      const { items, subtotalCents } = normalizeLineItems(body.lineItems);
      const adjustmentCents =
        body.adjustmentCents !== undefined
          ? Math.round(Number(body.adjustmentCents))
          : invoice.adjustmentCents;
      const amountCents = subtotalCents + adjustmentCents;
      if (amountCents <= 0) throw ApiError.badRequest("Invoice total must be greater than zero.");
      data.lineItems = JSON.stringify(items);
      data.subtotalCents = subtotalCents;
      data.adjustmentCents = adjustmentCents;
      data.amountCents = amountCents;
    } else if (body.adjustmentCents !== undefined) {
      const adjustmentCents = Math.round(Number(body.adjustmentCents));
      data.subtotalCents = invoice.subtotalCents;
      data.adjustmentCents = adjustmentCents;
      data.amountCents = invoice.subtotalCents + adjustmentCents;
    }

    if (body.description !== undefined) data.description = body.description ? String(body.description) : null;
    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes) : null;
    if (body.paymentInstructions !== undefined)
      data.paymentInstructions = body.paymentInstructions ? String(body.paymentInstructions) : null;
    if (body.dueAt !== undefined) {
      const dueAt = body.dueAt ? new Date(String(body.dueAt)) : null;
      if (dueAt && Number.isNaN(dueAt.getTime())) throw ApiError.badRequest("Invalid due date.");
      data.dueAt = dueAt;
    }
    if (body.requestId !== undefined) data.requestId = body.requestId ? String(body.requestId) : null;
    if (body.paymentTerms !== undefined) {
      const key = body.paymentTerms ? String(body.paymentTerms) : null;
      data.paymentTerms =
        key && INVOICE_PAYMENT_TERMS_PRESETS[key] ? INVOICE_PAYMENT_TERMS_PRESETS[key] : key;
    }

    const updated = await prisma.invoice.update({ where: { id }, data });
    await logActivity(id, "EDITED", `Draft edited by ${admin.name}`, admin.id);

    return NextResponse.json({ invoice: { id: updated.id, invoiceNumber: updated.invoiceNumber } });
  } catch (error) {
    return handleApiError(error);
  }
}
