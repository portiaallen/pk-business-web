import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
} from "@/lib/auth";
import { handleApiError, ApiError } from "@/lib/api-error";
import { isStripeConfigured } from "@/lib/invoices";

/**
 * Payment options shown to the authenticated client in the portal.
 * Read-only, non-sensitive: Zelle email + Cash App cashtag (business payment
 * details the client needs in order to pay), plus an optional Stripe link.
 */
export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user) throw ApiError.unauthorized();

    // Verify the user is actually a member of a client (tenant isolation).
    const membership = await prisma.clientMember.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!membership) throw ApiError.forbidden();

    return NextResponse.json({
      zelleEmail: process.env.PAYMENT_ZELLE_EMAIL || "portiaallen40@gmail.com",
      cashAppTag: process.env.PAYMENT_CASHAPP_TAG || "$portiaallen40",
      stripeEnabled: isStripeConfigured(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
