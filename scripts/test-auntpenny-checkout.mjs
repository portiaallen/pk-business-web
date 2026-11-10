import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const checkout = source("src/app/api/auntpenny/checkout/route.ts");
const webhook = source("src/app/api/auntpenny/webhook/route.ts");
const paid = source("src/app/auntpenny/roastmybooks/paid/page.tsx");
const config = source("src/lib/auntpenny/paid.ts");
const schema = source("prisma/schema.prisma");
const pkg = JSON.parse(source("package.json"));
const lock = JSON.parse(source("package-lock.json"));
test("checkout is sandbox-only and server validates intake", () => {
  assert.match(checkout, /requireSandbox\(\)/);
  assert.match(checkout, /validateIntake\(answers\)/);
  assert.match(checkout, /sandboxStripe\(\)/);
  assert.match(checkout, /auntPennyOrder\.create/);
  assert.match(checkout, /PRICE_CENTS/);
  assert.match(checkout, /idempotencyKey/);
  assert.match(checkout, /AUNT_PENNY_CHECKOUT_NOT_READY/);
});
test("server rejects live Stripe keys and disabled sandbox", () => {
  assert.match(config, /sk_test_/);
  assert.match(config, /AUNT_PENNY_PAID_SANDBOX_ENABLED/);
  assert.doesNotMatch(config, /sk_live_/);
});
test("webhook validates Stripe signature and paid order", () => {
  assert.match(webhook, /webhooks\.constructEvent/);
  assert.match(webhook, /stripe-signature/);
  assert.match(webhook, /payment_status !== "paid"/);
  assert.match(webhook, /amount_total !== PRICE_CENTS/);
  assert.match(webhook, /stripeSessionId !== session\.id/);
  assert.match(webhook, /status: "PENDING"/);
});
test("report refuses client payment flags and requires verified paid state", () => {
  assert.match(paid, /checkout\.sessions\.retrieve/);
  assert.match(paid, /payment_status !== "paid"/);
  assert.match(paid, /order\.status !== "PAID"/);
  assert.match(paid, /requireSandbox\(\)/);
  assert.doesNotMatch(paid, /searchParams.*paid.*true/);
});
test("order schema exists and includes unique session identifier", () => {
  assert.match(schema, /model AuntPennyOrder/);
  assert.match(schema, /stripeSessionId String\? @unique/);
});
test("Stripe package-lock agrees with package manifest", () => {
  assert.equal(lock.packages[""].dependencies.stripe, pkg.dependencies.stripe, "Run npm install --package-lock-only to regenerate the lockfile");
  assert.ok(lock.packages["node_modules/stripe"]?.integrity, "Missing Stripe integrity in lockfile");
});
