import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PRICE_CENTS, PRODUCT_CODE, publicOrigin, requireSandbox, sandboxStripe } from "@/lib/auntpenny/paid";
import { isHolidayPurchaseWindow } from "@/lib/pk-holiday-2026";
import { validateIntake, type IntakeAnswers } from "@/lib/auntpenny/roast-engine";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireSandbox();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const data = body as Record<string, unknown>;
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    const answers = data.answers as IntakeAnswers;
    if (!answers || validateIntake(answers).length) return NextResponse.json({ error: "Invalid figures" }, { status: 400 });
    const snapshot = JSON.stringify(answers);
    if (snapshot.length > 10000) return NextResponse.json({ error: "Input too large" }, { status: 413 });
    const stripe = sandboxStripe();
    const holidayActive = isHolidayPurchaseWindow(new Date());
    const holidayPromotion = process.env.PK_AUNT_PENNY_HOLIDAY_PROMOTION_ID?.trim();
    if (holidayActive && (!holidayPromotion || !/^promo_[A-Za-z0-9]+$/.test(holidayPromotion)))
      return NextResponse.json({code:"HOLIDAY_COUPON_NOT_CONFIGURED",message:"Holiday checkout is temporarily unavailable."},{status:503});
    const checkoutPriceCents = PRICE_CENTS;
    const order = await prisma.auntPennyOrder.create({ data: { email, intakeJson: snapshot, amountCents: checkoutPriceCents, status: "PENDING" } });
    try {
      const origin = publicOrigin();
      const session = await stripe.checkout.sessions.create({
        mode: "payment", customer_email: email,
        line_items: [{ price_data: { currency: "usd", unit_amount: checkoutPriceCents, product_data: { name: "Aunt Penny — Roast My Books personalized report", description: "Digital educational entertainment report" } }, quantity: 1 }],
        success_url: origin + "/auntpenny/roastmybooks/paid?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: origin + "/auntpenny/roastmybooks/start",
        client_reference_id: order.id,
        metadata: { orderId: order.id, productCode: PRODUCT_CODE, ...(holidayActive ? { pkHoliday2026: "v1" } : {}) },
        payment_method_types: ["card"],
        allow_promotion_codes: !holidayActive,
        ...(holidayActive ? { discounts: [{ promotion_code: holidayPromotion! }] } : {}),
      }, { idempotencyKey: "aunt-penny-order-" + order.id });
      await prisma.auntPennyOrder.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
      if (!session.url) throw new Error("Stripe checkout URL missing");
      return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      await prisma.auntPennyOrder.update({ where: { id: order.id }, data: { status: "FAILED" } });
      throw e;
    }
  } catch {
    return NextResponse.json({ code: "AUNT_PENNY_CHECKOUT_NOT_READY", message: "Secure checkout is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
