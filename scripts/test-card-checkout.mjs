// Isolated regression checks: no real auth, database, Stripe calls, or charges.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const cache = new Map();
const runtime = { env: {} };
let authenticated = true;
let invoice;
let requests = [];
let sessionOverride = {};

function load(relative) {
  const filename = path.join(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loadedModule = { exports: {} };
  cache.set(filename, loadedModule);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (id) => {
    if (id === "@/lib/prisma") return { prisma: { invoice: { findUnique: async () => invoice } } };
    if (id === "@/lib/auth") return {
      getSessionTokenFromRequest: () => authenticated ? "fixture-session" : null,
      requireAuthContext: async (token) => {
        if (!token) throw load("src/lib/api-error.ts").ApiError.unauthorized();
        return { clientId: "fixture-client" };
      },
    };
    if (id.startsWith("@/")) return load(`src/${id.slice(2)}.ts`);
    return require(id);
  };
  const safeFetch = async (url, options) => {
    assert.equal(url, "https://api.stripe.com/v1/checkout/sessions");
    assert.equal(options.method, "POST");
    const form = new URLSearchParams(options.body);
    requests.push(form);
    return Response.json({
      id: "cs_test_fixture", url: "https://checkout.stripe.com/c/pay/cs_test_fixture",
      mode: "payment", livemode: false,
      amount_total: Number(form.get("line_items[0][price_data][unit_amount]")),
      currency: form.get("line_items[0][price_data][currency]"),
      client_reference_id: form.get("client_reference_id"),
      metadata: { invoiceId: form.get("metadata[invoiceId]"), clientId: form.get("metadata[clientId]"), balanceCents: form.get("metadata[balanceCents]") },
      ...sessionOverride,
    });
  };
  const wrapper = vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    process: runtime, fetch: safeFetch, Response, Request, URL, URLSearchParams, console,
  }, { filename });
  wrapper(localRequire, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}

const { isStripeConfigured } = load("src/lib/invoices.ts");
const { POST } = load("src/app/api/portal/invoices/[id]/checkout/route.ts");
const testKey = "sk_test_fixture_not_a_credential";
const testWebhook = "whsec_fixture_not_a_credential";
let passed = 0;
for (const [env, expected] of [
  [{}, false], [{ STRIPE_SECRET_KEY: testKey }, false],
  [{ STRIPE_WEBHOOK_SECRET: testWebhook }, false],
  [{ STRIPE_SECRET_KEY: " ", STRIPE_WEBHOOK_SECRET: testWebhook }, false],
  [{ STRIPE_SECRET_KEY: testKey, STRIPE_WEBHOOK_SECRET: " " }, false],
  [{ STRIPE_SECRET_KEY: testKey, STRIPE_WEBHOOK_SECRET: testWebhook }, true],
  [{ PK_ENVIRONMENT: "production", PK_STRIPE_ENVIRONMENT: "production", STRIPE_SECRET_KEY: "sk_live_fixture_not_a_credential", STRIPE_WEBHOOK_SECRET: testWebhook }, true],
]) { runtime.env = { PK_ENVIRONMENT: "test", PK_STRIPE_ENVIRONMENT: "test", ...env }; assert.equal(isStripeConfigured(), expected); passed++; }

async function checkout() {
  return POST(new Request("https://pk.example.test/api/portal/invoices/fixture-invoice/checkout", { method: "POST" }), { params: Promise.resolve({ id: "fixture-invoice" }) });
}
function reset() {
  runtime.env = { PK_ENVIRONMENT: "test", PK_STRIPE_ENVIRONMENT: "test", STRIPE_SECRET_KEY: testKey, STRIPE_WEBHOOK_SECRET: testWebhook };
  authenticated = true; requests = []; sessionOverride = {};
  invoice = { id: "fixture-invoice", clientId: "fixture-client", invoiceNumber: "FIXTURE-ONLY", status: "SENT", currency: "USD", amountCents: 10000, dueAt: null, payments: [{ status: "PAID", amountCents: 2000 }] };
}
async function rejected(status) {
  assert.equal((await checkout()).status, status); assert.equal(requests.length, 0); passed++;
}
reset(); authenticated = false; await rejected(401);
reset(); delete runtime.env.STRIPE_WEBHOOK_SECRET; await rejected(503);
reset(); runtime.env.STRIPE_SECRET_KEY = "invalid-fixture"; await rejected(503);
reset(); invoice.clientId = "other-fixture-client"; await rejected(404);
reset(); invoice.status = "DRAFT"; await rejected(400);
reset(); invoice.payments = [{ status: "PAID", amountCents: 10000 }]; await rejected(400);
reset();
const response = await checkout();
assert.equal(response.status, 200);
assert.equal((await response.json()).url, "https://checkout.stripe.com/c/pay/cs_test_fixture");
assert.equal(requests.length, 1);
assert.equal(requests[0].get("line_items[0][price_data][unit_amount]"), "8000");
assert.equal(requests[0].get("payment_method_types[0]"), "card");
assert.equal(requests[0].get("metadata[clientId]"), "fixture-client");
assert.equal(requests[0].get("success_url"), "https://pk.example.test/portal/invoices?invoice=fixture-invoice&checkout=success");
passed++;
for (const override of [{ amount_total: 1 }, { url: "https://example.test/unsafe" }, { livemode: true }, { metadata: { invoiceId: "other" } }]) {
  reset(); sessionOverride = override; assert.equal((await checkout()).status, 502); passed++;
}
console.log(`${passed} configuration/checkout checks passed; Stripe, auth, and database boundaries mocked; zero real charges.`);
