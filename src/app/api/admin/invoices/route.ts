import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import {
  normalizeLineItems,
  nextInvoiceNumber,
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

function serialize(invoice: {
  id: string;
  invoiceNumber: string;
  clientId: string;
  requestId: string | null;
  serviceId: string | null;
  description: string | null;
  lineItems: string;
  subtotalCents: number;
  adjustmentCents: number;
  amountCents: number;
  currency: string;
  status: string;
  paymentTerms: string | null;
  notes: string | null;
  paymentInstructions: string | null;
  dueAt: Date | null;
  issueAt: Date | null;
  sentAt: Date | null;
  viewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string };
  request?: { id: string; requestType: string } | null;
  payments?: Array<{ status: string; amountCents: number }>;
}) {
  const paid = paidCentsOf(invoice.payments ?? []);
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientId: invoice.clientId,
    clientName: invoice.client.name,
    requestId: invoice.requestId,
    requestTitle: invoice.request?.requestType ?? null,
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
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get("status");

    const invoices = await prisma.invoice.findMany({
      where: statusFilter ? { status: statusFilter as never } : undefined,
      include: {
        client: { select: { id: true, name: true } },
        request: { select: { id: true, requestType: true } },
        payments: { select: { status: true, amountCents: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = invoices.map((inv) => {
      const s = serialize(inv);
      return s;
    });

    // Summary across ALL invoices (not filtered)
    const all = await prisma.invoice.findMany({
      include: { payments: { select: { status: true, amountCents: true } } },
    });
    let totalOutstandingCents = 0;
    const counts: Record<string, number> = {
      DRAFT: 0, SENT: 0, VIEWED: 0, PARTIALLY_PAID: 0, PAID: 0, OVERDUE: 0, VOID: 0,
    };
    for (const inv of all) {
      const paid = paidCentsOf(inv.payments);
      const st = effectiveStatus(inv.status, inv.amountCents, paid, inv.dueAt);
      counts[st] = (counts[st] ?? 0) + 1;
      if (st !== "PAID" && st !== "VOID" && st !== "DRAFT" && st !== "CANCELLED") {
        totalOutstandingCents += inv.amountCents - paid;
      }
    }

    return NextResponse.json({
      invoices: rows,
      summary: { counts, totalOutstandingCents },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body = await request.json();

    const clientId = String(body.clientId ?? "").trim();
    if (!clientId) throw ApiError.badRequest("Client is required.");
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw ApiError.badRequest("Selected client does not exist.");

    const { items, subtotalCents } = normalizeLineItems(body.lineItems);
    const adjustmentCents = Math.round(Number(body.adjustmentCents ?? 0));
    if (!Number.isFinite(adjustmentCents)) throw ApiError.badRequest("Invalid adjustment amount.");
    const amountCents = subtotalCents + adjustmentCents;
    if (amountCents <= 0) throw ApiError.badRequest("Invoice total must be greater than zero.");

    const dueAt = body.dueAt ? new Date(String(body.dueAt)) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) throw ApiError.badRequest("Invalid due date.");

    const paymentTermsKey = body.paymentTerms ? String(body.paymentTerms) : null;
    const paymentTerms =
      paymentTermsKey && INVOICE_PAYMENT_TERMS_PRESETS[paymentTermsKey]
        ? INVOICE_PAYMENT_TERMS_PRESETS[paymentTermsKey]
        : body.paymentTerms
          ? String(body.paymentTerms)
          : null;

    const invoiceNumber = await nextInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId,
        requestId: body.requestId ? String(body.requestId) : null,
        serviceId: body.serviceId ? String(body.serviceId) : null,
        description: body.description ? String(body.description) : null,
        lineItems: JSON.stringify(items),
        subtotalCents,
        adjustmentCents,
        amountCents,
        status: "DRAFT",
        paymentTerms,
        notes: body.notes ? String(body.notes) : null,
        paymentInstructions: body.paymentInstructions
          ? String(body.paymentInstructions)
          : null,
        dueAt,
        issueAt: new Date(),
      },
    });
    await logActivity(invoice.id, "CREATED", `Draft created by ${admin.name}`, admin.id);

    return NextResponse.json({ invoice: { id: invoice.id, invoiceNumber } }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
