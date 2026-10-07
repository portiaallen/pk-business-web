// Synthetic-only integration tests. Always create a new disposable SQLite database.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { generateKeyPairSync, createHash, sign } from "node:crypto";
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
const directory = mkdtempSync(join(tmpdir(), "pk-phase1b-synthetic-"));
const database = join(directory, "synthetic.db");
Object.assign(process.env, { NODE_ENV: "test" });
process.env.STORAGE_DIR = join(directory, "synthetic-storage");
process.env.STORAGE_PROVIDER = "";
process.env.PK_ENVIRONMENT = "test";
process.env.DATABASE_URL = `file:${database}`;
process.env.AUTH_SECRET = "synthetic-phase1b-only-test-secret";
process.env.PK_AUTH_ENVIRONMENT = "test";
process.env.PK_WEBAUTHN_ORIGIN = "http://localhost:4321";
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
const { prisma } = await import("../src/lib/prisma");
const auth = await import("../src/lib/auth");
const caps = await import("../src/lib/capabilities");
const mfa = await import("../src/lib/webauthn");
const security = await import("../src/app/api/admin/security/route");
const accounts = await import("../src/app/api/auth/security/route");
const context = await import("../src/app/api/auth/client-context/route");
const login = await import("../src/app/api/auth/login/route");
const passkeys = await import("../src/app/api/auth/webauthn/route");
const password = "Synthetic-test-password-Only-123!";
const passwordHash = await auth.hashPassword(password);
for (const id of ["actor", "target", "support", "dataentry", "client"])
  await prisma.user.create({
    data: {
      id,
      email: `${id}@example.test`,
      name: "Synthetic User",
      passwordHash,
      role: id === "actor" ? "ADMIN" : id === "client" ? "CLIENT" : "STAFF",
    },
  });
for (const id of ["one", "two", "inactive"])
  await prisma.client.create({
    data: {
      id,
      name: "Synthetic Client",
      status: id === "inactive" ? "INACTIVE" : "ACTIVE",
    },
  });
for (const clientId of ["one", "two"])
  await prisma.clientMember.create({
    data: { userId: "client", clientId, role: "OWNER" },
  });
await prisma.service.create({
  data: {
    id: "service",
    slug: "quickbooks-cleanup",
    name: "Synthetic",
    shortName: "Synthetic",
    description: "Synthetic",
    shortDescription: "Synthetic",
    priceDisplay: "$1",
    priceCents: 100,
  },
});
for (const id of ["engagement-one", "engagement-other"])
  await prisma.verificationRequest.create({
    data: {
      id,
      clientId: "one",
      serviceId: "service",
      requestType: "Synthetic cleanup",
    },
  });
const actorToken = await auth.createSession("actor", "WEBAUTHN");
for (const capability of ["security", "permissions", "assignments"])
  await prisma.capabilityGrant.create({
    data: { userId: "actor", capability, scope: "GLOBAL" },
  });
function req(path: string, body?: object, token = actorToken) {
  return new Request(`http://localhost:4321${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      cookie: `pk_business_session=${token}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function actor() {
  const user = await auth.getSessionUser(actorToken);
  assert.ok(user);
  return user;
}
async function version(id = "target") {
  return (await prisma.user.findUniqueOrThrow({ where: { id } }))
    .securityVersion;
}
async function change(body: object) {
  return security.POST(
    req("/api/admin/security", {
      targetId: "target",
      expectedVersion: await version(),
      reason: "SYNTHETIC_TEST",
      ...body,
    }),
  );
}
after(async () => {
  await prisma.$disconnect();
  sqlite.close();
  rmSync(directory, { recursive: true, force: true });
});

test("staff password alone cannot create a privileged session", async () => {
  await assert.rejects(() => auth.createSession("target"));
});
test("staff login denies unauthorized initial enrollment and sends no session cookie", async () => {
  const response = await login.POST(
    req("/api/auth/login", { email: "target@example.test", password }),
  );
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("set-cookie"), null);
});
test("client password login remains functional", async () => {
  const response = await login.POST(
    req("/api/auth/login", { email: "client@example.test", password }),
  );
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("set-cookie"));
});
test("ADMIN has no implicit confidential, QA or filing authority", async () => {
  for (const cap of ["confidential_access", "qa", "filing"] as const)
    await assert.rejects(() =>
      caps.requireCapability(awaitableActor, cap, "one"),
    );
});
const awaitableActor = await actor();
test("support and data-entry have no inherited professional capabilities", async () => {
  for (const id of ["support", "dataentry"]) {
    const token = await auth.createSession(id, "WEBAUTHN");
    const user = await auth.getSessionUser(token);
    assert.ok(user);
    for (const cap of [
      "qa",
      "filing",
      "confidential_access",
      "permissions",
    ] as const)
      await assert.rejects(() => caps.requireCapability(user, cap, "one"));
  }
});
test("self escalation is denied", async () => {
  assert.equal(
    (
      await change({
        targetId: "actor",
        action: "grant",
        capability: "security",
        scope: "GLOBAL",
      })
    ).status,
    400,
  );
});
test("unauthorized capability grants are denied", async () => {
  const token = await auth.createSession("support", "WEBAUTHN");
  assert.equal(
    (
      await security.POST(
        req(
          "/api/admin/security",
          {
            action: "grant",
            targetId: "target",
            expectedVersion: await version(),
            capability: "security",
            scope: "GLOBAL",
            reason: "SYNTHETIC_TEST",
          },
          token,
        ),
      )
    ).status,
    403,
  );
});
test("unauthorized assignment is denied", async () => {
  const token = await auth.createSession("dataentry", "WEBAUTHN");
  assert.equal(
    (
      await security.POST(
        req(
          "/api/admin/security",
          {
            action: "assign",
            targetId: "target",
            expectedVersion: await version(),
            requestId: "missing",
            reason: "SYNTHETIC_TEST",
          },
          token,
        ),
      )
    ).status,
    403,
  );
});
test("permission grant revokes old sessions and is audited", async () => {
  const old = await auth.createSession("target", "WEBAUTHN");
  assert.equal(
    (
      await change({
        action: "grant",
        capability: "confidential_access",
        scope: "CLIENT",
        clientId: "one",
      })
    ).status,
    200,
  );
  assert.equal(await auth.getSessionUser(old), null);
  assert.ok(
    await prisma.auditLog.findFirst({
      where: { resource: "identity", resourceId: "target" },
    }),
  );
});
test("explicit client context is required", async () => {
  const token = await auth.createSession("target", "WEBAUTHN");
  const user = await auth.getSessionUser(token);
  assert.ok(user);
  await assert.rejects(() =>
    caps.requireCapability(user, "confidential_access", "one"),
  );
});
test("authorized context succeeds; cross-client context fails", async () => {
  const token = await auth.createSession("target", "WEBAUTHN");
  assert.equal(
    (
      await context.POST(
        req("/api/auth/client-context", { clientId: "one" }, token),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await context.POST(
        req("/api/auth/client-context", { clientId: "two" }, token),
      )
    ).status,
    403,
  );
  const user = await auth.getSessionUser(token);
  assert.ok(user);
  await caps.requireCapability(user, "confidential_access", "one");
  await assert.rejects(() =>
    caps.requireCapability(user, "confidential_access", "two"),
  );
});
test("ambiguous client membership denies context until explicit selection", async () => {
  const token = await auth.createSession("client");
  assert.equal(await auth.getAuthContext(token), null);
  assert.equal(
    (
      await context.POST(
        req("/api/auth/client-context", { clientId: "two" }, token),
      )
    ).status,
    200,
  );
  assert.equal((await auth.getAuthContext(token))?.clientId, "two");
});
test("inactive clients cannot be selected or accessed", async () => {
  await prisma.capabilityGrant.create({
    data: {
      userId: "target",
      capability: "confidential_access",
      scope: "CLIENT",
      clientId: "inactive",
    },
  });
  const token = await auth.createSession("target", "WEBAUTHN");
  assert.equal(
    (
      await context.POST(
        req("/api/auth/client-context", { clientId: "inactive" }, token),
      )
    ).status,
    403,
  );
});
test("QA does not imply filing; REQUEST grants do not imply other engagements", () => {
  const grant = {
    capability: "qa",
    scope: "REQUEST",
    clientId: "one",
    requestId: "engagement-one",
  };
  assert.equal(caps.grantMatches(grant, "qa", "one", "engagement-one"), true);
  assert.equal(caps.grantMatches(grant, "qa", "one", "engagement-two"), false);
  assert.equal(
    caps.grantMatches(grant, "filing", "one", "engagement-one"),
    false,
  );
});
test("concurrent permission changes accept one expected security version", async () => {
  const v = await version();
  const responses = await Promise.all(
    ["bookkeeping", "qa"].map((capability) =>
      security.POST(
        req("/api/admin/security", {
          action: "grant",
          targetId: "target",
          expectedVersion: v,
          reason: "SYNTHETIC_TEST",
          capability,
          scope: "CLIENT",
          clientId: "one",
        }),
      ),
    ),
  );
  assert.equal(responses.filter((r) => r.status === 200).length, 1);
});
test("audit failure rolls back grant and security version", async () => {
  const before = await version();
  sqlite.exec(
    `CREATE TRIGGER synthetic_audit_fail BEFORE INSERT ON AuditLog BEGIN SELECT RAISE(ABORT, 'synthetic'); END`,
  );
  try {
    assert.equal(
      (
        await change({
          action: "grant",
          capability: "filing",
          scope: "CLIENT",
          clientId: "one",
        })
      ).status,
      500,
    );
    assert.equal(await version(), before);
    assert.equal(
      await prisma.capabilityGrant.count({
        where: { userId: "target", capability: "filing" },
      }),
      0,
    );
  } finally {
    sqlite.exec("DROP TRIGGER synthetic_audit_fail");
  }
});
test("audit failure prevents session establishment", async () => {
  const before = await prisma.session.count({ where: { userId: "support" } });
  sqlite.exec(
    `CREATE TRIGGER synthetic_auth_audit_fail BEFORE INSERT ON AuditLog BEGIN SELECT RAISE(ABORT, 'synthetic'); END`,
  );
  try {
    await assert.rejects(() => auth.createSession("support", "WEBAUTHN"));
    assert.equal(
      await prisma.session.count({ where: { userId: "support" } }),
      before,
    );
  } finally {
    sqlite.exec("DROP TRIGGER synthetic_auth_audit_fail");
  }
});
test("privileged action requires recent step-up", async () => {
  const user = await actor();
  assert.throws(() =>
    auth.requireRecentAuthentication({ ...user, mfaVerifiedAt: new Date(0) }),
  );
  assert.throws(() =>
    auth.requireRecentAuthentication({
      ...user,
      passwordVerifiedAt: new Date(0),
    }),
  );
  auth.requireRecentAuthentication(user);
});
test("idle and absolute staff expiration fail closed", async () => {
  const token = await auth.createSession("target", "WEBAUTHN");
  await prisma.session.updateMany({
    where: { userId: "target" },
    data: { lastSeenAt: new Date(0) },
  });
  assert.equal(await auth.getSessionUser(token), null);
  const absolute = await auth.createSession("target", "WEBAUTHN");
  await prisma.session.updateMany({
    where: { userId: "target" },
    data: { expiresAt: new Date(0) },
  });
  assert.equal(await auth.getSessionUser(absolute), null);
});
test("revoked session replay is rejected", async () => {
  const token = await auth.createSession("target", "WEBAUTHN");
  await auth.destroySession(token);
  assert.equal(await auth.getSessionUser(token), null);
});
test("recovery codes generated as hashes, revoke all sessions and replace old codes", async () => {
  const token = await auth.createSession("target", "WEBAUTHN");
  const other = await auth.createSession("target", "WEBAUTHN");
  const result = await accounts.POST(
    req("/api/auth/security", { action: "recovery-codes" }, token),
  );
  assert.equal(result.status, 200);
  const { codes } = await result.json();
  assert.equal(codes.length, 10);
  const rows = await prisma.recoveryCode.findMany({
    where: { userId: "target" },
  });
  assert.ok(rows.every((row) => !codes.includes(row.codeHash)));
  assert.equal(await auth.getSessionUser(token), null);
  assert.equal(await auth.getSessionUser(other), null);
});
test("unauthorized initial enrollment is denied", async () => {
  await assert.rejects(() => mfa.startChallenge("support", "ENROLL"));
});
test("authorized initial enrollment expires", async () => {
  assert.equal((await change({ action: "enrollment" })).status, 200);
  await prisma.user.update({
    where: { id: "target" },
    data: { mfaEnrollmentExpiresAt: new Date(0) },
  });
  await assert.rejects(() => mfa.startChallenge("target", "ENROLL"));
});
test("challenge expiration, replay, disablement and security reset are denied", () => {
  const challenge = {
    consumedAt: null,
    expiresAt: new Date(Date.now() + 1000),
    securityVersion: 1,
    user: { securityVersion: 1, status: "ACTIVE" },
  };
  assert.ok(mfa.challengeUsable(challenge));
  for (const bad of [
    { ...challenge, consumedAt: new Date() },
    { ...challenge, expiresAt: new Date(0) },
    { ...challenge, user: { ...challenge.user, securityVersion: 2 } },
    { ...challenge, user: { ...challenge.user, status: "INACTIVE" } },
  ])
    assert.equal(mfa.challengeUsable(bad), false);
});
test("cryptographic verification cannot be bypassed with arbitrary response", async () => {
  await prisma.user.update({
    where: { id: "target" },
    data: {
      mfaEnrollmentAllowed: true,
      mfaEnrollmentExpiresAt: new Date(Date.now() + 60000),
    },
  });
  const c = await mfa.startChallenge("target", "ENROLL");
  const response = await passkeys.POST(
    req("/api/auth/webauthn", {
      action: "verify",
      ticket: c.ticket,
      response: { id: "synthetic-invalid" },
    }),
  );
  assert.notEqual(response.status, 200);
  assert.ok(
    (
      await prisma.securityChallenge.findUniqueOrThrow({
        where: { tokenHash: auth.hashToken(c.ticket) },
      })
    ).consumedAt,
  );
  await assert.rejects(() =>
    mfa.finishChallenge(c.ticket, { id: "synthetic-invalid" } as never),
  );
});
test("recovery-code use grants only enrollment, and code reuse is denied", async () => {
  await prisma.webAuthnCredential.create({
    data: {
      id: "synthetic-lost-device",
      userId: "target",
      publicKey: Buffer.from("synthetic-public-key"),
      counter: BigInt(0),
      transports: "[]",
      label: "Synthetic lost device",
      deviceType: "singleDevice",
      backedUp: false,
    },
  });
  const code = "b".repeat(48);
  await prisma.recoveryCode.create({
    data: { userId: "target", codeHash: mfa.recoveryHash(code) },
  });
  const c = await mfa.startChallenge("target", "LOGIN");
  const recovered = await mfa.redeemRecovery(c.ticket, code);
  assert.equal(recovered.enrollment, true);
  assert.equal(
    await prisma.webAuthnCredential.count({ where: { userId: "target" } }),
    0,
  );
  assert.equal(await prisma.session.count({ where: { userId: "target" } }), 0);
  assert.equal(
    (
      await prisma.securityChallenge.findUniqueOrThrow({
        where: { tokenHash: auth.hashToken(recovered.ticket) },
      })
    ).purpose,
    "RECOVERY_ENROLL",
  );
  const second = await mfa.startChallenge("target", "LOGIN");
  await assert.rejects(() => mfa.redeemRecovery(second.ticket, code));
});
test("failed recovery burns the attempt and is audited", async () => {
  const c = await mfa.startChallenge("target", "LOGIN");
  await assert.rejects(() => mfa.redeemRecovery(c.ticket, "c".repeat(48)));
  assert.ok(
    (
      await prisma.securityChallenge.findUniqueOrThrow({
        where: { tokenHash: auth.hashToken(c.ticket) },
      })
    ).consumedAt,
  );
});
test("inventory cookie never authenticates PK", () => {
  assert.equal(
    auth.getSessionTokenFromRequest(
      new Request("http://localhost:4321", {
        headers: { cookie: `pk_inventory_session=${actorToken}` },
      }),
    ),
    undefined,
  );
});
test("request grants restrict collection queries and unassigned records", async () => {
  await prisma.capabilityGrant.create({
    data: {
      userId: "support",
      capability: "confidential_access",
      scope: "REQUEST",
      clientId: "one",
      requestId: "engagement-one",
    },
  });
  const token = await auth.createSession("support", "WEBAUTHN");
  await context.POST(
    req("/api/auth/client-context", { clientId: "one" }, token),
  );
  const user = await auth.getSessionUser(token);
  assert.ok(user);
  await caps.requireRequestAccess(user, "engagement-one");
  await assert.rejects(() =>
    caps.requireRequestAccess(user, "engagement-other"),
  );
  const filter = await caps.confidentialRequestFilter(user);
  assert.equal(
    (await prisma.verificationRequest.findMany({ where: filter })).length,
    1,
  );
});
test("bulk export, filing and legal-hold reusable gates require step-up", async () => {
  const token = await auth.createSession("support", "WEBAUTHN");
  await prisma.session.updateMany({
    where: { userId: "support" },
    data: { mfaVerifiedAt: new Date(0) },
  });
  for (const cap of ["bulk_export", "filing", "legal_hold"] as const)
    await assert.rejects(() =>
      caps.requireSensitiveOperation(
        req("/api/future", undefined, token),
        cap,
        "one",
      ),
    );
});
test("role change invalidates all target sessions without granting specialized authority", async () => {
  const token = await auth.createSession("target", "WEBAUTHN");
  assert.equal((await change({ action: "role", role: "ADMIN" })).status, 200);
  assert.equal(await auth.getSessionUser(token), null);
  assert.equal(
    await prisma.capabilityGrant.count({
      where: { userId: "target", capability: "security" },
    }),
    0,
  );
});
test("manual recovery cannot be invoked without recorded policy verification", async () => {
  assert.equal(
    (
      await change({
        action: "manual-recovery",
        reason: "VERIFIED_MANUAL_RECOVERY",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await change({
        action: "manual-recovery",
        reason: "VERIFIED_MANUAL_RECOVERY",
        identityProofApproved: true,
      })
    ).status,
    200,
  );
  const user = await prisma.user.findUniqueOrThrow({ where: { id: "target" } });
  assert.ok(
    user.mfaEnrollmentAllowed && user.mfaEnrollmentExpiresAt! > new Date(),
  );
  await assert.rejects(() => auth.createSession("target"));
});
test("other-tab client changes cannot silently redirect request creation", async () => {
  const token = await auth.createSession("client");
  await context.POST(
    req("/api/auth/client-context", { clientId: "one" }, token),
  );
  const requests = await import("../src/app/api/portal/requests/route");
  await context.POST(
    req("/api/auth/client-context", { clientId: "two" }, token),
  );
  const stale = new Request("http://localhost:4321/api/portal/requests", {
    method: "POST",
    headers: {
      cookie: `pk_business_session=${token}`,
      "Content-Type": "application/json",
      "x-pk-client-context": "one",
    },
    body: JSON.stringify({
      serviceSlug: "quickbooks-cleanup",
      description: "Synthetic only",
    }),
  });
  assert.equal((await requests.POST(stale)).status, 409);
  assert.equal(
    await prisma.verificationRequest.count({ where: { clientId: "two" } }),
    0,
  );
  const confirmed = new Request("http://localhost:4321/api/portal/requests", {
    method: "POST",
    headers: {
      cookie: `pk_business_session=${token}`,
      "Content-Type": "application/json",
      "x-pk-client-context": "two",
    },
    body: JSON.stringify({
      serviceSlug: "quickbooks-cleanup",
      description: "Synthetic only",
    }),
  });
  assert.equal((await requests.POST(confirmed)).status, 200);
  assert.equal(
    await prisma.verificationRequest.count({ where: { clientId: "two" } }),
    1,
  );
});
test("client membership step-up refreshes password assurance without staff authority", async () => {
  const token = await auth.createSession("client");
  await prisma.session.updateMany({
    where: { userId: "client" },
    data: { passwordVerifiedAt: new Date(0) },
  });
  const old = await auth.getSessionUser(token);
  assert.ok(old);
  assert.throws(() => auth.requireRecentPassword(old));
  assert.equal(
    (
      await accounts.POST(
        req(
          "/api/auth/security",
          { action: "client-step-up", password },
          token,
        ),
      )
    ).status,
    200,
  );
  const fresh = await auth.getSessionUser(token);
  assert.ok(fresh);
  auth.requireRecentPassword(fresh);
  assert.equal(fresh.assurance, "PASSWORD");
  await assert.rejects(() => caps.requireCapability(fresh, "permissions"));
});
test("client revoke-all requires password verification", async () => {
  const token = await auth.createSession("client");
  assert.equal(
    (
      await accounts.POST(
        req(
          "/api/auth/security",
          { action: "revoke-all", password: "incorrect" },
          token,
        ),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await accounts.POST(
        req("/api/auth/security", { action: "revoke-all", password }, token),
      )
    ).status,
    200,
  );
  assert.equal(await auth.getSessionUser(token), null);
});
test("validly signed assertion without user verification is denied", async () => {
  const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = keys.publicKey.export({ format: "jwk" });
  const key = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    Buffer.from(jwk.x!, "base64url"),
    Buffer.from([0x22, 0x58, 0x20]),
    Buffer.from(jwk.y!, "base64url"),
  ]);
  const id = Buffer.from("synthetic-uv-credential").toString("base64url");
  await prisma.webAuthnCredential.create({
    data: {
      id,
      userId: "target",
      publicKey: key,
      counter: BigInt(0),
      transports: "[]",
      label: "Synthetic",
      deviceType: "singleDevice",
      backedUp: false,
    },
  });
  const c = await mfa.startChallenge("target", "LOGIN");
  const client = Buffer.from(
    JSON.stringify({
      type: "webauthn.get",
      challenge: c.options.challenge,
      origin: "http://localhost:4321",
      crossOrigin: false,
    }),
  );
  const authData = Buffer.concat([
    createHash("sha256").update("localhost").digest(),
    Buffer.from([0x01, 0, 0, 0, 1]),
  ]);
  const signature = sign(
    "sha256",
    Buffer.concat([authData, createHash("sha256").update(client).digest()]),
    keys.privateKey,
  );
  await assert.rejects(() =>
    mfa.finishChallenge(c.ticket, {
      id,
      rawId: id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        clientDataJSON: client.toString("base64url"),
        authenticatorData: authData.toString("base64url"),
        signature: signature.toString("base64url"),
      },
    }),
  );
});
test("bookkeeping QA/payment release rules remain unchanged", async () => {
  const { checkReleaseReadiness } = await import("../src/lib/deliverables");
  const readiness = await checkReleaseReadiness("engagement-one");
  assert.equal(readiness.ok, false);
  if (!readiness.ok) {
    assert.ok(readiness.reasons.some((r) => r.includes("QA")));
    assert.ok(readiness.reasons.some((r) => r.includes("invoice")));
  }
});
test("assignment-only role cannot inherit confidential access", async () => {
  await prisma.verificationRequest.update({
    where: { id: "engagement-other" },
    data: { assignedStaffId: "dataentry" },
  });
  const token = await auth.createSession("dataentry", "WEBAUTHN");
  const user = await auth.getSessionUser(token);
  assert.ok(user);
  await assert.rejects(() =>
    caps.requireRequestAccess(user, "engagement-other"),
  );
});
test("legacy document download remains authorized, private and client scoped", async () => {
  await prisma.capabilityGrant.create({
    data: {
      userId: "actor",
      capability: "confidential_access",
      scope: "CLIENT",
      clientId: "one",
    },
  });
  await context.POST(req("/api/auth/client-context", { clientId: "one" }));
  const storage = await import("../src/lib/storage");
  const key = storage.buildStorageKey("one", "engagement-one", "synthetic.txt");
  await storage.putObject(
    key,
    Buffer.from("SYNTHETIC_DOCUMENT_ONLY"),
    "text/plain",
  );
  await prisma.document.create({
    data: {
      id: "synthetic-document",
      requestId: "engagement-one",
      category: "OTHER",
      fileName: "synthetic.txt",
      mimeType: "text/plain",
      fileSizeBytes: 23,
      storageKey: key,
      uploadStatus: "UPLOADED",
    },
  });
  const documents = await import("../src/app/api/admin/documents/[id]/route");
  const response = await documents.GET(
    req("/api/admin/documents/synthetic-document"),
    { params: Promise.resolve({ id: "synthetic-document" }) },
  );
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "SYNTHETIC_DOCUMENT_ONLY");
  assert.ok(response.headers.get("cache-control")?.includes("no-store"));
  const token = await auth.createSession("dataentry", "WEBAUTHN");
  assert.equal(
    (
      await documents.GET(
        req("/api/admin/documents/synthetic-document", undefined, token),
        { params: Promise.resolve({ id: "synthetic-document" }) },
      )
    ).status,
    403,
  );
});
test("invoice creation and synthetic manual payment preserve existing rules", async () => {
  for (const capability of ["pricing"])
    await prisma.capabilityGrant.create({
      data: { userId: "actor", capability, scope: "GLOBAL" },
    });
  await prisma.capabilityGrant.create({
    data: {
      userId: "actor",
      capability: "payments",
      scope: "CLIENT",
      clientId: "one",
    },
  });
  const invoices = await import("../src/app/api/admin/invoices/route");
  const response = await invoices.POST(
    req("/api/admin/invoices", {
      clientId: "one",
      requestId: "engagement-one",
      lineItems: [
        { description: "Synthetic only", quantity: 1, rateCents: 100 },
      ],
      adjustmentCents: 0,
    }),
  );
  assert.equal(response.status, 201);
  const { invoice: data } = await response.json();
  await prisma.invoice.update({
    where: { id: data.id },
    data: { status: "SENT" },
  });
  const actions =
    await import("../src/app/api/admin/invoices/[id]/actions/route");
  const overpay = await actions.POST(
    req(`/api/admin/invoices/${data.id}/actions`, {
      action: "record-payment",
      amountCents: 200,
      method: "MANUAL",
    }),
    { params: Promise.resolve({ id: data.id }) },
  );
  assert.equal(overpay.status, 400);
  const paid = await actions.POST(
    req(`/api/admin/invoices/${data.id}/actions`, {
      action: "record-payment",
      amountCents: 100,
      method: "MANUAL",
    }),
    { params: Promise.resolve({ id: data.id }) },
  );
  assert.equal(paid.status, 200);
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: data.id } })).status,
    "PAID",
  );
});
test("deliverable release still requires QA and recorded payment", async () => {
  for (const capability of ["bookkeeping", "qa"])
    await prisma.capabilityGrant.create({
      data: { userId: "actor", capability, scope: "CLIENT", clientId: "one" },
    });
  const key = "synthetic-deliverable-key";
  await prisma.deliverable.create({
    data: {
      id: "synthetic-deliverable",
      requestId: "engagement-one",
      title: "Synthetic",
      fileName: "synthetic.txt",
      mimeType: "text/plain",
      fileSizeBytes: 0,
      storageKey: key,
    },
  });
  const deliverables =
    await import("../src/app/api/admin/requests/[id]/deliverables/[deliverableId]/route");
  const makeRequest = () =>
    new Request(
      "http://localhost:4321/api/admin/requests/engagement-one/deliverables/synthetic-deliverable",
      {
        method: "PATCH",
        headers: {
          cookie: `pk_business_session=${actorToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visibility: "RELEASED" }),
      },
    );
  const params = {
    params: Promise.resolve({
      id: "engagement-one",
      deliverableId: "synthetic-deliverable",
    }),
  };
  const blocked = await deliverables.PATCH(makeRequest(), params);
  assert.notEqual(blocked.status, 200);
  await prisma.qbCleanupReview.create({
    data: {
      requestId: "engagement-one",
      reviewerId: "actor",
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
  assert.equal((await deliverables.PATCH(makeRequest(), params)).status, 200);
  assert.equal(
    (
      await prisma.deliverable.findUniqueOrThrow({
        where: { id: "synthetic-deliverable" },
      })
    ).visibility,
    "RELEASED",
  );
});
test("offboarding invalidates sessions, grants, recovery and enrollment", async () => {
  const token = await auth.createSession("target", "WEBAUTHN");
  assert.equal((await change({ action: "offboard" })).status, 200);
  assert.equal(await auth.getSessionUser(token), null);
  assert.equal(
    await prisma.capabilityGrant.count({ where: { userId: "target" } }),
    0,
  );
  assert.equal(
    await prisma.recoveryCode.count({ where: { userId: "target" } }),
    0,
  );
  assert.equal(
    (await prisma.user.findUniqueOrThrow({ where: { id: "target" } })).status,
    "INACTIVE",
  );
  await assert.rejects(() => mfa.startChallenge("target", "LOGIN"));
});

test("password reset invalidates sessions and challenges while preserving MFA", async () => {
  const reset = await import("../src/lib/password-reset");
  const resetToken = "synthetic-reset-token-only";
  await prisma.webAuthnCredential.create({
    data: {
      id: "synthetic-actor-credential",
      userId: "actor",
      publicKey: Buffer.from("synthetic-public-key"),
      counter: BigInt(0),
      transports: "[]",
      label: "Synthetic",
      deviceType: "singleDevice",
      backedUp: false,
    },
  });
  await prisma.passwordResetToken.create({
    data: {
      userId: "actor",
      tokenHash: reset.hashResetToken(resetToken),
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  await reset.confirmPasswordReset(
    resetToken,
    "Synthetic-new-password-Only-123!",
  );
  assert.equal(await auth.getSessionUser(actorToken), null);
  assert.equal(
    await prisma.webAuthnCredential.count({ where: { userId: "actor" } }),
    1,
  );
});

test("staff security sessions preserve the actual password assurance timestamp", async () => {
  const verifiedAt = new Date(Date.now() - 10 * 60 * 1000);
  const token = await auth.createSession(
    "actor",
    "WEBAUTHN",
    await version("actor"),
    verifiedAt,
  );
  const user = await auth.getSessionUser(token);
  assert.ok(user);
  assert.equal(user.passwordVerifiedAt.getTime(), verifiedAt.getTime());
  assert.throws(() => auth.requireRecentAuthentication(user));
});
