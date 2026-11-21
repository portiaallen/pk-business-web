import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sandboxStripe, requireSandbox, PRICE_CENTS } from "../src/lib/auntpenny/paid";

test("sandbox fails closed without enablement and test key", () => {
  const prior = process.env.AUNT_PENNY_PAID_SANDBOX_ENABLED;
  const key = process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY;
  try {
    delete process.env.AUNT_PENNY_PAID_SANDBOX_ENABLED;
    assert.throws(() => requireSandbox());
    process.env.AUNT_PENNY_PAID_SANDBOX_ENABLED = "true";
    requireSandbox();
    process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY = "sk_live_fake";
    assert.throws(() => sandboxStripe());
  } finally {
    if (prior === undefined) delete process.env.AUNT_PENNY_PAID_SANDBOX_ENABLED; else process.env.AUNT_PENNY_PAID_SANDBOX_ENABLED = prior;
    if (key === undefined) delete process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY; else process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY = key;
  }
});

test("Stripe REST creates correct sandbox form and retrieves a synthetic session", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY;
  process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY = "sk_test_synthetic_no_network";
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: "cs_test_synthetic123", url: "https://checkout.stripe.com/c/pay/cs_test_synthetic123", payment_status: "paid" }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const stripe = sandboxStripe();
    const input = { mode: "payment", customer_email: "buyer@example.test", line_items: [{ price_data: { currency: "usd", unit_amount: PRICE_CENTS, product_data: { name: "Aunt Penny", description: "Synthetic" } }, quantity: 1 }], success_url: "https://example.test/paid", cancel_url: "https://example.test/cancel", client_reference_id: "order-synthetic", metadata: { orderId: "order-synthetic", productCode: "aunt-penny-roast-report-v1" }, payment_method_types: ["card"] };
    const created = await stripe.checkout.sessions.create(input, { idempotencyKey: "synthetic-key" });
    assert.equal(created.id, "cs_test_synthetic123");
    assert.equal(calls[0].url, "https://api.stripe.com/v1/checkout/sessions");
    const params = new URLSearchParams(String(calls[0].init.body));
    assert.equal(params.get("line_items[0][price_data][unit_amount]"), "999");
    assert.equal(params.get("metadata[orderId]"), "order-synthetic");
    assert.equal(new Headers(calls[0].init.headers).get("Idempotency-Key"), "synthetic-key");
    await stripe.checkout.sessions.retrieve("cs_test_synthetic123");
    assert.equal(calls[1].url, "https://api.stripe.com/v1/checkout/sessions/cs_test_synthetic123");
    await assert.rejects(stripe.checkout.sessions.retrieve("cs_live_forbidden"));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY; else process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY = originalKey;
  }
});

test("webhook verifies HMAC, rejects tampering and stale timestamps", () => {
  const prior = process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY;
  process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY = "sk_test_synthetic_no_network";
  try {
    const stripe = sandboxStripe();
    const secret = "whsec_synthetic_only";
    const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_test_synthetic123", payment_status: "paid" } } });
    const t = String(Math.floor(Date.now() / 1000));
    const sig = createHmac("sha256", secret).update(t + "." + payload).digest("hex");
    const event = stripe.webhooks.constructEvent(payload, "t=" + t + ",v1=" + sig, secret);
    assert.equal(event.data.object.id, "cs_test_synthetic123");
    assert.throws(() => stripe.webhooks.constructEvent(payload + " ", "t=" + t + ",v1=" + sig, secret));
    assert.throws(() => stripe.webhooks.constructEvent(payload, "t=" + String(Number(t) - 601) + ",v1=" + sig, secret));
  } finally {
    if (prior === undefined) delete process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY; else process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY = prior;
  }
});
