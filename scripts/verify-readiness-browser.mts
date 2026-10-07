import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import Database from "better-sqlite3";
import { chromium } from "@playwright/test";
const root = mkdtempSync(join(tmpdir(), "pk-readiness-browser-"));
const origin = "http://localhost:4333";
for (const key of [
  "NETLIFY",
  "CONTEXT",
  "VERCEL",
  "VERCEL_ENV",
  "DATABASE_AUTH_TOKEN",
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
])
  delete process.env[key];
Object.assign(process.env, {
  NODE_ENV: "test",
  PK_ENVIRONMENT: "test",
  PK_AUTH_ENVIRONMENT: "test",
  AUTH_SECRET: "readiness-browser-synthetic-only",
  PK_ALLOW_SYNTHETIC_SETUP: "true",
  PK_READINESS_ENABLED: "true",
  PK_READINESS_MAIL_MODE: "synthetic",
  PK_STRIPE_ENVIRONMENT: "test",
  STRIPE_SECRET_KEY: "sk_test_synthetic_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_synthetic_fixture",
  DATABASE_URL: `file:${join(root, "test.db")}`,
  PK_READINESS_BROWSER_TEST: "true",
});
const db = new Database(join(root, "test.db"));
db.exec(
  execFileSync(
    "npx",
    [
      "prisma",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema",
      "prisma/schema.prisma",
      "--script",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  ),
);
const sql = readFileSync(
  "prisma/readiness-migrations/readiness-v1.sql",
  "utf8",
);
db.exec(sql.slice(sql.indexOf("-- Domain evidence")));
const { prisma } = await import("../src/lib/prisma");
const auth = await import("../src/lib/auth");
for (const [id, role] of [
  ["browserbuyer", "CLIENT"],
  ["browseradmin", "ADMIN"],
] as const)
  await prisma.user.create({
    data: {
      id,
      role,
      email: id + "@example.test",
      name: "Synthetic Browser User",
      passwordHash: await auth.hashPassword("SyntheticPassword123!"),
    },
  });
const buyerToken = await auth.createSession("browserbuyer");
const adminToken = await auth.createSession("browseradmin", "WEBAUTHN");
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
const logPath = join(root, "server.log");
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", "4333"],
  {
    env: {
      ...process.env,
      NODE_ENV: "development",
      NODE_OPTIONS: `--import ${resolve("scripts/readiness-synthetic-preload.mjs")}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.stdout.on("data", (d) => (logs += d));
child.stderr.on("data", (d) => (logs += d));
const browser = await chromium.launch({ headless: true });
mkdirSync("docs/readiness/evidence", { recursive: true });
try {
  for (let n = 0; n < 120; n++) {
    try {
      const r = await fetch(origin + "/api/readiness/status");
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
    if (n === 119) throw Error("Server did not start");
  }
  const buyer = await browser.newContext({
    viewport: { width: 375, height: 900 },
  });
  const page = await buyer.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/readiness");
  await page.locator("[data-open-start]").first().click();
  await page.locator("#pk-name").waitFor({ state: "visible" });
  await page.locator("#pk-name").fill("Synthetic Browser Buyer");
  await page.locator("#pk-email").fill("browserbuyer@example.test");
  await page.locator("#pk-type").selectOption("FREELANCER");
  await page.locator("#pk-books").selectOption("BEHIND");
  await page.locator("#pk-worry").selectOption("BOOKS");
  await page.locator("#pk-consent").check();
  await page
    .getByRole("button", { name: "Continue to checkout — $99" })
    .click();
  await page.waitForURL(origin + "/readiness/start");
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Synthetic Checkout</title><p>Synthetic provider: no real charge.</p>",
    }),
  );
  await page
    .getByRole("button", { name: "Continue secure $99 checkout" })
    .click();
  await page.waitForURL("https://checkout.stripe.com/**");
  const a = await prisma.readinessAssessment.findFirstOrThrow();
  assert.equal(a.paymentStatus, "PENDING");
  await page.goto(origin + "/readiness/start?checkout=success");
  await page.getByText("Your assessment is saved.").waitFor();
  assert.equal(
    (
      await prisma.readinessAssessment.findUniqueOrThrow({
        where: { id: a.id },
      })
    ).paymentStatus,
    "PENDING",
  );
  const session = {
    id: a.stripeSessionId,
    object: "checkout.session",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    livemode: false,
    amount_total: 9900,
    currency: "usd",
    client_reference_id: a.id,
    metadata: { readinessAssessmentId: a.id },
    payment_intent: "pi_test_synthetic_browser",
  };
  const payload = JSON.stringify({
    id: "evt_synthetic_browser",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: session },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = `t=${timestamp},v1=${createHmac(
    "sha256",
    process.env.STRIPE_WEBHOOK_SECRET!,
  )
    .update(timestamp + "." + payload)
    .digest("hex")}`;
  assert.equal(
    (
      await buyer.request.post(origin + "/api/stripe/webhook", {
        headers: { "stripe-signature": signature },
        data: payload,
      })
    ).status(),
    200,
  );
  assert.equal(
    (
      await buyer.request.post(origin + "/api/stripe/webhook", {
        headers: { "stripe-signature": signature },
        data: payload,
      })
    ).status(),
    200,
  );
  await buyer.addCookies([
    {
      name: "pk_business_session",
      value: buyerToken,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.reload();
  await page
    .getByRole("button", { name: "Connect my signed-in PK account" })
    .click();
  await page.waitForURL(origin + "/portal/readiness/" + a.id);
  await page
    .getByLabel("Business or professional name")
    .fill("Synthetic Browser Business");
  await page.locator('[name="reviewPeriod"]').fill("2026-09");
  for (const [name, value] of Object.entries({
    bookkeepingSystem: "SPREADSHEET",
    bookkeepingStatus: "BEHIND",
    reconciliationStatus: "PARTIAL",
    incomeExpenseOrganization: "PARTIAL",
    recordsStatus: "SCATTERED",
    taxPreparationStatus: "NOT_STARTED",
    priority: "BOOKS",
  }))
    await page.locator(`[name="${name}"]`).selectOption(value);
  await page.getByLabel("CLIENTS", { exact: true }).check();
  await page.getByRole("button", { name: "Save completed intake" }).click();
  await page.getByText("READY TO SUBMIT", { exact: false }).waitFor();
  await page.getByLabel("I understand that once I submit").check();
  await page
    .getByRole("button", { name: "Submit my Assessment for PK review" })
    .click();
  await page.getByText("SUBMITTED FOR REVIEW", { exact: false }).waitFor();
  await page.screenshot({
    path: "docs/readiness/evidence/client-submitted-375.png",
    fullPage: true,
  });
  for (const capability of [
    "confidential_access",
    "readiness_read",
    "readiness_review",
    "readiness_qa",
    "readiness_credit",
    "payments",
  ])
    await prisma.capabilityGrant.create({
      data: {
        userId: "browseradmin",
        capability,
        scope: "CLIENT",
        clientId: a.clientId,
      },
    });
  for (const capability of [
    "readiness_library_read",
    "readiness_library_write",
  ])
    await prisma.capabilityGrant.create({
      data: {
        userId: "browseradmin",
        capability,
        scope: "GLOBAL",
        clientId: "",
      },
    });
  await prisma.session.updateMany({
    where: { userId: "browseradmin" },
    data: {
      activeClientId: a.clientId,
      passwordVerifiedAt: new Date(),
      mfaVerifiedAt: new Date(),
    },
  });
  const staff = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await staff.addCookies([
    {
      name: "pk_business_session",
      value: adminToken,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const review = await staff.newPage();
  review.on("pageerror", (e) => errors.push(e.message));
  await review.goto(origin + "/admin/readiness/" + a.id);
  await review
    .getByRole("heading", { name: "Six-area fulfillment rubric" })
    .waitFor();
  const mutation = async (data: object) => {
    const latest = await prisma.readinessAssessment.findUniqueOrThrow({
      where: { id: a.id },
    });
    const r = await staff.request.post(
      origin + "/api/admin/readiness/" + a.id,
      {
        headers: { origin, "x-pk-client-context": a.clientId },
        data: { expectedVersion: latest.version, ...data },
      },
    );
    assert.equal(r.status(), 200, JSON.stringify(await r.json()));
    return r.json();
  };
  await mutation({
    action: "TRANSITION",
    status: "IN_REVIEW",
    reason: "REVIEW_READY",
  });
  await review.reload();
  await review
    .getByRole("button", { name: "Add finding for Books", exact: true })
    .click();
  for (const [name, value] of Object.entries({
    finding: "Synthetic browser finding",
    evidenceBasis: "Synthetic intake only",
    whyItMatters: "Clarity matters",
    recommendedAction: "Bookkeeping cleanup",
    internalNotes: "PRIVATE_BROWSER_NOTE",
  }))
    await review.locator(`[name="${name}"]`).first().fill(value);
  await review
    .locator('[name="status"]')
    .last()
    .selectOption("CLEANUP_RECOMMENDED");
  await review.locator('[name="disposition"]').selectOption("PK_CAN_HELP");
  await review
    .locator('[name="qualifyingServiceId"]')
    .first()
    .selectOption("cleanup");
  await review
    .getByRole("button", { name: "Save finding", exact: true })
    .click();
  await review
    .getByText("Synthetic browser finding", { exact: true })
    .waitFor();
  const { AREAS } = await import("../src/lib/readiness/policy");
  for (const area of AREAS.filter((x) => x !== "BOOKS"))
    await mutation({
      action: "SAVE_FINDING",
      finding: {
        area,
        status: "INSUFFICIENT_INFORMATION",
        finding: "Synthetic " + area,
        evidenceBasis: "Synthetic intake only",
        whyItMatters: "Additional review needed",
        recommendedAction: "Organize records",
        priority: "MEDIUM",
        disposition:
          area === "TAX_SEASON"
            ? "OUTSIDE_HELP_RECOMMENDED"
            : "YOU_CAN_HANDLE_THIS",
        internalNotes: "PRIVATE_BROWSER_NOTE",
      },
    });
  const finding = await prisma.readinessFinding.findFirstOrThrow({
    where: { assessmentId: a.id, area: "TAX_SEASON" },
  });
  await mutation({
    action: "ASSIGN_RECOMMENDATION",
    findingId: finding.id,
    wording: {
      title: "Synthetic independent resource",
      category: "Tax season",
      recommendationType: "PROFESSIONAL_TYPE",
      clientFacingDescription:
        "Consult an independent qualified tax professional.",
      whyOrWhenToUse: "A need outside assessment scope.",
      clientNextStep: "Confirm qualifications and scope.",
    },
    saveToLibrary: true,
  });
  await mutation({
    action: "SAVE_SUMMARY",
    summary: "Synthetic readiness report summary",
    strengths: "Synthetic strengths",
    priorityConcerns: "Synthetic priority concerns",
    limitations: "Synthetic intake only; no real taxpayer documents reviewed.",
  });
  await mutation({
    action: "TRANSITION",
    status: "QA_REVIEW",
    reason: "QA_STARTED",
  });
  await review.reload();
  await review
    .getByRole("button", { name: "Preview current client report" })
    .click();
  await review.frameLocator("iframe").getByRole("heading", { name: "PK Readiness Report", exact: true }).waitFor();
  await review.screenshot({
    path: "docs/readiness/evidence/admin-preview-1440.png",
    fullPage: true,
  });
  for (const label of [
    "I reviewed the report preview.",
    "All six areas and evidence limitations have been reviewed.",
    "Recommendation dispositions, provider relationships and qualifying PK services are accurate.",
    "No internal notes or raw confidential document contents appear in the client report.",
  ])
    await review.getByLabel(label, { exact: false }).check();
  await review
    .getByRole("button", { name: "Approve this draft for finalization" })
    .click();
  await review
    .getByRole("button", { name: "Freeze final report version" })
    .click();
  await review
    .getByRole("button", { name: "Deliver to secure client portal" })
    .first()
    .click();
  await review.getByText("DELIVERED", { exact: false }).first().waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "View report version" })
    .first()
    .click();
  await page.frameLocator("iframe").getByRole("heading", { name: "PK Readiness Report", exact: true }).waitFor();
  assert.ok(
    !(await page.locator("iframe").getAttribute("srcdoc"))?.includes(
      "PRIVATE_",
    ),
  );
  await page
    .getByRole("button", { name: "Express interest & claim for PK review" })
    .click();
  await page.getByText("CLAIMED PENDING REVIEW", { exact: false }).waitFor();
  await page.screenshot({
    path: "docs/readiness/evidence/client-report-credit-375.png",
    fullPage: true,
  });
  await mutation({
    action: "DECIDE_CREDIT",
    approved: true,
    qualifyingServiceId: "cleanup",
    reason: "REPORT_RELATED_SERVICE",
  });
  await prisma.invoice.create({
    data: {
      id: "browser-invoice",
      invoiceNumber: "SYNTHETIC-BROWSER",
      clientId: a.clientId,
      serviceId: "cleanup",
      amountCents: 15000,
      currency: "USD",
      status: "SENT",
      description: "Synthetic qualifying service",
    },
  });
  await mutation({ action: "APPLY_CREDIT", invoiceId: "browser-invoice" });
  assert.equal(
    (
      await prisma.readinessCredit.findUniqueOrThrow({
        where: { assessmentId: a.id },
      })
    ).amountAppliedCents,
    9900,
  );
  const remainder = await staff.request.post(
    origin + "/api/admin/invoices/browser-invoice/actions",
    {
      headers: { origin },
      data: {
        action: "record-payment",
        amountCents: 5100,
        method: "MANUAL",
        notes: "Synthetic remaining balance only; no real payment",
      },
    },
  );
  assert.equal(remainder.status(), 200, JSON.stringify(await remainder.json()));
  assert.equal(
    (
      await prisma.invoice.findUniqueOrThrow({
        where: { id: "browser-invoice" },
      })
    ).status,
    "PAID",
  );
  assert.equal(await prisma.readinessAssessment.count(), 1);
  assert.equal(await prisma.payment.count({ where: { method: "STRIPE" } }), 1);
  assert.deepEqual(errors, []);
  assert.equal(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
    0,
  );
  console.log(
    "PASS real local HTTP/browser lifecycle: Arena CTA → preliminary intake → synthetic checkout → signed webhook twice → existing account binding → intake + canonical submission → scoped Admin finding editor → preview + human QA → immutable final → secure portal delivery → timely credit claim → approval → $99 qualifying invoice credit. Mobile and desktop screenshots saved. No real charge or external transport.",
  );
} finally {
  writeFileSync(logPath, logs);
  if (process.env.READINESS_KEEP_BROWSER_FIXTURE === "true")
    console.log("Synthetic fixture retained: " + root);
  await browser.close();
  child.kill("SIGTERM");
  await prisma.$disconnect();
  db.close();
  if (process.env.READINESS_KEEP_BROWSER_FIXTURE !== "true")
    rmSync(root, { recursive: true, force: true });
}
