// Disposable local data, synthetic transport only. No real charge, email or taxpayer data.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import Database from "better-sqlite3";
const root = mkdtempSync(join(tmpdir(), "pk-readiness-synthetic-"));
for (const key of [
  "NETLIFY",
  "CONTEXT",
  "VERCEL",
  "VERCEL_ENV",
  "TURSO_DATABASE_URL",
  "DATABASE_AUTH_TOKEN",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
])
  delete process.env[key];
Object.assign(process.env, {
  NODE_ENV: "test",
  PK_ENVIRONMENT: "test",
  PK_AUTH_ENVIRONMENT: "test",
  AUTH_SECRET: "readiness-synthetic-only-not-credential",
  PK_ALLOW_SYNTHETIC_SETUP: "true",
  PK_READINESS_ENABLED: "true",
  PK_READINESS_MAIL_MODE: "synthetic",
  PK_STRIPE_ENVIRONMENT: "test",
  STRIPE_SECRET_KEY: "sk_test_synthetic_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_synthetic_fixture",
  DATABASE_URL: `file:${join(root, "test.db")}`,
});
const sqlite = new Database(join(root, "test.db"));
const baseline = join(root, "baseline.prisma");
writeFileSync(
  baseline,
  execFileSync("git", [
    "show",
    "cdbca2e5c1b41ab36c2c827962f7c4b274d19281:prisma/schema.prisma",
  ]),
);
sqlite.exec(
  execFileSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema",
      baseline,
      "--script",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ),
);
sqlite
  .prepare("INSERT INTO Client(id,name,createdAt,updatedAt) VALUES(?,?,?,?)")
  .run(
    "migration-preserved",
    "Synthetic ordinary client",
    Date.now(),
    Date.now(),
  );
sqlite.exec(
  readFileSync("prisma/readiness-migrations/readiness-v1.sql", "utf8"),
);
sqlite.exec(
  readFileSync("prisma/readiness-migrations/readiness-recovery-v1.sql", "utf8"),
);
const { prisma } = await import("../src/lib/prisma");
const auth = await import("../src/lib/auth");
const policy = await import("../src/lib/readiness/policy");
const purchase = await import("../src/lib/readiness/purchase");
const recoveryRoute = await import("../src/app/api/readiness/recovery/route");
const svc = await import("../src/lib/readiness/service");
const library = await import("../src/lib/readiness/library");
const reports = await import("../src/lib/readiness/reports");
const notices = await import("../src/lib/readiness/notifications");
const webhook = await import("../src/app/api/stripe/webhook/route");
const startRoute = await import("../src/app/api/readiness/start/route");
const analyticsRoute = await import("../src/app/api/readiness/analytics/route");
const origin = "http://localhost:4321";
const tokens: Record<string, string> = {};
let aId = "",
  clientId = "",
  purchaseCookie = "",
  reportId = "",
  entryId = "";
let stripeCalls = 0;
const sessions = new Map<string, Record<string, unknown>>();
globalThis.fetch = async (input, options) => {
  assert.equal(
    String(input),
    "https://api.stripe.com/v1/checkout/sessions",
    "Only synthetic Stripe transport permitted",
  );
  stripeCalls++;
  const headers = new Headers(options?.headers);
  const body = new URLSearchParams(String(options?.body));
  const id = body.get("client_reference_id")!;
  assert.equal(body.get("line_items[0][price_data][unit_amount]"), "9900");
  assert.equal(body.get("line_items[0][price_data][currency]"), "usd");
  assert.equal(headers.get("Idempotency-Key"), `pk-readiness-${id}`);
  assert.ok(!String(options?.body).includes("example.test"));
  assert.ok(!String(options?.body).includes("bookkeeping"));
  let session = sessions.get(id);
  if (!session) {
    session = {
      id: "cs_test_" + id,
      object: "checkout.session",
      client_reference_id: id,
      metadata: { readinessAssessmentId: id },
      mode: "payment",
      status: "open",
      payment_status: "unpaid",
      livemode: false,
      amount_total: 9900,
      currency: "usd",
      payment_intent: "pi_test_" + id,
      url: "https://checkout.stripe.com/c/pay/cs_test_" + id,
    };
    sessions.set(id, session);
  }
  return Response.json(session);
};
const preliminary = {
  name: "Synthetic Buyer",
  email: "buyer@example.test",
  businessType: "FREELANCER",
  bookkeeping: "BEHIND",
  concern: "BOOKS",
  consent: true,
};
const intake = {
  businessName: "Synthetic Business",
  reviewPeriod: "2026-09",
  bookkeepingSystem: "SPREADSHEET",
  bookkeepingStatus: "BEHIND",
  reconciliationStatus: "PARTIAL",
  incomeStreams: ["CLIENTS"],
  incomeExpenseOrganization: "PARTIAL",
  recordsStatus: "SCATTERED",
  taxPreparationStatus: "NOT_STARTED",
  priority: "BOOKS",
};
function request(
  user = "",
  path = "/api/readiness",
  body?: unknown,
  context = clientId,
) {
  return new Request(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin,
      "content-type": "application/json",
      cookie: [
        purchaseCookie,
        tokens[user] ? "pk_business_session=" + tokens[user] : "",
      ]
        .filter(Boolean)
        .join("; "),
      "x-pk-client-context": context,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function current() {
  return prisma.readinessAssessment.findUniqueOrThrow({ where: { id: aId } });
}
function recoveryRequest(
  action: string,
  fields: unknown,
  address = "recovery-test",
) {
  return new Request(origin + "/api/readiness/recovery", {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      "x-real-ip": address,
    },
    body: JSON.stringify({ action, fields }),
  });
}
async function resetRecoveryLimits(email = preliminary.email) {
  await prisma.readinessPublicRateLimit.deleteMany({
    where: {
      key: {
        in: [
          ...["send", "verify"].map((op) =>
            auth.hashToken(`readiness-recovery-rate:${op}:${email}`),
          ),
          ...["send", "verify"].map((op) =>
            auth.hashToken(`readiness-rate:recovery_${op}:recovery-test`),
          ),
        ],
      },
    },
  });
}
async function recoveryCode(email = preliminary.email) {
  assert.equal(
    (await recoveryRoute.POST(recoveryRequest("REQUEST", { email }))).status,
    200,
  );
  return notices
    .syntheticMail()
    .at(-1)!
    .text.match(/\b[a-f0-9]{32}\b/)![0];
}
async function admin(data: Record<string, unknown>) {
  return svc.adminMutation(request("admin"), aId, {
    expectedVersion: (await current()).version,
    ...data,
  });
}
async function portal(data: Record<string, unknown>) {
  return svc.portalMutation(request("buyer"), aId, {
    expectedVersion: (await current()).version,
    ...data,
  });
}
async function signed(
  session: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
  signature = true,
) {
  const payload = JSON.stringify({
    id: "evt_synthetic",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { ...session, ...overrides } },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  return webhook.POST(
    new Request(origin + "/api/stripe/webhook", {
      method: "POST",
      headers: {
        "stripe-signature": signature
          ? `t=${timestamp},v1=${createHmac(
              "sha256",
              process.env.STRIPE_WEBHOOK_SECRET!,
            )
              .update(timestamp + "." + payload)
              .digest("hex")}`
          : "invalid",
      },
      body: payload,
    }),
  );
}
async function user(
  id: string,
  role: "ADMIN" | "STAFF" | "CLIENT",
  context: string,
  member?: "OWNER" | "VIEWER",
) {
  await prisma.user.create({
    data: {
      id,
      name: "Synthetic",
      email: id + "@example.test",
      role,
      passwordHash: "synthetic",
    },
  });
  tokens[id] = await auth.createSession(
    id,
    role === "CLIENT" ? "PASSWORD" : "WEBAUTHN",
  );
  await prisma.session.updateMany({
    where: { userId: id },
    data: {
      activeClientId: context,
      mfaVerifiedAt: role === "CLIENT" ? null : new Date(),
    },
  });
  if (member)
    await prisma.clientMember.create({
      data: { clientId: context, userId: id, role: member },
    });
}
const resource = {
  title: "Independent professional",
  category: "Business",
  recommendationType: "PROFESSIONAL_TYPE",
  clientFacingDescription: "Consult a licensed professional.",
  whyOrWhenToUse: "Resolve a need outside PK scope.",
  clientNextStep: "Confirm scope and qualifications.",
  internalNotes: "PRIVATE_LIBRARY_NOTE",
};
after(async () => {
  await prisma.$disconnect();
  sqlite.close();
  rmSync(root, { recursive: true, force: true });
});
test("forward migration: foreign keys and schema integrity", () => {
  assert.equal(
    (
      sqlite
        .prepare("SELECT name FROM Client WHERE id=?")
        .get("migration-preserved") as { name: string }
    ).name,
    "Synthetic ordinary client",
  );
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(
    (
      sqlite.prepare("PRAGMA integrity_check").get() as {
        integrity_check: string;
      }
    ).integrity_check,
    "ok",
  );
  assert.equal(
    (
      sqlite
        .prepare(
          "SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name LIKE 'readiness_%'",
        )
        .get() as { n: number }
    ).n,
    6,
  );
});
test("production/hosting cannot enable synthetic purchasing", async () => {
  process.env.PK_READINESS_ENABLED = "false";
  try {
    const r = await analyticsRoute.POST(
      request("", "/api/readiness/analytics", {
        event: "readiness_page_view",
        dedupeKey: randomUUID(),
      }),
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).accepted, false);
  } finally {
    process.env.PK_READINESS_ENABLED = "true";
  }
  const saved = {
    NETLIFY: process.env.NETLIFY,
    CONTEXT: process.env.CONTEXT,
    NODE_ENV: process.env.NODE_ENV,
    PK_ENVIRONMENT: process.env.PK_ENVIRONMENT,
  };
  Object.assign(process.env, {
    NETLIFY: "true",
    CONTEXT: "production",
    NODE_ENV: "production",
    PK_ENVIRONMENT: "production",
  });
  try {
    assert.equal(purchase.availability().checkoutAvailable, false);
    await assert.rejects(() => purchase.startPurchase(request(), preliminary));
    for (const action of ["REQUEST", "VERIFY"]) {
      const r = await recoveryRoute.POST(
        recoveryRequest(action, {
          email: preliminary.email,
          ...(action === "VERIFY" ? { code: "0".repeat(32) } : {}),
        }),
      );
      assert.equal(r.status, 503);
      assert.equal(r.headers.get("set-cookie"), null);
    }
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  assert.equal(await prisma.readinessAssessment.count(), 0);
});
test("public boundary rejects pricing injection, SSN and free concern", async () => {
  for (const bad of [
    { ...preliminary, priceCents: 1 },
    { ...preliminary, name: "123-45-6789" },
    { ...preliminary, concern: "Tax account secret" },
  ]) {
    const response = await startRoute.POST(
      request("", "/api/readiness/start", bad),
    );
    assert.equal(response.status, 400);
  }
  assert.equal(await prisma.readinessAssessment.count(), 0);
});
test("same-origin boundary rejects CSRF before persistence", async () => {
  const r = new Request(origin + "/api/readiness/start", {
    method: "POST",
    headers: {
      origin: "https://evil.example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify(preliminary),
  });
  assert.equal((await startRoute.POST(r)).status, 403);
});
test("one provisional assessment and immutable $99 for retries", async () => {
  const result = await purchase.startPurchase(request(), preliminary);
  aId = result.assessmentId;
  purchaseCookie = result.cookie.split(";")[0];
  clientId = (await current()).clientId;
  assert.equal(
    (await purchase.startPurchase(request(), preliminary)).assessmentId,
    aId,
  );
  assert.equal(await prisma.readinessAssessment.count(), 1);
  assert.equal((await current()).priceCents, 9900);
  await assert.rejects(async () =>
    prisma.readinessAssessment.update({
      where: { id: aId },
      data: { priceCents: 1 },
    }),
  );
});
test("checkout uses fixed price and provider idempotency key", async () => {
  const one = await purchase.beginCheckout(request());
  const two = await purchase.beginCheckout(request());
  assert.equal(one.url, two.url);
  assert.equal(sessions.size, 1);
  assert.equal(stripeCalls, 2);
  assert.equal((await current()).paymentStatus, "PENDING");
});
test("redirect alone, cancelled/unpaid, unsigned and wrong amount never pay", async () => {
  assert.equal(
    (
      await purchase.publicStatus(
        request("", "/readiness/start?checkout=success"),
      )
    ).paymentStatus,
    "PENDING",
  );
  const s = sessions.get(aId)!;
  assert.equal((await signed(s)).status, 200);
  assert.equal(
    (
      await signed(s, {
        status: "complete",
        payment_status: "paid",
        amount_total: 1,
      })
    ).status,
    400,
  );
  assert.equal(
    (await signed(s, { status: "complete", payment_status: "paid" }, false))
      .status,
    400,
  );
  assert.equal(
    (
      await signed(s, {
        status: "complete",
        payment_status: "paid",
        livemode: true,
      })
    ).status,
    400,
  );
  assert.equal((await current()).paymentStatus, "PENDING");
});
test("recovery cannot restore an unpaid assessment and rejects CSRF", async () => {
  await resetRecoveryLimits();
  const code = await recoveryCode();
  assert.equal((await current()).recoveryCodeHash, null);
  const denied = await recoveryRoute.POST(
    recoveryRequest("VERIFY", { email: preliminary.email, code }),
  );
  assert.equal(denied.status, 400);
  assert.equal(denied.headers.get("set-cookie"), null);
  const csrf = new Request(origin + "/api/readiness/recovery", {
    method: "POST",
    headers: {
      origin: "https://evil.example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "REQUEST",
      fields: { email: preliminary.email },
    }),
  });
  assert.equal((await recoveryRoute.POST(csrf)).status, 403);
});
test("verified payment and repeated webhook create exactly one payment", async () => {
  const s = {
    ...sessions.get(aId)!,
    status: "complete",
    payment_status: "paid",
  };
  assert.equal((await signed(s)).status, 200);
  const repeat = await signed(s);
  assert.equal(repeat.status, 200);
  assert.equal((await repeat.json()).duplicate, true);
  assert.equal(await prisma.payment.count(), 1);
  assert.equal((await current()).paymentStatus, "PAID");
  assert.equal((await current()).reportDeliveredAt, null);
  assert.equal(await prisma.readinessCredit.count(), 0);
});
test("recovery is generic before email proof; no purchase or client enumeration", async () => {
  await resetRecoveryLimits();
  const known = await recoveryRoute.POST(
    recoveryRequest("REQUEST", { email: preliminary.email.toUpperCase() }),
  );
  const knownMail = notices
    .syntheticMail()
    .at(-1)!
    .text.replace(/\b[a-f0-9]{32}\b/, "CODE");
  const unknown = await recoveryRoute.POST(
    recoveryRequest("REQUEST", { email: "unknown@example.test" }),
  );
  assert.deepEqual(await known.json(), { accepted: true });
  assert.deepEqual(await unknown.json(), { accepted: true });
  assert.equal(known.headers.get("set-cookie"), null);
  assert.equal(unknown.headers.get("set-cookie"), null);
  assert.equal(
    notices
      .syntheticMail()
      .at(-1)!
      .text.replace(/\b[a-f0-9]{32}\b/, "CODE"),
    knownMail,
  );
  assert.ok(!knownMail.includes(aId));
  assert.ok(!knownMail.includes(clientId));
  assert.equal(await prisma.readinessAssessment.count(), 1);
});
test("lost cookie and expired purchase recover the original verified payment once", async () => {
  await resetRecoveryLimits();
  const before = await current();
  const checkoutCalls = stripeCalls;
  const oldCookie = purchaseCookie;
  const payment = await prisma.payment.findUniqueOrThrow({
    where: { id: before.paymentId! },
  });
  await prisma.readinessAssessment.update({
    where: { id: aId },
    data: { purchaseExpiresAt: new Date(0) },
  });
  await assert.rejects(() => purchase.publicStatus(request()));
  const code = await recoveryCode();
  const pending = await current();
  assert.notEqual(pending.recoveryCodeHash, code);
  assert.ok(pending.recoveryCodeExpiresAt!.getTime() <= Date.now() + 600000);
  assert.equal(
    (
      await recoveryRoute.POST(
        recoveryRequest("VERIFY", { email: "intruder@example.test", code }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await recoveryRoute.POST(
        recoveryRequest("VERIFY", {
          email: preliminary.email,
          code: "0".repeat(32),
        }),
      )
    ).status,
    400,
  );
  const success = await recoveryRoute.POST(
    recoveryRequest("VERIFY", { email: preliminary.email, code }),
  );
  assert.equal(success.status, 200);
  assert.deepEqual(await success.json(), { recovered: true });
  const cookie = success.headers.get("set-cookie")!;
  assert.match(cookie, /HttpOnly; SameSite=Lax; Max-Age=900/);
  assert.ok(!cookie.includes("pk_business_session"));
  assert.notEqual(cookie.split(";")[0], oldCookie);
  const replay = await recoveryRoute.POST(
    recoveryRequest("VERIFY", { email: preliminary.email, code }),
  );
  assert.equal(replay.status, 400);
  assert.equal(replay.headers.get("set-cookie"), null);
  await assert.rejects(
    () => purchase.publicStatus(request()),
    "Old setup cookie must be revoked",
  );
  purchaseCookie = cookie.split(";")[0];
  const status = await purchase.publicStatus(request());
  assert.equal(status.assessmentId, aId);
  assert.equal(status.clientId, clientId);
  assert.equal(status.paymentStatus, "PAID");
  await assert.rejects(
    () => svc.detail(request(), aId),
    "Setup recovery is not a client session",
  );
  const a = await current();
  assert.equal(a.recoveryCodeHash, null);
  assert.equal(a.recoveryCodeExpiresAt, null);
  assert.equal(a.ownerUserId, null);
  assert.equal(a.invoiceId, before.invoiceId);
  assert.equal(a.paymentId, before.paymentId);
  assert.ok(a.purchaseExpiresAt.getTime() <= Date.now() + 900000);
  assert.deepEqual(
    await prisma.payment.findUniqueOrThrow({ where: { id: a.paymentId! } }),
    payment,
  );
  assert.equal(await prisma.payment.count(), 1);
  assert.equal(await prisma.readinessAssessment.count(), 1);
  assert.equal(stripeCalls, checkoutCalls, "Recovery must never call checkout");
  const events = await prisma.auditLog.findMany({ where: { resourceId: aId } });
  assert.ok(events.some((e) => e.metadata.includes("SETUP_RECOVERY_VERIFIED")));
  assert.ok(
    events.every(
      (e) =>
        !e.metadata.includes(code) && !e.metadata.includes(preliminary.email),
    ),
  );
});
test("expired, superseded and concurrent recovery credentials cannot replay", async () => {
  await resetRecoveryLimits();
  const expired = await recoveryCode();
  await prisma.readinessAssessment.update({
    where: { id: aId },
    data: { recoveryCodeExpiresAt: new Date(0) },
  });
  assert.equal(
    (
      await recoveryRoute.POST(
        recoveryRequest("VERIFY", { email: preliminary.email, code: expired }),
      )
    ).status,
    400,
  );
  const superseded = await recoveryCode();
  const fresh = await recoveryCode();
  assert.equal(
    (
      await recoveryRoute.POST(
        recoveryRequest("VERIFY", {
          email: preliminary.email,
          code: superseded,
        }),
      )
    ).status,
    400,
  );
  const results = await Promise.all(
    [0, 1].map(() =>
      recoveryRoute.POST(
        recoveryRequest("VERIFY", { email: preliminary.email, code: fresh }),
      ),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 400]);
  purchaseCookie = results
    .find((r) => r.status === 200)!
    .headers.get("set-cookie")!
    .split(";")[0];
  assert.equal(await prisma.payment.count(), 1);
  assert.equal(await prisma.readinessAssessment.count(), 1);
});
test("recovery rejects refunded or cross-client payment evidence and expired setup credentials", async () => {
  await resetRecoveryLimits();
  await prisma.readinessAssessment.update({
    where: { id: aId },
    data: { purchaseExpiresAt: new Date(0) },
  });
  await assert.rejects(() => purchase.publicStatus(request()));
  const code = await recoveryCode();
  const a = await current();
  await prisma.payment.update({
    where: { id: a.paymentId! },
    data: { clientId: "migration-preserved" },
  });
  assert.equal(
    (
      await recoveryRoute.POST(
        recoveryRequest("VERIFY", { email: preliminary.email, code }),
      )
    ).status,
    400,
  );
  await prisma.payment.update({
    where: { id: a.paymentId! },
    data: { clientId, status: "REFUNDED" },
  });
  assert.equal(
    (
      await recoveryRoute.POST(
        recoveryRequest("VERIFY", { email: preliminary.email, code }),
      )
    ).status,
    400,
  );
  await prisma.payment.update({
    where: { id: a.paymentId! },
    data: { status: "PAID" },
  });
  const recovered = await recoveryRoute.POST(
    recoveryRequest("VERIFY", { email: preliminary.email, code }),
  );
  assert.equal(recovered.status, 200);
  purchaseCookie = recovered.headers.get("set-cookie")!.split(";")[0];
});
test("recovery email delivery failure is generic and invalidates the unsent credential", async () => {
  await resetRecoveryLimits();
  const messages = notices.syntheticMail();
  const push = messages.push;
  messages.push = () => {
    throw Error("Synthetic mail failure");
  };
  try {
    for (const email of [preliminary.email, "mail-failed@example.test"]) {
      const r = await recoveryRoute.POST(recoveryRequest("REQUEST", { email }));
      assert.equal(r.status, 200);
      assert.deepEqual(await r.json(), { accepted: true });
    }
    assert.equal((await current()).recoveryCodeHash, null);
  } finally {
    messages.push = push;
  }
});
test("recovery issuance persistence failure cannot enumerate the purchaser", async () => {
  await resetRecoveryLimits();
  await prisma.readinessAssessment.update({
    where: { id: aId },
    data: { recoveryCodeHash: null, recoveryCodeExpiresAt: null },
  });
  sqlite.exec(`CREATE TRIGGER block_recovery_request BEFORE INSERT ON AuditLog
    WHEN NEW.metadata LIKE '%SETUP_RECOVERY_REQUESTED%'
    BEGIN SELECT RAISE(ABORT,'SYNTHETIC_AUDIT_FAILURE'); END;`);
  try {
    const code = await recoveryCode();
    assert.equal((await current()).recoveryCodeHash, null);
    const known = notices
      .syntheticMail()
      .at(-1)!
      .text.replace(/\b[a-f0-9]{32}\b/, "CODE");
    await recoveryCode("persistence-unknown@example.test");
    assert.equal(
      notices
        .syntheticMail()
        .at(-1)!
        .text.replace(/\b[a-f0-9]{32}\b/, "CODE"),
      known,
    );
    assert.equal(
      (
        await recoveryRoute.POST(
          recoveryRequest("VERIFY", { email: preliminary.email, code }),
        )
      ).status,
      400,
    );
  } finally {
    sqlite.exec("DROP TRIGGER block_recovery_request");
  }
});
test("recovery audit failure rolls back credential consumption and cookie rotation", async () => {
  await resetRecoveryLimits();
  const code = await recoveryCode();
  const before = await current();
  sqlite.exec(`CREATE TRIGGER block_recovery_audit BEFORE INSERT ON AuditLog
    WHEN NEW.metadata LIKE '%SETUP_RECOVERY_VERIFIED%'
    BEGIN SELECT RAISE(ABORT,'SYNTHETIC_AUDIT_FAILURE'); END;`);
  try {
    const rejected = await recoveryRoute.POST(
      recoveryRequest("VERIFY", { email: preliminary.email, code }),
    );
    assert.equal(rejected.status, 500);
    assert.equal(rejected.headers.get("set-cookie"), null);
    assert.equal((await current()).recoveryCodeHash, before.recoveryCodeHash);
    assert.equal((await current()).purchaseTokenHash, before.purchaseTokenHash);
  } finally {
    sqlite.exec("DROP TRIGGER block_recovery_audit");
  }
  const recovered = await recoveryRoute.POST(
    recoveryRequest("VERIFY", { email: preliminary.email, code }),
  );
  assert.equal(recovered.status, 200);
  purchaseCookie = recovered.headers.get("set-cookie")!.split(";")[0];
  assert.equal(await prisma.payment.count(), 1);
});
test("recovery throttles email requests and failed verification persistently", async () => {
  await resetRecoveryLimits();
  const initialMail = notices.syntheticMail().length;
  for (let i = 0; i < 4; i++) {
    const r = await recoveryRoute.POST(
      recoveryRequest("REQUEST", { email: preliminary.email }),
    );
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { accepted: true });
  }
  assert.equal(notices.syntheticMail().length - initialMail, 3);
  for (let i = 0; i < 10; i++)
    assert.equal(
      (
        await recoveryRoute.POST(
          recoveryRequest("VERIFY", {
            email: preliminary.email,
            code: "0".repeat(32),
          }),
        )
      ).status,
      400,
    );
  assert.equal(
    (
      await recoveryRoute.POST(
        recoveryRequest("VERIFY", {
          email: preliminary.email,
          code: "0".repeat(32),
        }),
      )
    ).status,
    429,
  );
  const rate = await prisma.readinessPublicRateLimit.findUniqueOrThrow({
    where: {
      key: auth.hashToken(
        `readiness-recovery-rate:verify:${preliminary.email}`,
      ),
    },
  });
  assert.equal(rate.count, 10);
  await resetRecoveryLimits();
});
test("paid email-code account setup after recovery stores hashes, limits attempts, binds owner", async () => {
  await purchase.requestOnboardingCode(request());
  const code = notices
    .syntheticMail()
    .at(-1)!
    .text.match(/\b\d{6}\b/)![0];
  assert.ok(!(await current()).onboardingCodeHash?.includes(code));
  await assert.rejects(async () =>
    purchase.onboard(request(), {
      code: "000000",
      password: "SyntheticPassword123!",
    }),
  );
  assert.equal((await current()).onboardingCodeAttempts, 1);
  const result = await purchase.onboard(request(), {
    code,
    password: "SyntheticPassword123!",
  });
  tokens.buyer = result.cookie!.split(";")[0].split("=")[1];
  const a = await current();
  assert.equal(a.status, "INTAKE_IN_PROGRESS");
  assert.ok(a.ownerUserId);
  assert.equal(a.onboardingCodeHash, null);
  assert.equal(await prisma.clientMember.count({ where: { clientId } }), 1);
  await prisma.session.updateMany({
    where: { userId: a.ownerUserId! },
    data: { activeClientId: clientId },
  });
});
test("already-bound accounts cannot recover setup or replace their identity", async () => {
  await resetRecoveryLimits();
  const before = await current();
  assert.equal(before.paymentStatus, "PAID");
  assert.ok(before.ownerUserId);
  const code = await recoveryCode();
  const r = await recoveryRoute.POST(
    recoveryRequest("VERIFY", { email: preliminary.email, code }),
  );
  assert.equal(r.status, 400);
  assert.equal(r.headers.get("set-cookie"), null);
  assert.equal((await current()).ownerUserId, before.ownerUserId);
  assert.equal((await current()).purchaseTokenHash, before.purchaseTokenHash);
});

test("anonymous, viewer, unassigned ADMIN and stale context denied", async () => {
  await user("viewer", "CLIENT", clientId, "VIEWER");
  await user("admin", "ADMIN", clientId);
  await user("unassigned", "ADMIN", clientId);
  await assert.rejects(async () => svc.detail(request(), aId));
  await assert.rejects(async () =>
    svc.adminMutation(request("unassigned"), aId, {
      action: "TRANSITION",
      expectedVersion: 0,
      status: "CLOSED",
      reason: "CUSTOMER_REQUEST",
    }),
  );
  await assert.rejects(async () =>
    svc.portalMutation(request("viewer"), aId, {
      action: "SAVE_INTAKE",
      expectedVersion: (await current()).version,
      intake,
    }),
  );
  await assert.rejects(async () =>
    svc.detail(request("buyer", "/api/readiness", undefined, "wrong"), aId),
  );
  for (const capability of [
    "confidential_access",
    "readiness_read",
    "readiness_review",
    "readiness_qa",
    "readiness_credit",
    "payments",
    "tax_information_access",
  ])
    await prisma.capabilityGrant.create({
      data: { userId: "admin", capability, scope: "CLIENT", clientId },
    });
  for (const capability of [
    "readiness_library_read",
    "readiness_library_write",
  ])
    await prisma.capabilityGrant.create({
      data: { userId: "admin", capability, scope: "GLOBAL", clientId: "" },
    });
});
test("view-only library role and expired step-up cannot mutate", async () => {
  await user("libraryreader", "STAFF", clientId);
  await prisma.capabilityGrant.create({
    data: {
      userId: "libraryreader",
      capability: "readiness_library_read",
      scope: "GLOBAL",
      clientId: "",
    },
  });
  assert.ok(await library.readLibrary(request("libraryreader")));
  await assert.rejects(async () =>
    library.mutateLibrary(request("libraryreader"), {
      action: "CREATE",
      entry: resource,
    }),
  );
  await prisma.session.updateMany({
    where: { userId: "admin" },
    data: { mfaVerifiedAt: new Date(0) },
  });
  await assert.rejects(async () =>
    library.mutateLibrary(request("admin"), {
      action: "CREATE",
      entry: resource,
    }),
  );
  await assert.rejects(async () => admin({ action: "FINALIZE" }));
  await prisma.session.updateMany({
    where: { userId: "admin" },
    data: { mfaVerifiedAt: new Date(), passwordVerifiedAt: new Date() },
  });
});
test("structured intake, exact acknowledgment and duplicate submission", async () => {
  await portal({ action: "SAVE_INTAKE", intake });
  await assert.rejects(async () =>
    portal({
      action: "SUBMIT",
      accepted: true,
      acknowledgment: "I agree",
      policyVersion: policy.POLICY_VERSION,
    }),
  );
  assert.equal((await current()).submittedAt, null);
  await admin({
    action: "REQUEST_DOCUMENT",
    kind: "BOOKKEEPING_SUMMARY",
    required: true,
  });
  await assert.rejects(async () =>
    portal({
      action: "SUBMIT",
      accepted: true,
      acknowledgment: policy.ACKNOWLEDGMENT,
      policyVersion: policy.POLICY_VERSION,
    }),
  );
  const doc = await prisma.readinessDocumentEvidence.findFirstOrThrow({
    where: { assessmentId: aId, kind: "BOOKKEEPING_SUMMARY" },
  });
  await admin({
    action: "RECORD_EXTERNAL_RECEIPT",
    evidenceId: doc.id,
    channel: "APPROVED_PK_SECURE_HANDOFF",
    externalReference: "synthetic_pre_submission",
    verifiedReceived: true,
  });
  const v = (await current()).version;
  const input = {
    action: "SUBMIT",
    expectedVersion: v,
    accepted: true,
    acknowledgment: policy.ACKNOWLEDGMENT,
    policyVersion: policy.POLICY_VERSION,
  };
  await svc.portalMutation(request("buyer"), aId, input);
  assert.equal(
    (await svc.portalMutation(request("buyer"), aId, input)).duplicate,
    true,
  );
  const a = await current();
  assert.equal(a.acknowledgmentText, policy.ACKNOWLEDGMENT);
  assert.equal(a.acknowledgmentById, a.ownerUserId);
  await assert.rejects(async () =>
    prisma.readinessAssessment.update({
      where: { id: aId },
      data: { acknowledgmentText: "changed" },
    }),
  );
});
test("SLA begins only when review ready, secure evidence blocks incomplete review", async () => {
  await admin({
    action: "REQUEST_DOCUMENT",
    kind: "TAX_SOURCE_INFORMATION",
    required: true,
  });
  assert.equal((await current()).status, "AWAITING_INFORMATION");
  assert.equal((await current()).slaDueAt, null);
  await assert.rejects(async () =>
    admin({
      action: "TRANSITION",
      status: "IN_REVIEW",
      reason: "INFORMATION_RECEIVED",
    }),
  );
  const evidence = await prisma.readinessDocumentEvidence.findFirstOrThrow({
    where: { assessmentId: aId, kind: "TAX_SOURCE_INFORMATION" },
  });
  await admin({
    action: "RECORD_EXTERNAL_RECEIPT",
    evidenceId: evidence.id,
    channel: "TAXSMART_MYTAXOFFICE",
    externalReference: "synthetic_receipt",
    verifiedReceived: true,
  });
  await admin({
    action: "TRANSITION",
    status: "IN_REVIEW",
    reason: "REVIEW_READY",
  });
  assert.ok((await current()).slaDueAt);
});
test("Vault integration requires released same-engagement document and explicit staff grant", async () => {
  await admin({
    action: "REQUEST_DOCUMENT",
    kind: "BUSINESS_RECORDS",
    required: true,
  });
  const evidence = await prisma.readinessDocumentEvidence.findFirstOrThrow({
    where: { assessmentId: aId, kind: "BUSINESS_RECORDS" },
  });
  const a = await current();
  await prisma.vaultDocument.create({
    data: {
      id: "synthetic-vault",
      clientId,
      requestId: a.requestId,
      createdBy: "admin",
      idempotencyKey: "synthetic-readiness",
      purpose: "Synthetic metadata link only",
      category: "BOOKKEEPING_SOURCE",
      mimeType: "application/pdf",
      expectedSize: 10,
      state: "INTENT",
      expiresAt: new Date(Date.now() + 60000),
      retentionCategory: "SYNTHETIC",
    },
  });
  await assert.rejects(async () =>
    admin({
      action: "LINK_VAULT_DOCUMENT",
      evidenceId: evidence.id,
      vaultDocumentId: "synthetic-vault",
    }),
  );
  await prisma.vaultDocument.update({
    where: { id: "synthetic-vault" },
    data: { state: "RELEASED" },
  });
  await assert.rejects(async () =>
    admin({
      action: "LINK_VAULT_DOCUMENT",
      evidenceId: evidence.id,
      vaultDocumentId: "synthetic-vault",
    }),
  );
  await prisma.capabilityGrant.create({
    data: {
      userId: "admin",
      capability: "vault_read",
      scope: "CLIENT",
      clientId,
    },
  });
  await admin({
    action: "LINK_VAULT_DOCUMENT",
    evidenceId: evidence.id,
    vaultDocumentId: "synthetic-vault",
  });
  assert.equal(
    (
      await prisma.readinessDocumentEvidence.findUniqueOrThrow({
        where: { id: evidence.id },
      })
    ).channel,
    "VAULT",
  );
  await admin({
    action: "TRANSITION",
    status: "IN_REVIEW",
    reason: "INFORMATION_RECEIVED",
  });
});
test("legacy ordinary upload denied for readiness requests", async () => {
  const transfer = await import("../src/lib/ordinary-transfer/service");
  await assert.rejects(async () =>
    transfer.createIntent(request("buyer"), {
      operation: "UPLOAD",
      kind: "DOCUMENT",
      requestId: (await current()).requestId,
      size: 4,
      mime: "text/plain",
      fileName: "synthetic.txt",
    }),
  );
});
test("library CRUD, defaults, disclosure controls, duplicate and stale update", async () => {
  const result = await library.mutateLibrary(request("admin"), {
    action: "CREATE",
    entry: resource,
  });
  entryId = result.id!;
  const entry = await prisma.recommendationLibraryEntry.findUniqueOrThrow({
    where: { id: entryId },
  });
  assert.equal(entry.relationshipClassification, "INFORMATIONAL");
  await assert.rejects(async () =>
    library.mutateLibrary(request("admin"), {
      action: "CREATE",
      entry: {
        ...resource,
        relationshipClassification: "PAID_OR_COMPENSATED_RELATIONSHIP",
      },
    }),
  );
  const copy = await library.mutateLibrary(request("admin"), {
    action: "DUPLICATE",
    id: entryId,
  });
  assert.equal(
    (
      await prisma.recommendationLibraryEntry.findUniqueOrThrow({
        where: { id: copy.id! },
      })
    ).active,
    false,
  );
  await assert.rejects(async () =>
    library.mutateLibrary(request("admin"), {
      action: "UPDATE",
      id: entryId,
      expectedVersion: 999,
      entry: resource,
    }),
  );
});
test("QA/finalization reject incomplete six-area rubric; status is independent of disposition", async () => {
  await assert.rejects(async () => admin({ action: "FINALIZE" }));
  await admin({
    action: "TRANSITION",
    status: "REPORT_DRAFT",
    reason: "DRAFT_STARTED",
  });
  await admin({
    action: "TRANSITION",
    status: "QA_REVIEW",
    reason: "QA_STARTED",
  });
  await assert.rejects(async () =>
    admin({
      action: "QA_APPROVE",
      previewReviewed: true,
      evidenceReviewed: true,
      recommendationsChecked: true,
      clientSafe: true,
    }),
  );
  await admin({
    action: "TRANSITION",
    status: "REPORT_DRAFT",
    reason: "DRAFT_STARTED",
  });
  await prisma.service.create({
    data: {
      id: "cleanup",
      slug: "synthetic-cleanup",
      name: "Synthetic Cleanup",
      shortName: "Cleanup",
      description: "Synthetic",
      shortDescription: "Synthetic",
      priceDisplay: "$150",
      priceCents: 15000,
    },
  });
  for (const area of policy.AREAS) {
    await admin({
      action: "SAVE_FINDING",
      finding: {
        area,
        status:
          area === "BOOKS" ? "CLEANUP_RECOMMENDED" : "INSUFFICIENT_INFORMATION",
        finding: "Synthetic " + area,
        evidenceBasis: "Synthetic structured intake only.",
        whyItMatters: "Readiness requires clarity.",
        recommendedAction: "Review the relevant next step.",
        priority: "HIGH",
        disposition:
          area === "BOOKS"
            ? "PK_CAN_HELP"
            : area === "TAX_SEASON"
              ? "OUTSIDE_HELP_RECOMMENDED"
              : "YOU_CAN_HANDLE_THIS",
        qualifyingServiceId: area === "BOOKS" ? "cleanup" : null,
        internalNotes: "PRIVATE_FINDING_NOTE",
        ordering: policy.AREAS.indexOf(area),
      },
    });
  }
  assert.equal(await prisma.readinessFinding.count(), 6);
});
test("multiple recommendations, immutable assignment, one-off optionally saved", async () => {
  const f = await prisma.readinessFinding.findFirstOrThrow({
    where: { assessmentId: aId, area: "TAX_SEASON" },
  });
  await admin({
    action: "ASSIGN_RECOMMENDATION",
    findingId: f.id,
    libraryEntryId: entryId,
  });
  await admin({
    action: "ASSIGN_RECOMMENDATION",
    findingId: f.id,
    wording: { ...resource, title: "One-off resource" },
    saveToLibrary: true,
    ordering: 1,
  });
  const oneOff = await prisma.assessmentRecommendation.findFirstOrThrow({
    where: { assessmentId: aId, ordering: 1, active: true },
  });
  await admin({
    action: "ASSIGN_RECOMMENDATION",
    findingId: f.id,
    replacementId: oneOff.id,
    wording: { ...resource, title: "Customized one-off resource" },
    ordering: 1,
  });
  assert.equal(
    (
      await prisma.assessmentRecommendation.findUniqueOrThrow({
        where: { id: oneOff.id },
      })
    ).active,
    false,
  );
  assert.equal(
    JSON.parse(
      (
        await prisma.assessmentRecommendation.findUniqueOrThrow({
          where: { id: oneOff.id },
        })
      ).snapshot,
    ).title,
    "One-off resource",
  );
  const assigned = await prisma.assessmentRecommendation.findFirstOrThrow({
    where: { libraryEntryId: entryId },
  });
  await library.mutateLibrary(request("admin"), {
    action: "UPDATE",
    id: entryId,
    expectedVersion: 1,
    entry: { ...resource, title: "Later library change" },
  });
  assert.equal(
    (
      await prisma.assessmentRecommendation.findUniqueOrThrow({
        where: { id: assigned.id },
      })
    ).snapshot,
    assigned.snapshot,
  );
  await library.mutateLibrary(request("admin"), {
    action: "ARCHIVE",
    id: entryId,
    expectedVersion: 2,
  });
  await assert.rejects(async () =>
    admin({
      action: "ASSIGN_RECOMMENDATION",
      findingId: f.id,
      libraryEntryId: entryId,
    }),
  );
  await assert.rejects(async () =>
    prisma.assessmentRecommendation.update({
      where: { id: assigned.id },
      data: { snapshot: "{}" },
    }),
  );
  assert.equal(JSON.parse(assigned.snapshot).title, resource.title);
  assert.ok(!assigned.snapshot.includes("PRIVATE_LIBRARY_NOTE"));
});
test("preview client-safe, human QA, immutable final version and unauthorized report denial", async () => {
  await admin({
    action: "SAVE_SUMMARY",
    summary: "Synthetic summary <script>alert(1)</script>",
    strengths: "Synthetic strength",
    priorityConcerns: "Synthetic priority",
    limitations: "Only synthetic intake reviewed; records not reviewed.",
  });
  const preview = await svc.reportResponse(request("admin"), aId, true, true);
  const html = await preview.text();
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("PRIVATE_"));
  assert.ok(html.includes(resource.title));
  await assert.rejects(async () => svc.reportResponse(request("buyer"), aId));
  await admin({
    action: "TRANSITION",
    status: "QA_REVIEW",
    reason: "QA_STARTED",
  });
  await svc.reportResponse(request("admin"), aId, true, true);
  await admin({
    action: "QA_APPROVE",
    previewReviewed: true,
    evidenceReviewed: true,
    recommendationsChecked: true,
    clientSafe: true,
  });
  const result = await admin({ action: "FINALIZE" });
  reportId = ("reportId" in result ? result.reportId : "") as string;
  assert.ok(reportId);
  await assert.rejects(async () =>
    prisma.readinessReportVersion.update({
      where: { id: reportId },
      data: { snapshot: "{}" },
    }),
  );
  await assert.rejects(async () =>
    prisma.readinessReportVersion.delete({ where: { id: reportId } }),
  );
  assert.equal((await current()).reportDeliveredAt, null);
  assert.equal(await prisma.readinessCredit.count(), 0);
  const a = await current();
  await assert.rejects(async () =>
    prisma.$transaction((tx) =>
      reports.deliver(tx, { ...a, version: a.version + 1 }, "admin", reportId),
    ),
  );
});
test("failed secure delivery and failed audit do not start clocks", async () => {
  const owner = (await current()).ownerUserId!;
  await prisma.user.update({
    where: { id: owner },
    data: { status: "INACTIVE" },
  });
  await assert.rejects(async () => admin({ action: "DELIVER", reportId }));
  await prisma.user.update({
    where: { id: owner },
    data: { status: "ACTIVE" },
  });
  sqlite.exec(
    "CREATE TRIGGER readiness_test_audit_failure BEFORE INSERT ON AuditLog WHEN NEW.resource='readiness' BEGIN SELECT RAISE(ABORT, 'SYNTHETIC_AUDIT_OUTAGE'); END;",
  );
  await assert.rejects(async () => admin({ action: "DELIVER", reportId }));
  sqlite.exec("DROP TRIGGER readiness_test_audit_failure");
  assert.equal((await current()).reportDeliveredAt, null);
  assert.equal(await prisma.readinessCredit.count(), 0);
  assert.equal(
    (
      await prisma.readinessReportVersion.findUniqueOrThrow({
        where: { id: reportId },
      })
    ).deliveryState,
    "PENDING",
  );
});
test("successful portal delivery atomically starts clocks; retries do not reset", async () => {
  await admin({ action: "DELIVER", reportId });
  const a = await current();
  const c = await prisma.readinessCredit.findUniqueOrThrow({
    where: { assessmentId: aId },
  });
  assert.equal(c.status, "ELIGIBLE_UNCLAIMED");
  assert.equal(
    c.claimDeadline.getTime() - a.reportDeliveredAt!.getTime(),
    14 * 86400000,
  );
  assert.equal(
    c.redeemDeadline.toISOString(),
    policy.addCalendarMonths(a.reportDeliveredAt!, 6).toISOString(),
  );
  assert.equal((await admin({ action: "DELIVER", reportId })).duplicate, true);
  assert.equal(
    (await current()).reportDeliveredAt?.getTime(),
    a.reportDeliveredAt?.getTime(),
  );
  const html = await (await svc.reportResponse(request("buyer"), aId)).text();
  assert.ok(html.includes("PK Readiness Report"));
  assert.ok(!html.includes("PRIVATE_"));
});
test("credit never auto approves, unrelated claim rejected, timely claim idempotent", async () => {
  await assert.rejects(async () =>
    portal({ action: "CLAIM_CREDIT", serviceId: "unrelated" }),
  );
  await portal({ action: "CLAIM_CREDIT", serviceId: "cleanup" });
  assert.equal(
    (await portal({ action: "CLAIM_CREDIT", serviceId: "cleanup" })).duplicate,
    true,
  );
  assert.equal(
    (
      await prisma.readinessCredit.findUniqueOrThrow({
        where: { assessmentId: aId },
      })
    ).status,
    "CLAIMED_PENDING_REVIEW",
  );
  await assert.rejects(async () =>
    admin({ action: "APPLY_CREDIT", invoiceId: "unknown" }),
  );
  await assert.rejects(async () =>
    admin({
      action: "DECIDE_CREDIT",
      approved: true,
      qualifyingServiceId: "outside",
      reason: "REPORT_RELATED_SERVICE",
    }),
  );
  await admin({
    action: "DECIDE_CREDIT",
    approved: true,
    qualifyingServiceId: "cleanup",
    reason: "REPORT_RELATED_SERVICE",
  });
});
test("credit invoice boundaries, capped partial application, exactly once no split", async () => {
  await prisma.client.create({
    data: { id: "other", name: "Synthetic Other" },
  });
  for (const [id, cid, sid, currency, status, amount] of [
    ["cross", "other", "cleanup", "USD", "SENT", 15000],
    ["unrelated", clientId, null, "USD", "SENT", 15000],
    ["foreign", clientId, "cleanup", "EUR", "SENT", 15000],
    ["draft", clientId, "cleanup", "USD", "DRAFT", 15000],
    ["qualifying", clientId, "cleanup", "USD", "SENT", 5000],
  ] as const) {
    await prisma.invoice.create({
      data: {
        id,
        invoiceNumber: id,
        clientId: cid,
        serviceId: sid,
        currency,
        status,
        amountCents: amount,
        description: "Synthetic",
      },
    });
  }
  for (const id of [
    "cross",
    "unrelated",
    "foreign",
    "draft",
    (await current()).invoiceId,
  ])
    await assert.rejects(async () =>
      admin({ action: "APPLY_CREDIT", invoiceId: id }),
    );
  const version = (await current()).version;
  const input = {
    action: "APPLY_CREDIT",
    invoiceId: "qualifying",
    expectedVersion: version,
  };
  await svc.adminMutation(request("admin"), aId, input);
  assert.equal(
    (await svc.adminMutation(request("admin"), aId, input)).duplicate,
    true,
  );
  const c = await prisma.readinessCredit.findUniqueOrThrow({
    where: { assessmentId: aId },
  });
  assert.equal(c.amountAppliedCents, 5000);
  assert.equal(c.status, "APPLIED");
  assert.equal(
    await prisma.payment.count({ where: { method: "READINESS_CREDIT" } }),
    1,
  );
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: "qualifying" } }))
      .status,
    "PAID",
  );
  await assert.rejects(async () =>
    admin({ action: "APPLY_CREDIT", invoiceId: "cross" }),
  );
});
test("calendar-month deadlines clamp month end and leap years", () => {
  assert.equal(
    policy.addCalendarMonths(new Date("2026-08-31T12:00:00Z"), 6).toISOString(),
    "2027-02-28T12:00:00.000Z",
  );
  assert.equal(
    policy.addCalendarMonths(new Date("2023-08-31T12:00:00Z"), 6).toISOString(),
    "2024-02-29T12:00:00.000Z",
  );
  assert.equal(
    policy.addBusinessDays(new Date("2026-10-09T12:00:00Z"), 3).toISOString(),
    "2026-10-14T12:00:00.000Z",
  );
});
test("analytics stores controlled event only; rejects sensitive details", async () => {
  const dedupeKey = randomUUID();
  const data = { event: "gut_check_interaction", dedupeKey };
  assert.equal(
    (await analyticsRoute.POST(request("", "/api/readiness/analytics", data)))
      .status,
    200,
  );
  assert.equal(
    (await analyticsRoute.POST(request("", "/api/readiness/analytics", data)))
      .status,
    200,
  );
  assert.equal(
    (
      await analyticsRoute.POST(
        request("", "/api/readiness/analytics", {
          ...data,
          answers: ["sensitive"],
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    await prisma.readinessAnalyticsEvent.count({
      where: { event: "gut_check_interaction" },
    }),
    1,
  );
  const events = await prisma.readinessAnalyticsEvent.findMany();
  assert.ok(!JSON.stringify(events).includes("buyer@example.test"));
});
test("notifications deduplicated and content-free; dispatch retry-safe locally", async () => {
  const sent = await notices.dispatchNotices(50);
  assert.ok(sent.sent > 0);
  assert.equal(sent.failed, 0);
  assert.equal((await notices.dispatchNotices(50)).sent, 0);
  for (const n of await prisma.notification.findMany()) {
    assert.ok(!n.body.includes("PRIVATE_"));
    assert.ok(!n.body.includes("Synthetic summary"));
  }
  assert.equal(
    await prisma.notification.count({
      where: { dedupeKey: `READINESS_PORTAL:${aId}:report:1`, status: "SENT" },
    }),
    1,
  );
});
test("notification failure is isolated, retry scheduled, and retry publishes once", async () => {
  const n = await prisma.notification.create({
    data: {
      channel: "EMAIL",
      subject: "PK update",
      body: "Content-free synthetic notice",
      dedupeKey: "READINESS_EMAIL:synthetic-failure",
      metadata: JSON.stringify({ assessmentId: "missing" }),
    },
  });
  assert.equal((await notices.dispatchNotices()).failed, 1);
  const failed = await prisma.notification.findUniqueOrThrow({
    where: { id: n.id },
  });
  assert.equal(failed.status, "FAILED");
  assert.ok(failed.nextAttemptAt);
  assert.equal((await notices.dispatchNotices()).sent, 0);
  await prisma.notification.update({
    where: { id: n.id },
    data: {
      metadata: JSON.stringify({ assessmentId: aId }),
      nextAttemptAt: new Date(0),
    },
  });
  assert.equal((await notices.dispatchNotices()).sent, 1);
  assert.equal((await notices.dispatchNotices()).sent, 0);
});
test("editing library after delivery cannot rewrite frozen report bytes", async () => {
  const before = await prisma.readinessReportVersion.findUniqueOrThrow({
    where: { id: reportId },
  });
  await library.mutateLibrary(request("admin"), {
    action: "UPDATE",
    id: entryId,
    expectedVersion: 3,
    entry: {
      ...resource,
      title: "Post-delivery changed resource",
      active: false,
      archived: true,
    },
  });
  const after = await prisma.readinessReportVersion.findUniqueOrThrow({
    where: { id: reportId },
  });
  assert.equal(after.snapshot, before.snapshot);
  assert.equal(after.digest, before.digest);
  assert.ok(
    (await (await svc.reportResponse(request("buyer"), aId)).text()).includes(
      resource.title,
    ),
  );
});
test("expired claim and redemption persist expiry; no late application", async () => {
  const c = await prisma.readinessCredit.findUniqueOrThrow({
    where: { assessmentId: aId },
  });
  await prisma.readinessCredit.update({
    where: { id: c.id },
    data: {
      status: "ELIGIBLE_UNCLAIMED",
      claimDeadline: new Date(Date.now() - 1),
    },
  });
  await assert.rejects(async () =>
    portal({ action: "CLAIM_CREDIT", serviceId: "cleanup" }),
  );
  assert.equal(
    (await prisma.readinessCredit.findUniqueOrThrow({ where: { id: c.id } }))
      .status,
    "EXPIRED",
  );
  await prisma.readinessCredit.update({
    where: { id: c.id },
    data: {
      status: "APPROVED_AVAILABLE",
      redeemDeadline: new Date(Date.now() - 1),
    },
  });
  await assert.rejects(async () =>
    admin({ action: "APPLY_CREDIT", invoiceId: "qualifying" }),
  );
  assert.equal(
    (await prisma.readinessCredit.findUniqueOrThrow({ where: { id: c.id } }))
      .status,
    "EXPIRED",
  );
  await prisma.readinessCredit.update({
    where: { id: c.id },
    data: {
      status: "APPLIED",
      claimDeadline: policy.creditDeadlines(
        (await current()).reportDeliveredAt!,
      ).claimDeadline,
      redeemDeadline: policy.creditDeadlines(
        (await current()).reportDeliveredAt!,
      ).redeemDeadline,
    },
  });
});
test("factual correction invalidates QA, freezes new version and preserves clocks", async () => {
  const delivered = (await current()).reportDeliveredAt!.getTime();
  await admin({
    action: "REOPEN_CORRECTION",
    reason: "VERIFIED_FACTUAL_ERROR",
  });
  await assert.rejects(async () => admin({ action: "FINALIZE" }));
  await admin({
    action: "SAVE_SUMMARY",
    summary: "Corrected synthetic fact",
    strengths: "Synthetic strength",
    priorityConcerns: "Synthetic priority",
    limitations: "Synthetic records only",
  });
  await admin({
    action: "TRANSITION",
    status: "QA_REVIEW",
    reason: "QA_STARTED",
  });
  await svc.reportResponse(request("admin"), aId, true, true);
  await admin({
    action: "QA_APPROVE",
    previewReviewed: true,
    evidenceReviewed: true,
    recommendationsChecked: true,
    clientSafe: true,
  });
  const result = await admin({ action: "FINALIZE" });
  const id = ("reportId" in result ? result.reportId : "") as string;
  await admin({ action: "DELIVER", reportId: id });
  assert.equal((await current()).reportDeliveredAt!.getTime(), delivered);
  assert.equal(
    await prisma.readinessReportVersion.count({ where: { assessmentId: aId } }),
    2,
  );
  assert.equal(
    (
      await prisma.readinessCredit.findUniqueOrThrow({
        where: { assessmentId: aId },
      })
    ).status,
    "APPLIED",
  );
});
test("provider refunds reconcile without initiating charges/refunds or deleting history", async () => {
  const p = await prisma.payment.findFirstOrThrow({
    where: { method: "STRIPE" },
  });
  const charge = {
    object: "charge",
    payment_intent: p.providerReference,
    amount: 9900,
    amount_refunded: 9900,
    currency: "usd",
  };
  await prisma.$transaction((tx) => purchase.recordRefund(tx, charge));
  assert.equal((await current()).status, "REFUNDED");
  assert.equal(
    (await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status,
    "REFUNDED",
  );
  assert.equal(
    (await prisma.$transaction((tx) => purchase.recordRefund(tx, charge)))
      .duplicate,
    true,
  );
  assert.equal(await prisma.readinessReportVersion.count(), 2);
  assert.equal(
    (
      await prisma.readinessCredit.findUniqueOrThrow({
        where: { assessmentId: aId },
      })
    ).status,
    "APPLIED",
  );
  await assert.rejects(async () => admin({ action: "REMIND" }));
});
test("revoked security version denies stale session and tenant queue excludes others", async () => {
  const result = await svc.queue(request("admin"), true);
  assert.equal(result.count, 1);
  await prisma.user.update({
    where: { id: "admin" },
    data: { securityVersion: { increment: 1 } },
  });
  await assert.rejects(async () => svc.detail(request("admin"), aId, true));
  assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
});
