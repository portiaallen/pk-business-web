import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getSessionTokenFromRequest } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { effectiveStatus, paidCentsOf, PUBLIC_PAY_URL } from "@/lib/invoices";

/**
 * GET /api/portal/invoices — invoices for the authenticated client ONLY.
 * Tenant scoping: the clientId always comes from the session's membership,
 * never from request input. Internal notes are never exposed.
 */
export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user) throw ApiError.unauthorized();

    const membership = await prisma.clientMember.findFirst({
      where: { userId: user.id },
      select: { clientId: true },
    });
    if (!membership) throw ApiError.forbidden();

    const invoices = await prisma.invoice.findMany({
      where: { clientId: membership.clientId },
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
        stripeUrl:
          process.env.PAYMENT_STRIPE_URL ||
          "https://buy.stripe.com/5kQ3cu1Hw0252lpdNTdnW09",
        zelleEmail: process.env.PAYMENT_ZELLE_EMAIL || "portiaallen40@gmail.com",
        cashAppTag: process.env.PAYMENT_CASHAPP_TAG || "$portiaallen40",
        publicPayUrl: PUBLIC_PAY_URL,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
