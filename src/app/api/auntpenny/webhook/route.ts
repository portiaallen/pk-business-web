import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PRICE_CENTS, PRODUCT_CODE, requireSandbox, sandboxStripe } from "@/lib/auntpenny/paid";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    requireSandbox();
    const secret = process.env.AUNT_PENNY_STRIPE_TEST_WEBHOOK_SECRET;
    if (!secret?.startsWith("whsec_")) throw new Error("Sandbox webhook secret missing");
    const signature = request.headers.get("stripe-signature");
    if (!signature) return NextResponse.json({ error: "Signature required" }, { status: 400 });
    const stripe = sandboxStripe();
    const event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return NextResponse.json({ received: true });
    const session = event.data.object;
    if (session.payment_status !== "paid" || session.mode !== "payment" || session.currency !== "usd" || session.amount_total !== PRICE_CENTS || session.metadata?.productCode !== PRODUCT_CODE) return NextResponse.json({ error: "Payment mismatch" }, { status: 400 });
    const orderId = session.metadata?.orderId;
    if (!orderId) return NextResponse.json({ error: "Missing order" }, { status: 400 });
    const order = await prisma.auntPennyOrder.findUnique({ where: { id: orderId } });
    if (!order || order.stripeSessionId !== session.id || order.amountCents !== PRICE_CENTS) return NextResponse.json({ error: "Order mismatch" }, { status: 400 });
    if (order.status === "PAID") return NextResponse.json({ received: true });

    // Atomic, idempotent state transition; access is verified against Stripe on report request.
    await prisma.auntPennyOrder.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "PAID", paidAt: new Date() } });
    // The raw access token is deliberately NOT logged, stored, or emailed by this webhook.
    // Fulfillment email / buyer recovery requires a separate verified secure implementation.
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook verification or processing failed" }, { status: 400 });
  }
}
