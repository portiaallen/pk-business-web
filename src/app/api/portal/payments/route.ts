import { NextResponse } from "next/server";
import {
  requireAuthContext,
  getSessionTokenFromRequest,
} from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { isStripeConfigured } from "@/lib/invoices";

/**
 * Payment options shown to the authenticated client in the portal.
 * Read-only, non-sensitive: Zelle email + Cash App cashtag (business payment
 * details the client needs in order to pay), plus an optional Stripe link.
 */
export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    await requireAuthContext(token);

    return NextResponse.json({
      zelleEmail: process.env.PAYMENT_ZELLE_EMAIL || "portiaallen40@gmail.com",
      cashAppTag: process.env.PAYMENT_CASHAPP_TAG || "$portiaallen40",
      stripeEnabled: isStripeConfigured(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
