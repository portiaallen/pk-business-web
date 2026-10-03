// Synthetic-only WebAuthn/browser acceptance. Uses Chromium's virtual platform authenticator, not real hardware.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, createWriteStream, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// Disable every external transport even if the workspace has local environment files.
for (const key of [
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "PK_EMAIL_ENVIRONMENT",
  "PK_STORAGE_ENVIRONMENT",
])
  process.env[key] = "";
const directory = mkdtempSync(join(tmpdir(), "pk-phase1b-browser-synthetic-"));
const database = join(directory, "synthetic.db");
const port = 4341,
  origin = `http://localhost:${port}`;
Object.assign(process.env, {
  PK_ENVIRONMENT: "test",
  PK_AUTH_ENVIRONMENT: "test",
  AUTH_SECRET: "synthetic-browser-only-secret",
  DATABASE_URL: `file:${database}`,
  PK_WEBAUTHN_ORIGIN: origin,
});
const sql = execFileSync(
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
);
const sqlite = new Database(database);
sqlite.exec(sql);
sqlite.close();
const { prisma } = await import("../src/lib/prisma");
const { hashPassword, hashToken } = await import("../src/lib/auth");
const password = "Synthetic-browser-test-Only-123!";
const userId = "synthetic-platform-user";
await prisma.user.create({
  data: {
    id: userId,
    email: "platform@example.test",
    name: "Synthetic Platform User",
    passwordHash: await hashPassword(password),
    role: "ADMIN",
    mfaEnrollmentAllowed: true,
    mfaEnrollmentExpiresAt: new Date(Date.now() + 900000),
  },
});
await prisma.client.create({
  data: { id: "synthetic-client", name: "Synthetic Business" },
});
for (const capability of [
  "security",
  "permissions",
  "assignments",
  "consultations",
])
  await prisma.capabilityGrant.create({
    data: { userId, capability, scope: "GLOBAL" },
  });
for (const capability of [
  "confidential_access",
  "bookkeeping",
  "qa",
  "payments",
])
  await prisma.capabilityGrant.create({
    data: { userId, capability, scope: "CLIENT", clientId: "synthetic-client" },
  });
await prisma.service.create({
  data: {
    id: "synthetic-service",
    slug: "quickbooks-cleanup",
    name: "Synthetic Cleanup",
    shortName: "Cleanup",
    description: "Synthetic",
    shortDescription: "Synthetic",
    priceDisplay: "$1",
    priceCents: 100,
  },
});
await prisma.verificationRequest.create({
  data: {
    id: "synthetic-engagement",
    clientId: "synthetic-client",
    serviceId: "synthetic-service",
    requestType: "QuickBooks Cleanup",
    status: "SUBMITTED",
    assignedStaffId: userId,
  },
});
const log = createWriteStream(join(directory, "server.log"));
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", String(port)],
  {
    env: { ...process.env, NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stdout?.pipe(log);
server.stderr?.pipe(log);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const results: string[] = [];
const check = (name: string) => results.push(name);
try {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${origin}/portal/login`)).ok) break;
    } catch {}
    if (i === 119) throw new Error("Synthetic server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }
  browser = await chromium.launch({
    executablePath: process.env.PK_TEST_CHROMIUM || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ hasTouch: true });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", () => errors.push("pageerror"));
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  let virtualAuthenticator = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  async function signIn(enroll = false) {
    await page.goto(`${origin}/portal/login?admin=1`);
    await page
      .getByLabel("Email", { exact: true })
      .fill("platform@example.test");
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await page
      .getByRole("button", {
        name: enroll ? "Create a passkey" : "Verify with a passkey",
        exact: true,
      })
      .tap();
    await page.waitForURL(`${origin}/security`);
    await page.getByRole("heading", { name: "Your authenticators" }).waitFor();
  }
  await signIn(true);
  check("platform passkey enrollment establishes MFA session without hardware");
  assert.equal(await prisma.webAuthnCredential.count({ where: { userId } }), 1);
  check("credential public material persisted");
  await page
    .getByLabel("Choose the client you intend to work with")
    .selectOption("synthetic-client");
  await page
    .getByRole("button", { name: "Use this client", exact: true })
    .click();
  await page.getByText("Client selected.", { exact: true }).waitFor();
  check("touch-compatible explicit client selection");
  const requests = await page.request.get(`${origin}/api/admin/requests`);
  assert.equal(requests.status(), 200);
  assert.equal((await requests.json()).length, 1);
  check("authorized bookkeeping engagement list");
  const unscoped = await page.request.get(
    `${origin}/api/admin/requests/missing`,
  );
  assert.equal(unscoped.status(), 404);
  check("unknown engagement denied");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Verify password and passkey", exact: true })
    .click();
  await page.getByText(/Password and passkey verified/).waitFor();
  check("step-up with password and platform passkey");
  await cdp.send("WebAuthn.removeVirtualAuthenticator", {
    authenticatorId: virtualAuthenticator.authenticatorId,
  });
  virtualAuthenticator = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page
    .getByLabel("Name for a new authenticator")
    .fill("Synthetic second credential");
  await page
    .getByRole("button", {
      name: "Add a passkey or authenticator",
      exact: true,
    })
    .click();
  await page.getByText("Authenticator added.", { exact: true }).waitFor();
  assert.equal(await prisma.webAuthnCredential.count({ where: { userId } }), 2);
  check("multiple credentials without replacement");
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.waitForFunction(() => window.scrollY === 0);
    const targetSizes = await page
      .locator("#main-content button")
      .evaluateAll((buttons) =>
        buttons
          .filter((b) => !b.hasAttribute("disabled"))
          .map((b) => b.getBoundingClientRect().height),
      );
    assert.ok(targetSizes.every((height) => height >= 44));
    check(`security touch targets ${width}`);
    await page.screenshot({
      path: join(directory, `security-${width}.png`),
      fullPage: true,
    });
    check(`security responsive ${width}`);
    const accessibility = await new AxeBuilder({ page })
      .include("#main-content")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    assert.equal(
      accessibility.violations.length,
      0,
      accessibility.violations.map((v) => v.id).join(","),
    );
    check(`security accessibility ${width}`);
    await page.goto(`${origin}/portal/login?admin=1`);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    check(`login responsive ${width}`);
    await page.goto(`${origin}/admin/dashboard`);
    await page.getByText("Client context:", { exact: true }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    check(`staff context banner responsive ${width}`);
    await page.goto(`${origin}/security`);
    await page.getByRole("heading", { name: "Your authenticators" }).waitFor();
  }
  await prisma.user.create({
    data: {
      id: "synthetic-client-user",
      email: "client-browser@example.test",
      name: "Synthetic Client User",
      passwordHash: await hashPassword(password),
      role: "CLIENT",
    },
  });
  await prisma.client.create({
    data: { id: "synthetic-alternate-client", name: "Synthetic Alternate" },
  });
  for (const clientId of ["synthetic-client", "synthetic-alternate-client"])
    await prisma.clientMember.create({
      data: { userId: "synthetic-client-user", clientId, role: "OWNER" },
    });
  const clientContext = await browser.newContext({ hasTouch: true });
  const clientPage = await clientContext.newPage();
  clientPage.on("pageerror", () => errors.push("client pageerror"));
  await clientPage.goto(`${origin}/portal/login`);
  await clientPage
    .getByLabel("Email", { exact: true })
    .fill("client-browser@example.test");
  await clientPage.getByLabel("Password", { exact: true }).fill(password);
  await clientPage.getByRole("button", { name: "Sign In", exact: true }).tap();
  await clientPage
    .getByRole("heading", { name: "Choose your client context", exact: true })
    .waitFor();
  check("client password login and ambiguous context prompt");
  await clientPage
    .getByRole("link", { name: "Choose a client", exact: true })
    .tap();
  await clientPage
    .getByLabel("Choose the client you intend to work with")
    .selectOption("synthetic-client");
  await clientPage
    .getByRole("button", { name: "Use this client", exact: true })
    .tap();
  await clientPage.getByText("Client selected.", { exact: true }).waitFor();
  check("client touch context selection");
  for (const width of [390, 768, 1440]) {
    await clientPage.setViewportSize({ width, height: 900 });
    await clientPage.goto(`${origin}/portal/requests/new`);
    await clientPage
      .getByRole("heading", { name: "New Service Request", exact: true })
      .waitFor();
    assert.equal(
      await clientPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    check(`client request responsive ${width}`);
  }
  await clientPage.locator("#service").selectOption("quickbooks-cleanup");
  await clientPage.locator("#description").fill("Synthetic request only");
  await clientPage
    .getByRole("button", { name: "Submit Request", exact: true })
    .tap();
  await clientPage.waitForURL(url => url.pathname.startsWith("/portal/requests/") && url.pathname !== "/portal/requests/new");
  assert.equal(
    await prisma.verificationRequest.count({
      where: {
        clientId: "synthetic-client",
        clientNotes: "Synthetic request only",
      },
    }),
    1,
  );
  check("client request submission binds displayed context");
  await clientPage.goto(`${origin}/portal/team`);
  await clientPage
    .getByRole("button", { name: "Invite member", exact: true })
    .waitFor();
  check("owner membership controls use actual membership role");
  await clientContext.close();
  await page
    .getByRole("button", { name: "Generate new recovery codes", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Save these codes securely" })
    .waitFor();
  const codes = await page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Save these codes securely" }),
    })
    .locator("li")
    .allTextContents();
  assert.equal(codes.length, 10);
  assert.equal(
    (await page.request.get(`${origin}/api/auth/session`)).status(),
    401,
  );
  check("recovery generation signs out all sessions");
  await page.goto(`${origin}/portal/login?admin=1`);
  await page.getByLabel("Email", { exact: true }).fill("platform@example.test");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await page
    .getByLabel("Lost access? Enter a single-use recovery code")
    .fill(codes[0]);
  await page
    .getByRole("button", {
      name: "Recover and register a passkey",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Create a passkey", exact: true })
    .waitFor();
  assert.equal(
    (await page.request.get(`${origin}/api/auth/session`)).status(),
    401,
  );
  check("recovery provides no privileged session before new authenticator");
  await cdp.send("WebAuthn.removeVirtualAuthenticator", {
    authenticatorId: virtualAuthenticator.authenticatorId,
  });
  virtualAuthenticator = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  await page
    .getByRole("button", { name: "Create a passkey", exact: true })
    .click();
  await page.waitForURL(`${origin}/security`);
  check("recovery requires and accepts new platform passkey");
  await page.getByRole("heading", { name: "Your authenticators" }).waitFor();
  // Obtain a valid cryptographic assertion then verify that exactly one use succeeds.
  const loginResponse = await page.request.post(`${origin}/api/auth/login`, {
    headers: { Origin: origin },
    data: { email: "platform@example.test", password },
  });
  const challenge = await loginResponse.json();
  await page.evaluate("window.__name = (fn) => fn");
  const assertion = await page.evaluate(async (options) => {
    const decode = (s: string) =>
      Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) =>
        c.charCodeAt(0),
      );
    const encode = (b: ArrayBuffer) =>
      btoa(String.fromCharCode(...new Uint8Array(b)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const credential = (await navigator.credentials.get({
      publicKey: {
        ...options,
        challenge: decode(options.challenge),
        allowCredentials: options.allowCredentials.map((c: { id: string }) => ({
          ...c,
          id: decode(c.id),
        })),
      },
    })) as PublicKeyCredential;
    const r = credential.response as AuthenticatorAssertionResponse;
    return {
      id: credential.id,
      rawId: encode(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: encode(r.clientDataJSON),
        authenticatorData: encode(r.authenticatorData),
        signature: encode(r.signature),
        userHandle: r.userHandle ? encode(r.userHandle) : undefined,
      },
    };
  }, challenge.options);
  const first = await page.request.post(`${origin}/api/auth/webauthn`, {
    headers: { Origin: origin },
    data: { action: "verify", ticket: challenge.ticket, response: assertion },
  });
  assert.equal(first.status(), 200);
  const replay = await page.request.post(`${origin}/api/auth/webauthn`, {
    headers: { Origin: origin },
    data: { action: "verify", ticket: challenge.ticket, response: assertion },
  });
  assert.equal(replay.status(), 401);
  check("real signed WebAuthn challenge replay denied");
  await prisma.securityChallenge.updateMany({
    where: { tokenHash: hashToken(challenge.ticket) },
    data: { expiresAt: new Date(0), consumedAt: null },
  });
  const expired = await page.request.post(`${origin}/api/auth/webauthn`, {
    headers: { Origin: origin },
    data: { action: "verify", ticket: challenge.ticket, response: assertion },
  });
  assert.equal(expired.status(), 401);
  check("expired cryptographic challenge denied");
  const reuseLogin = await page.request.post(`${origin}/api/auth/login`, {
    headers: { Origin: origin },
    data: { email: "platform@example.test", password },
  });
  const reuse = await reuseLogin.json();
  assert.equal(
    (
      await page.request.post(`${origin}/api/auth/webauthn`, {
        headers: { Origin: origin },
        data: { action: "recover", ticket: reuse.ticket, code: codes[0] },
      })
    ).status(),
    401,
  );
  check("recovery-code replay denied");
  const contact = await page.request.post(`${origin}/api/contact`, {
    headers: { Origin: origin },
    data: {
      fullName: "Synthetic Prospect",
      email: "prospect@example.test",
      service: "not-sure",
      description: "Synthetic test only",
      contactMethod: "email",
    },
  });
  assert.equal(contact.status(), 200);
  check("consultation persistence regression");
  assert.equal(await prisma.intakeSubmission.count(), 1);
  const secureResponse = await page.request.get(`${origin}/api/auth/security`);
  assert.ok(secureResponse.headers()["cache-control"]?.includes("no-store"));
  check("security response denies browser caching");
  assert.equal(errors.length, 0);
  check("no browser page errors");
  writeFileSync(
    join(directory, "results.json"),
    JSON.stringify(
      {
        checks: results,
        deviceStatus:
          "Samsung hardware NOT VERIFIED; virtual Chromium platform authenticator only",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      passed: results.length,
      checks: results,
      artifactDirectory: directory,
    }),
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    if (server.exitCode !== null) resolve();
    else server.once("exit", () => resolve());
  });
  log.end();
  await prisma.$disconnect();
  // Keep only synthetic screenshots/results; no persistent synthetic credential database.
  rmSync(database, { force: true });
  rmSync(`${database}-journal`, { force: true });
}
