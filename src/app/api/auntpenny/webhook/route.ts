import { NextResponse } from "next/server";
import { emailAuntPennyReport, matchesCompletedCheckout, recordAuntPennyPayment } from "@/lib/auntpenny/fulfillment";
import { PRODUCT_CODE, requireSandbox, sandboxStripe } from "@/lib/auntpenny/paid";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature required" }, { status: 400 });

  try {
    requireSandbox();
    const secret = process.env.AUNT_PENNY_LIVE_ENABLED === "true"
      ? process.env.AUNT_PENNY_LIVE_WEBHOOK_SECRET
      : process.env.AUNT_PENNY_STRIPE_TEST_WEBHOOK_SECRET;
    if (!secret?.startsWith("whsec_")) throw new Error("Aunt Penny webhook secret missing");

    const stripe = sandboxStripe();
    const payload = await request.text();
    let event: ReturnType<typeof stripe.webhooks.constructEvent>;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
    }

    const session = event.data.object;
    if ((event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") ||
        session.metadata?.productCode !== PRODUCT_CODE) {
      return NextResponse.json({ received: true });
    }

    const orderId = session.metadata.orderId;
    if (!orderId) return NextResponse.json({ error: "Missing order" }, { status: 400 });
    const order = await prisma.auntPennyOrder.findUnique({ where: { id: orderId } });
    if (!order || !matchesCompletedCheckout(session, order)) {
      return NextResponse.json({ error: "Payment or order mismatch" }, { status: 400 });
    }
    if (!await recordAuntPennyPayment(order)) {
      return NextResponse.json({ error: "Order not payable" }, { status: 409 });
    }

    await emailAuntPennyReport(order, "initial");
    return NextResponse.json({ received: true });
  } catch {
    console.error("Aunt Penny webhook fulfillment failed");
    return NextResponse.json({ error: "Fulfillment temporarily unavailable" }, { status: 503 });
  }
}
