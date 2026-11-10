import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { assertResourceEnvironment } from "@/lib/security-environment";
import { issueToken, tokenHash, publicOrigin, requireSandbox, sandboxStripe, PRICE_CENTS, PRODUCT_CODE } from "@/lib/auntpenny/paid";

export const runtime = "nodejs";
const generic = () => NextResponse.json({ message: "If a verified purchase matches, a private access link will be sent." }, { headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  try {
    requireSandbox();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const email = typeof (body as {email?:unknown}).email === "string" ? (body as {email:string}).email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    // Durable per-address limit, shared across server instances; never store plaintext email in the limiter key.
    const limitKey = "aunt-penny-recover:" + createHash("sha256").update(email).digest("hex");
    const now = new Date();
    const existing = await prisma.readinessPublicRateLimit.findUnique({ where: { key: limitKey } });
    if (existing && existing.expiresAt > now && existing.count >= 3) return generic();
    if (!existing || existing.expiresAt <= now) {
      await prisma.readinessPublicRateLimit.upsert({ where: { key: limitKey }, create: { key: limitKey, count: 1, expiresAt: new Date(Date.now() + 60 * 60 * 1000) }, update: { count: 1, expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
    } else {
      await prisma.readinessPublicRateLimit.update({ where: { key: limitKey }, data: { count: { increment: 1 } } });
    }
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
    if (!gmailUser || !gmailAppPassword) return NextResponse.json({ error: "Recovery unavailable" }, { status: 503 });
    const order = await prisma.auntPennyOrder.findFirst({ where: { email, status: "PAID" }, orderBy: { paidAt: "desc" } });
    if (!order?.stripeSessionId) return generic();
    const session = await sandboxStripe().checkout.sessions.retrieve(order.stripeSessionId);
    if (session.payment_status !== "paid" || session.amount_total !== PRICE_CENTS || session.currency !== "usd" || session.mode !== "payment" || session.metadata?.productCode !== PRODUCT_CODE || session.metadata?.orderId !== order.id || session.customer_details?.email?.trim().toLowerCase() !== email) return generic();
    const token = issueToken();
    const link = publicOrigin() + "/auntpenny/roastmybooks/paid?access_token=" + encodeURIComponent(token);
    assertResourceEnvironment("EMAIL");
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: gmailUser, pass: gmailAppPassword } });
    await prisma.auntPennyOrder.update({ where: { id: order.id }, data: { accessTokenHash: tokenHash(token), accessExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    await transporter.sendMail({ from: `PK Business Services <${gmailUser}>`, to: email, subject: "Your private Aunt Penny report link", text: "Your private report link (do not forward): " + link + "\nThis link expires in 24 hours." });
    return generic();
  } catch {
    return NextResponse.json({ error: "Recovery temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
