import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthContext, getSessionTokenFromRequest } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import {
  effectiveStatus,
  paidCentsOf,
  PUBLIC_PAY_URL,
  isStripeConfigured,
} from "@/lib/invoices";

/**
 * GET /api/portal/invoices — invoices for the authenticated client ONLY.
 * Tenant scoping: the clientId always comes from the session's membership,
 * never from request input. Internal notes are never exposed.
 */
export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const invoices = await prisma.invoice.findMany({
      where: { clientId: ctx.clientId },
      include: { payments: { select: { status: true, amountCents: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      invoices: invoices
        .filter((inv) => inv.status !== "DRAFT" && inv.status !== "VOID")
        .map((inv) => {
          const paid = paidCentsOf(inv.payments);
          return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            description: inv.description,
            lineItems: JSON.parse(inv.lineItems || "[]"),
            subtotalCents: inv.subtotalCents,
            adjustmentCents: inv.adjustmentCents,
            amountCents: inv.amountCents,
            paidCents: paid,
            balanceCents: inv.amountCents - paid,
            currency: inv.currency,
            status: effectiveStatus(inv.status, inv.amountCents, paid, inv.dueAt),
            paymentTerms: inv.paymentTerms,
            paymentInstructions: inv.paymentInstructions,
            dueAt: inv.dueAt?.toISOString() ?? null,
            sentAt: inv.sentAt?.toISOString() ?? null,
            createdAt: inv.createdAt.toISOString(),
          };
        }),
      paymentOptions: {
          stripeEnabled: isStripeConfigured(),
        zelleEmail: process.env.PAYMENT_ZELLE_EMAIL || "portiaallen40@gmail.com",
        cashAppTag: process.env.PAYMENT_CASHAPP_TAG || "$portiaallen40",
        publicPayUrl: PUBLIC_PAY_URL,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
