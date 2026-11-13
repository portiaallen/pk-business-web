import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mock } from "node:test";
import nodemailer from "nodemailer";
import { prisma } from "../src/lib/prisma";
import { POST as webhook } from "../src/app/api/auntpenny/webhook/route";
import { POST as recover } from "../src/app/api/auntpenny/recover/route";
import PaidReportPage from "../src/app/auntpenny/roastmybooks/paid/page";
import { PRICE_CENTS, PRODUCT_CODE } from "../src/lib/auntpenny/paid";

const email = "synthetic-auntpenny@example.test";
const sessionId = "cs_test_auntpenny_acceptance";
const secret = "whsec_synthetic_acceptance";
process.env.AUNT_PENNY_PAID_SANDBOX_ENABLED = "true";
process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY = "sk_test_synthetic_no_network";
process.env.AUNT_PENNY_STRIPE_TEST_WEBHOOK_SECRET = secret;
process.env.AUNT_PENNY_TEST_ORIGIN = "https://example.test";
const originalFetch = globalThis.fetch;
let currentOrderId = "";
let syntheticPaid = true;
globalThis.fetch = (async (url: string | URL | Request) => {
  assert.match(String(url), /^https:\/\/api\.stripe\.com\/v1\/checkout\/sessions\//);
  return new Response(JSON.stringify({
    id: sessionId, mode: "payment", currency: "usd", amount_total: PRICE_CENTS,
    payment_status: syntheticPaid ? "paid" : "unpaid", client_reference_id: currentOrderId,
    customer_details: { email }, metadata: { orderId: currentOrderId, productCode: PRODUCT_CODE }
  }), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

function signed(body: string, signatureOverride?: string) {
  const t = String(Math.floor(Date.now() / 1000));
  const signature = signatureOverride ?? createHmac("sha256", secret).update(t + "." + body).digest("hex");
  return new Request("https://example.test/api/auntpenny/webhook", { method: "POST", headers: { "stripe-signature": "t=" + t + ",v1=" + signature }, body });
}
function payload() {
  return JSON.stringify({ type: "checkout.session.completed", data: { object: {
    id: sessionId, mode: "payment", currency: "usd", amount_total: PRICE_CENTS,
    payment_status: syntheticPaid ? "paid" : "unpaid", client_reference_id: currentOrderId,
    customer_details: { email }, metadata: { orderId: currentOrderId, productCode: PRODUCT_CODE }
  } } });
}
test("real isolated database: signed webhook, replay, authorization, recovery failure", async () => {
  const order = await prisma.auntPennyOrder.create({ data: {
    email, intakeJson: JSON.stringify({"recordsMethod":"software","softwareName":"QuickBooks","monthlyRevenue":10000,"monthlyExpenses":8000,"cashOnHand":5000,"monthsSinceReconciliation":2,"uncategorizedPercent":10,"uncategorizedTransactions":12,"overdueInvoicesTotal":1000,"softwareSubscriptions":4,"headcount":2,"ownerDraws3mo":3000,"netIncome3mo":6000,"cardBalanceCarried":500,"monthsCarryingCard":2,"monthsWithoutProfessional":3,"firstName":"Synthetic"}), amountCents: PRICE_CENTS, status: "PENDING", stripeSessionId: sessionId
  } });
  currentOrderId = order.id;
  try {
    const deniedBefore = await PaidReportPage({ searchParams: Promise.resolve({ session_id: sessionId }) });
    assert.match(JSON.stringify(deniedBefore), /checking the receipt/);
    assert.equal((await webhook(signed(payload(), "0".repeat(64)))).status, 400);
    assert.equal((await prisma.auntPennyOrder.findUniqueOrThrow({ where: { id: order.id } })).status, "PENDING");
    syntheticPaid = false;
    assert.equal((await webhook(signed(payload()))).status, 400);
    syntheticPaid = true;
    assert.equal((await webhook(signed(payload()))).status, 200);
    const first = await prisma.auntPennyOrder.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(first.status, "PAID");
    assert.ok(first.paidAt);
    assert.equal((await webhook(signed(payload()))).status, 200);
    const second = await prisma.auntPennyOrder.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(second.paidAt?.getTime(), first.paidAt?.getTime());
    const allowed = await PaidReportPage({ searchParams: Promise.resolve({ session_id: sessionId }) });
    assert.match(JSON.stringify(allowed), /Your Roast My Books Report/);
    syntheticPaid = false;
    const revoked = await PaidReportPage({ searchParams: Promise.resolve({ session_id: sessionId }) });
    assert.match(JSON.stringify(revoked), /checking the receipt/);
    syntheticPaid = true;
    delete process.env.GMAIL_APP_PASSWORD;
    const recovery = await recover(new Request("https://example.test/api/auntpenny/recover", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email })
    }));
    assert.equal(recovery.status, 503);
    assert.equal((await prisma.auntPennyOrder.findUniqueOrThrow({ where: { id: order.id } })).accessTokenHash, null);
    // Exercise the actual mail-send rejection against the isolated database.
    // No network SMTP request is made.
    process.env.GMAIL_USER = "synthetic-sender@example.test";
    process.env.GMAIL_APP_PASSWORD = "synthetic-only-not-a-secret";
    const transportMock = mock.method(nodemailer, "createTransport", () => ({
      sendMail: async () => { throw new Error("synthetic SMTP delivery failure"); },
    }));
    try {
      const failedDelivery = await recover(new Request("https://example.test/api/auntpenny/recover", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }),
      }));
      assert.equal(failedDelivery.status, 503);
      const afterFailure = await prisma.auntPennyOrder.findUniqueOrThrow({ where: { id: order.id } });
      assert.equal(afterFailure.accessTokenHash, null, "undelivered access token must be revoked");
      assert.equal(afterFailure.accessExpiresAt, null, "undelivered token expiry must be cleared");
    } finally {
      transportMock.mock.restore();
      delete process.env.GMAIL_USER;
      delete process.env.GMAIL_APP_PASSWORD;
    }
  } finally {
    globalThis.fetch = originalFetch;
    await prisma.auntPennyOrder.delete({ where: { id: order.id } });
    await prisma.$disconnect();
  }
});
