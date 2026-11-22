import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { proxy } from "../src/proxy";
import { POST as webhook } from "../src/app/api/auntpenny/webhook/route";
import { POST as recover } from "../src/app/api/auntpenny/recover/route";
import * as PaidReportPageModule from "../src/app/auntpenny/roastmybooks/paid/page";
import { PRICE_CENTS, PRODUCT_CODE } from "../src/lib/auntpenny/paid";

const pageExport = (PaidReportPageModule as { default?: unknown }).default ?? PaidReportPageModule;
const paidPage = (typeof pageExport === "function" ? pageExport : (pageExport as { default?: unknown }).default) as
  (props: { searchParams: Promise<{ session_id?: string; access_token?: string }> }) => Promise<unknown>;

const email = "synthetic-auntpenny@example.test";
const sessionId = "cs_test_auntpenny_acceptance";
const secret = "whsec_synthetic_acceptance";
const origin = "https://example.test";
const originalFetch = globalThis.fetch;

function renderedText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(renderedText).join(" ");
  if (!node || typeof node !== "object") return "";
  return renderedText((node as { props?: { children?: unknown } }).props?.children);
}

test("signed Stripe completion and Resend recovery for a fully discounted order", async () => {
  process.env.AUNT_PENNY_PAID_SANDBOX_ENABLED = "true";
  process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY = "sk_test_synthetic_no_network";
  process.env.AUNT_PENNY_STRIPE_TEST_WEBHOOK_SECRET = secret;
  process.env.AUNT_PENNY_TEST_ORIGIN = origin;
  process.env.PK_EMAIL_ENVIRONMENT = "test";
  process.env.RESEND_API_KEY = "synthetic-resend";
  process.env.INVOICE_FROM_EMAIL = "synthetic-sender@example.test";

  const webhookUrl = origin + "/api/auntpenny/webhook";
  const recoveryUrl = origin + "/api/auntpenny/recover";
  const recoverReport = () => recover(new Request(recoveryUrl, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }),
  }));
  const order = await prisma.auntPennyOrder.create({ data: {
    email, stripeSessionId: sessionId, amountCents: PRICE_CENTS,
    intakeJson: JSON.stringify({
      recordsMethod: "spreadsheet", monthlyRevenue: 12000, monthlyExpenses: 10800,
      cashOnHand: 2700, monthsSinceReconciliation: 5, uncategorizedPercent: 35,
      uncategorizedTransactions: 70, overdueInvoicesTotal: 4200, softwareSubscriptions: 12,
      headcount: 2, ownerDraws3mo: 5400, netIncome3mo: 3600, cardBalanceCarried: 6800,
      monthsCarryingCard: 8, monthsWithoutProfessional: 15,
    }),
  } });
  const readOrder = () => prisma.auntPennyOrder.findUniqueOrThrow({ where: { id: order.id } });
  const session = {
    id: sessionId, mode: "payment", currency: "usd", amount_total: 0,
    total_details: { amount_discount: PRICE_CENTS }, status: "complete",
    payment_status: "paid", client_reference_id: order.id, customer_details: { email },
    metadata: { orderId: order.id, productCode: PRODUCT_CODE },
  };
  const mailLinks: URL[] = [];
  let failDelivery = false;
  globalThis.fetch = (async (url, options) => {
    if (String(url) === "https://api.resend.com/emails") {
      if (failDelivery) return new Response(null, { status: 503 });
      const message = JSON.parse(String(options?.body));
      assert.deepEqual(message.to, [email]);
      const link = message.text.match(/https:\/\/[^\s]+/)?.[0];
      assert.ok(link);
      mailLinks.push(new URL(link));
      return new Response(null, { status: 200 });
    }
    assert.equal(String(url), "https://api.stripe.com/v1/checkout/sessions/" + sessionId);
    return Response.json(session);
  }) as typeof fetch;

  function signedCheckout(validSignature = true) {
    const body = JSON.stringify({ type: "checkout.session.completed", data: { object: session } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = validSignature
      ? createHmac("sha256", secret).update(timestamp + "." + body).digest("hex")
      : "0".repeat(64);
    return new NextRequest(webhookUrl, {
      method: "POST", headers: { "stripe-signature": "t=" + timestamp + ",v1=" + signature }, body,
    });
  }

  try {
    const verifiedRequest = signedCheckout();
    assert.equal(proxy(verifiedRequest).status, 200);
    assert.equal(proxy(new NextRequest(recoveryUrl, { method: "POST" })).status, 403);
    assert.equal((await webhook(signedCheckout(false))).status, 400);
    session.payment_status = "unpaid";
    assert.equal((await webhook(signedCheckout())).status, 400);
    const denied = await paidPage({ searchParams: Promise.resolve({ session_id: sessionId }) });
    assert.match(renderedText(denied), /checking the receipt/);
    assert.equal((await readOrder()).status, "PENDING");

    session.payment_status = "paid";
    failDelivery = true;
    assert.equal((await webhook(verifiedRequest)).status, 503);
    const recorded = await readOrder();
    assert.equal(recorded.status, "PAID");
    assert.ok(recorded.paidAt);
    assert.equal(recorded.accessTokenHash, null);

    failDelivery = false;
    assert.equal((await webhook(signedCheckout())).status, 200);
    assert.equal((await webhook(signedCheckout())).status, 200);
    assert.equal((await readOrder()).paidAt?.getTime(), recorded.paidAt.getTime());
    assert.equal(mailLinks.length, 1);
    const direct = await paidPage({ searchParams: Promise.resolve({ session_id: sessionId }) });
    assert.match(renderedText(direct), /THE PRIVATE BOOKS EDITION/);

    assert.equal((await recoverReport()).status, 200);
    assert.equal(mailLinks.length, 2);
    const accessToken = mailLinks[1].searchParams.get("access_token");
    assert.ok(accessToken);
    const recovered = await paidPage({ searchParams: Promise.resolve({ access_token: accessToken }) });
    assert.match(renderedText(recovered), /THE PRIVATE BOOKS EDITION/);
    const authorized = await readOrder();
    failDelivery = true;
    assert.equal((await recoverReport()).status, 503);
    assert.equal((await readOrder()).accessTokenHash, authorized.accessTokenHash);

    await prisma.auntPennyOrder.update({ where: { id: order.id }, data: {
      status: "PENDING", paidAt: null, accessTokenHash: null, accessExpiresAt: null,
    } });
    failDelivery = false;
    session.payment_status = "no_payment_required";
    const browserReturn = await paidPage({ searchParams: Promise.resolve({ session_id: sessionId }) });
    assert.match(renderedText(browserReturn), /THE PRIVATE BOOKS EDITION/);
    assert.equal((await readOrder()).status, "PAID");
    assert.equal(mailLinks.length, 3);
    assert.equal((await webhook(signedCheckout())).status, 200);
    assert.equal(mailLinks.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    await prisma.auntPennyOrder.delete({ where: { id: order.id } });
    await prisma.$disconnect();
  }
});
