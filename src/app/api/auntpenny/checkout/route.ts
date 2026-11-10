import { NextResponse } from "next/server";

/**
 * Aunt Penny paid fulfillment is deliberately unavailable until the Founder
 * approves launch AND a separate, verified server-side checkout/webhook flow
 * authenticates payment and delivery. Never accept client-supplied "paid" flags.
 *
 * This route is a fail-closed placeholder, not a checkout integration.
 */
export async function POST() {
  return NextResponse.json(
    {
      code: "AUNT_PENNY_CHECKOUT_NOT_READY",
      message: "Aunt Penny's paid report is not available for purchase yet.",
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
