// Synthetic-only, disposable SQLite + four isolated filesystem resources. No external transports.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
const root = mkdtempSync(join(tmpdir(), "pk-phase1c-synthetic-db-"));
for (const key of [
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "ANTHROPIC_API_KEY",
  "PK_STORAGE_ENVIRONMENT",
  "PK_EMAIL_ENVIRONMENT",
  "VERCEL",
  "VERCEL_ENV",
])
  process.env[key] = "";
Object.assign(process.env, {
  NODE_ENV: "test",
  PK_ENVIRONMENT: "test",
  PK_AUTH_ENVIRONMENT: "test",
  AUTH_SECRET: "synthetic-phase1c-only",
  PK_VAULT_SYNTHETIC: "true",
  PK_ALLOW_SYNTHETIC_SETUP: "true",
  DATABASE_URL: `file:${join(root, "synthetic.db")}`,
  PK_VAULT_SYNTHETIC_ROOT: join(root, "vault-test-resources"),
  STORAGE_DIR: join(root, "ordinary-documents"),
  STORAGE_PROVIDER: "",
});
const sqlite = new Database(join(root, "synthetic.db"));
sqlite.exec(
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
const { prisma } = await import("../src/lib/prisma");
const auth = await import("../src/lib/auth");
const providers = await import("../src/lib/vault/providers");
const vault = await import("../src/lib/vault/service");
const disposal = await import("../src/lib/vault/disposal");
const recovery = await import("../src/lib/vault/backup");
const policy = await import("../src/lib/vault/policy");
const api = await import("../src/app/api/vault/[id]/route");
const runtime = await providers.createSyntheticRuntime();
const resources = [runtime];
const canary = "SYNTHETIC_CONFIDENTIAL_CANARY_NO_REAL_DATA";
const pdf = (extra = "") =>
  Buffer.from(
    `%PDF-1.4\n% PK_SYNTHETIC_VAULT_V1 ${canary} ${extra}\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`,
  );
for (const [id, role] of [
  ["staff", "STAFF"],
  ["admin", "ADMIN"],
  ["support", "STAFF"],
  ["entry", "STAFF"],
  ["client", "CLIENT"],
] as const)
  await prisma.user.create({
    data: {
      id,
      role,
      email: `${id}@example.test`,
      name: "Synthetic",
      passwordHash: "synthetic-only-not-a-real-password-hash",
    },
  });
for (const id of ["one", "two", "inactive"])
  await prisma.client.create({
    data: {
      id,
      name: "Synthetic",
      status: id === "inactive" ? "INACTIVE" : "ACTIVE",
    },
  });
await prisma.service.create({
  data: {
    id: "service",
    slug: "synthetic",
    name: "Synthetic",
    shortName: "Synthetic",
    description: "Synthetic",
    shortDescription: "Synthetic",
    priceDisplay: "$1",
    priceCents: 100,
  },
});
for (const [id, clientId] of [
  ["request", "one"],
  ["other", "one"],
  ["cross", "two"],
  ["inactive-request", "inactive"],
])
  await prisma.verificationRequest.create({
    data: { id, clientId, serviceId: "service", requestType: "Synthetic" },
  });
const syntheticPolicyId = randomUUID();
await prisma.vaultRetentionPolicy.create({
  data: {
    id: syntheticPolicyId,
    category: "BOOKKEEPING_SOURCE",
    policyVersion: "SYNTHETIC_POLICY",
    durationDays: 1,
    approved: true,
  },
});
const tokens: Record<string, string> = {};
for (const id of ["staff", "admin", "support", "entry", "client"]) {
  tokens[id] = await auth.createSession(
    id,
    id === "client" ? "PASSWORD" : "WEBAUTHN",
  );
  await prisma.session.updateMany({
    where: { userId: id },
    data: { activeClientId: "one" },
  });
}
for (const capability of [
  "confidential_access",
  "vault_read",
  "vault_upload",
  "high_risk_access",
  "tax_information_access",
  "bulk_export",
  "legal_hold",
  "disposal",
])
  await prisma.capabilityGrant.create({
    data: {
      userId: "staff",
      capability,
      scope: "REQUEST",
      clientId: "one",
      requestId: "request",
    },
  });
await prisma.capabilityGrant.create({
  data: { userId: "staff", capability: "security", scope: "GLOBAL" },
});
function req(
  id = "staff",
  clientId = "one",
  body?: Buffer,
  mime = "application/pdf",
  extension = "pdf",
) {
  return new Request("http://localhost:4321/api/vault?requestId=request", {
    method: body ? "PUT" : "GET",
    headers: {
      cookie: `pk_business_session=${tokens[id] || "invalid"}`,
      "x-pk-client-context": clientId,
      ...(body
        ? {
            "Content-Type": mime,
            "content-length": String(body.length),
            "x-vault-extension": extension,
          }
        : {}),
    },
    ...(body ? { body: new Uint8Array(body) } : {}),
  });
}
function input(bytes = pdf(), more: object = {}) {
  return {
    requestId: "request",
    idempotencyKey: randomUUID(),
    purpose: "REQUIRED_ENGAGEMENT_RECORD",
    category: "BOOKKEEPING",
    retentionCategory: "BOOKKEEPING_SOURCE",
    highRisk: false,
    taxInformation: false,
    mimeType: "application/pdf",
    size: bytes.length,
    ...more,
  };
}
async function newIntent(bytes = pdf(), more: object = {}) {
  return vault.createIntent(req(), input(bytes, more), runtime);
}
async function released(extra = "") {
  const bytes = pdf(extra),
    doc = await newIntent(bytes);
  await vault.upload(req("staff", "one", bytes), doc.id, runtime);
  return doc.id;
}
async function row(id: string) {
  return prisma.vaultDocument.findUniqueOrThrow({ where: { id } });
}
async function retention(id: string) {
  const doc = await row(id);
  return disposal.applyRetention(
    req(),
    id,
    {
      reference: syntheticPolicyId,
      policyVersion: "SYNTHETIC_POLICY",
      triggerAt: "2000-01-01T00:00:00.000Z",
      version: doc.version,
    },
    runtime,
  );
}
after(async () => {
  await prisma.$disconnect();
  sqlite.close();
  rmSync(root, { recursive: true, force: true });
  for (const r of resources)
    for (const path of Object.values(r.storage.resources))
      rmSync(path, { recursive: true, force: true });
});
let cleanId = "";
test("isolated resources and encrypted bytes; opaque identifiers", async () => {
  assert.equal(new Set(Object.values(runtime.storage.resources)).size, 4);
  cleanId = await released();
  assert.match(cleanId, /^[a-f0-9-]{36}$/);
  const object = await runtime.storage.get("released", cleanId);
  assert.ok(object);
  assert.equal(object.includes(Buffer.from(canary)), false);
  const doc = await row(cleanId);
  assert.equal(doc.state, "RELEASED");
  assert.equal("fileName" in doc, false);
  assert.equal(doc.clientId, "one");
});
test("anonymous access denied before confidential bytes", async () => {
  await assert.rejects(() =>
    vault.access(req("anonymous"), cleanId, false, runtime),
  );
});
test("ADMIN without scoped Vault authority denied", async () => {
  await assert.rejects(() =>
    vault.access(req("admin"), cleanId, false, runtime),
  );
});
test("support and data-entry do not inherit access", async () => {
  for (const id of ["support", "entry"])
    await assert.rejects(() => vault.access(req(id), cleanId, false, runtime));
});
test("cross-client IDOR denied", async () => {
  await assert.rejects(() =>
    vault.access(req("staff", "two"), cleanId, false, runtime),
  );
});
test("wrong engagement scope denied", async () => {
  await assert.rejects(() => newIntent(pdf(), { requestId: "other" }));
});
test("unassigned/no-grant staff denied", async () => {
  await assert.rejects(() =>
    vault.createIntent(req("entry"), input(), runtime),
  );
});
test("explicit context required; ambiguous context cannot auto-select", async () => {
  await assert.rejects(() =>
    vault.access(req("staff", ""), cleanId, false, runtime),
  );
  await prisma.session.updateMany({
    where: { userId: "staff" },
    data: { activeClientId: null },
  });
  await assert.rejects(() => vault.access(req(), cleanId, false, runtime));
  await prisma.session.updateMany({
    where: { userId: "staff" },
    data: { activeClientId: "one" },
  });
});
test("inactive client denied", async () => {
  await prisma.client.update({
    where: { id: "one" },
    data: { status: "INACTIVE" },
  });
  await assert.rejects(() => vault.access(req(), cleanId, false, runtime));
  await prisma.client.update({
    where: { id: "one" },
    data: { status: "ACTIVE" },
  });
});
test("classification requires independent specialized authority", async () => {
  const bytes = pdf();
  const doc = await newIntent(bytes, {
    category: "TAX",
    highRisk: true,
    taxInformation: true,
  });
  await vault.upload(req("staff", "one", bytes), doc.id, runtime);
  await prisma.capabilityGrant.deleteMany({
    where: { userId: "staff", capability: "tax_information_access" },
  });
  await assert.rejects(() => vault.access(req(), doc.id, false, runtime));
  await prisma.capabilityGrant.create({
    data: {
      userId: "staff",
      capability: "tax_information_access",
      scope: "REQUEST",
      clientId: "one",
      requestId: "request",
    },
  });
});
test("taxonomy cannot under-classify tax/identity documents", async () => {
  await assert.rejects(() => newIntent(pdf(), { category: "TAX" }));
  await assert.rejects(() => newIntent(pdf(), { category: "IDENTITY" }));
});
test("client membership is not an unapproved Vault grant", async () => {
  await prisma.clientMember.create({
    data: { clientId: "one", userId: "client", role: "OWNER" },
  });
  await assert.rejects(() =>
    vault.access(req("client"), cleanId, false, runtime),
  );
});
test("quarantined object cannot download", async () => {
  const doc = await newIntent();
  await assert.rejects(() => vault.access(req(), doc.id, false, runtime));
});
test("scan outage fails closed; release denied", async () => {
  const bytes = pdf("SYNTHETIC_SCANNER_OUTAGE"),
    doc = await newIntent(bytes);
  const result = await vault.upload(
    req("staff", "one", bytes),
    doc.id,
    runtime,
  );
  assert.equal(result.state, "SCAN_FAILED");
  await assert.rejects(() => vault.release(req(), doc.id, runtime));
  await assert.rejects(() => vault.access(req(), doc.id, false, runtime));
});
test("malicious synthetic marker is rejected", async () => {
  const bytes = pdf("SYNTHETIC_MALWARE"),
    doc = await newIntent(bytes);
  assert.equal(
    (await vault.upload(req("staff", "one", bytes), doc.id, runtime)).state,
    "REJECTED",
  );
  await assert.rejects(() => vault.access(req(), doc.id, false, runtime));
});
test("unknown scanning result requires review, not release", async () => {
  const bytes = pdf("SYNTHETIC_REVIEW"),
    doc = await newIntent(bytes);
  assert.equal(
    (await vault.upload(req("staff", "one", bytes), doc.id, runtime)).state,
    "REQUIRES_REVIEW",
  );
});
test("spoofed MIME and malformed file rejected", async () => {
  for (const bytes of [
    Buffer.from("not a PDF"),
    Buffer.from("%PDF-1.4 truncated"),
  ]) {
    const doc = await newIntent(bytes);
    await assert.rejects(() =>
      vault.upload(req("staff", "one", bytes), doc.id, runtime),
    );
    assert.equal((await row(doc.id)).state, "UPLOAD_FAILED");
  }
});
test("extension mismatch rejected without retaining filename", async () => {
  const doc = await newIntent();
  await assert.rejects(() =>
    vault.upload(
      req("staff", "one", pdf(), "application/pdf", "exe"),
      doc.id,
      runtime,
    ),
  );
  assert.equal((await row(doc.id)).state, "UPLOAD_FAILED");
});
test("oversized intent rejected before storage", async () => {
  await assert.rejects(() => newIntent(pdf(), { size: policy.MAX_BYTES + 1 }));
});
test("stream bound rejects excessive/incomplete bytes", async () => {
  for (const length of [pdf().length - 1, pdf().length + 1]) {
    const doc = await newIntent(pdf(), { size: length });
    const request = req("staff", "one", pdf());
    request.headers.set("content-length", String(length));
    await assert.rejects(() => vault.upload(request, doc.id, runtime));
  }
});
test("idempotent intent returns same object; changed intent denied", async () => {
  const data = input();
  const a = await vault.createIntent(req(), data, runtime);
  const b = await vault.createIntent(req(), data, runtime);
  assert.equal(a.id, b.id);
  await assert.rejects(() =>
    vault.createIntent(
      req(),
      { ...data, category: "OTHER_CONFIDENTIAL" },
      runtime,
    ),
  );
});
test("duplicate/replayed upload cannot overwrite released bytes", async () => {
  await assert.rejects(() =>
    vault.upload(req("staff", "one", pdf()), cleanId, runtime),
  );
  assert.equal((await row(cleanId)).state, "RELEASED");
});
test("concurrent upload claim has one winner", async () => {
  const doc = await newIntent();
  const results = await Promise.allSettled([
    vault.upload(req("staff", "one", pdf()), doc.id, runtime),
    vault.upload(req("staff", "one", pdf()), doc.id, runtime),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await row(doc.id)).state, "RELEASED");
});
test("download audited before delivery and uses private no-store", async () => {
  const before = await prisma.auditLog.count({
    where: { resourceId: cleanId },
  });
  const response = await vault.access(req(), cleanId, false, runtime);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control")!, /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(
    response.headers.get("content-disposition")!,
    /secure-document.pdf/,
  );
  assert.equal(await response.text(), pdf().toString());
  assert.equal(
    await prisma.auditLog.count({ where: { resourceId: cleanId } }),
    before + 1,
  );
});
test("audit outage blocks byte delivery", async () => {
  sqlite.exec(
    "CREATE TRIGGER vault_audit_failure BEFORE INSERT ON AuditLog WHEN NEW.resource = 'secure_vault' BEGIN SELECT RAISE(FAIL, 'synthetic audit unavailable'); END",
  );
  try {
    await assert.rejects(() => vault.access(req(), cleanId, false, runtime));
  } finally {
    sqlite.exec("DROP TRIGGER vault_audit_failure");
  }
});
test("unsafe PDF inline preview denied", async () => {
  await assert.rejects(() => vault.access(req(), cleanId, true, runtime));
});
test("permanent/signed public URL not present anywhere in object metadata", async () => {
  const data = await vault.list(req(), runtime);
  assert.equal(JSON.stringify(data).includes("http"), false);
  assert.equal(JSON.stringify(data).includes(canary), false);
});
test("unset retention is not immediate deletion permission", async () => {
  await assert.rejects(() => disposal.dispose(req(), cleanId, runtime));
});
test("legal hold blocks disposal and version protects concurrent hold changes", async () => {
  const id = await released();
  await retention(id);
  const doc = await row(id);
  await disposal.setHold(
    req(),
    id,
    {
      hold: true,
      reason: "LEGAL_ORDER",
      reference: randomUUID(),
      version: doc.version,
    },
    runtime,
  );
  await assert.rejects(() => disposal.dispose(req(), id, runtime));
  await assert.rejects(() =>
    disposal.setHold(
      req(),
      id,
      {
        hold: false,
        reason: "APPROVED_POLICY",
        reference: randomUUID(),
        version: doc.version,
      },
      runtime,
    ),
  );
});
test("step-up required for hold/disposal", async () => {
  await prisma.session.updateMany({
    where: { userId: "staff" },
    data: { mfaVerifiedAt: new Date(Date.now() - 10 * 60_000) },
  });
  await assert.rejects(async () =>
    disposal.setHold(
      req(),
      cleanId,
      {
        hold: true,
        reason: "LEGAL_ORDER",
        reference: randomUUID(),
        version: (await row(cleanId)).version,
      },
      runtime,
    ),
  );
  await prisma.session.updateMany({
    where: { userId: "staff" },
    data: { mfaVerifiedAt: new Date() },
  });
});
test("storage deletion failure is pending; access revoked, retry verifiable", async () => {
  const id = await released();
  await retention(id);
  const remove = runtime.storage.remove;
  runtime.storage.remove = async () => {
    throw new Error("SYNTHETIC_STORAGE_OUTAGE");
  };
  try {
    await assert.rejects(() => disposal.dispose(req(), id, runtime));
    assert.equal((await row(id)).disposalState, "PENDING");
    await assert.rejects(() => vault.access(req(), id, false, runtime));
  } finally {
    runtime.storage.remove = remove;
  }
  await disposal.dispose(req(), id, runtime);
  assert.equal((await row(id)).disposalState, "COMPLETED");
  for (const zone of ["quarantine", "released", "backup"] as const)
    assert.equal(await runtime.storage.exists(zone, id), false);
  assert.equal(
    (await prisma.vaultTombstone.findUniqueOrThrow({ where: { id } })).evidence,
    "ALL_REQUIRED_ZONES_ABSENT",
  );
});
test("a lying delete result cannot complete disposal", async () => {
  const id = await released();
  await retention(id);
  const remove = runtime.storage.remove;
  runtime.storage.remove = async () => {};
  try {
    await assert.rejects(() => disposal.dispose(req(), id, runtime));
    assert.equal((await row(id)).disposalState, "PENDING");
  } finally {
    runtime.storage.remove = remove;
  }
  await disposal.dispose(req(), id, runtime);
});
test("synthetic backup restore reconciles metadata + encrypted objects + integrity", async () => {
  const id = await released();
  const backupId = await recovery.backup(req(), "request", runtime);
  const target = await providers.createSyntheticRuntime();
  resources.push(target);
  await prisma.vaultDocument.delete({ where: { id } });
  const result = await recovery.restore(req(), backupId, runtime, target);
  assert.ok(result.restored >= 1);
  assert.equal((await row(id)).state, "RELEASED");
  assert.equal(
    await (await vault.access(req(), id, false, target)).text(),
    pdf().toString(),
  );
});
test("restore from old snapshot never resurrects disposed records, even after database tombstone loss", async () => {
  const id = await released();
  const backupId = await recovery.backup(req(), "request", runtime);
  await retention(id);
  await disposal.dispose(req(), id, runtime);
  await prisma.vaultTombstone.delete({ where: { id } });
  const target = await providers.createSyntheticRuntime();
  resources.push(target);
  const result = await recovery.restore(req(), backupId, runtime, target);
  assert.ok(result.skipped >= 1);
  assert.equal(await target.storage.exists("released", id), false);
  assert.ok(await prisma.vaultTombstone.findUnique({ where: { id } }));
});
test("tampered ciphertext fails integrity; no bytes delivered", async () => {
  const id = await released();
  const encrypted = await runtime.storage.get("released", id);
  await runtime.storage.remove("released", id);
  const object = JSON.parse(encrypted!.toString());
  object.payload = Buffer.alloc(100).toString("base64");
  await runtime.storage.put(
    "released",
    id,
    Buffer.from(JSON.stringify(object)),
  );
  await assert.rejects(() => vault.access(req(), id, false, runtime));
  await retention(id);
  await disposal.dispose(req(), id, runtime);
});
test("interrupted upload reconciles into inaccessible cancellation", async () => {
  const doc = await newIntent();
  await prisma.vaultDocument.update({
    where: { id: doc.id },
    data: { state: "UPLOADING", leaseUntil: new Date(0) },
  });
  await runtime.storage.put(
    "quarantine",
    doc.id,
    await providers.encrypt(runtime, pdf(), doc.id),
  );
  await vault.reconcile(req(), doc.id, runtime);
  assert.equal((await row(doc.id)).state, "CANCELLED");
  assert.equal(await runtime.storage.exists("quarantine", doc.id), false);
});
test("stale permissions/security version fail closed", async () => {
  await prisma.user.update({
    where: { id: "staff" },
    data: { securityVersion: { increment: 1 } },
  });
  await assert.rejects(() => vault.access(req(), cleanId, false, runtime));
  tokens.staff = await auth.createSession("staff", "WEBAUTHN");
  await prisma.session.updateMany({
    where: { userId: "staff" },
    data: { activeClientId: "one" },
  });
});
test("session revocation/replay rejected", async () => {
  const old = tokens.staff;
  await prisma.session.deleteMany({ where: { userId: "staff" } });
  await assert.rejects(() => vault.access(req(), cleanId, false, runtime));
  tokens.staff = await auth.createSession("staff", "WEBAUTHN");
  await prisma.session.updateMany({
    where: { userId: "staff" },
    data: { activeClientId: "one" },
  });
  assert.notEqual(tokens.staff, old);
});
test("inventory cookie cannot confer PK authority", async () => {
  const request = new Request("http://localhost:4321/api/vault", {
    headers: {
      cookie: `pk_inventory_session=${tokens.staff}`,
      "x-pk-client-context": "one",
    },
  });
  await assert.rejects(() => vault.access(request, cleanId, false, runtime));
});
test("no canary/file content in audit records", async () => {
  const logs = JSON.stringify(
    await prisma.auditLog.findMany({ where: { resource: "secure_vault" } }),
  );
  assert.equal(logs.includes(canary), false);
  assert.equal(logs.includes("%PDF"), false);
  assert.equal(logs.includes("filename"), false);
});
test("prohibited destinations rejected; no AI/email/Drive/Dropbox transports", () => {
  for (const destination of [
    "GOOGLE_DRIVE",
    "DROPBOX",
    "CHATGPT",
    "CLAUDE",
    "GEMINI",
    "PERPLEXITY",
    "ASK_PK",
    "MARKETING",
    "ANALYTICS",
    "EMAIL",
    "SMS",
    "DEVELOPMENT",
    "PREVIEW",
  ])
    assert.equal(providers.allowedDestination(destination), false);
  for (const file of ["service.ts", "backup.ts", "disposal.ts", "providers.ts"])
    assert.doesNotMatch(
      readFileSync(`src/lib/vault/${file}`, "utf8"),
      /nodemailer|anthropic|sendEmail|fetch\(/,
    );
});
test("PWA never caches Vault API/file bytes", () => {
  const sw = readFileSync("public/sw.js", "utf8");
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)\) return/);
  assert.match(sw, /url\.pathname\.startsWith\("\/_next\/static"\)/);
  assert.doesNotMatch(sw, /vault.*cache\.put/);
});
test("IDOR/not-found has identical public response and no canary in errors/logs", async () => {
  const messages: string[] = [];
  const old = console.error;
  console.error = (...args) => {
    messages.push(JSON.stringify(args));
  };
  try {
    const a = await api.GET(req("admin"), {
      params: Promise.resolve({ id: cleanId }),
    });
    const b = await api.GET(req("admin"), {
      params: Promise.resolve({ id: randomUUID() }),
    });
    assert.equal(a.status, b.status);
    assert.equal(await a.text(), await b.text());
    assert.equal(JSON.stringify(messages).includes(canary), false);
  } finally {
    console.error = old;
  }
});
test("production/preview cannot opt into mock scanner, storage or ephemeral key authority", async () => {
  for (const environment of ["production", "preview"]) {
    process.env.PK_ENVIRONMENT = environment;
    try {
      await assert.rejects(() => providers.vaultRuntime());
      await assert.rejects(() => providers.createSyntheticRuntime());
    } finally {
      process.env.PK_ENVIRONMENT = "test";
    }
  }
});
test("resource aliasing rejected, prefix alone not separation", () => {
  assert.throws(() =>
    providers.assertRuntime({
      ...runtime,
      storage: {
        ...runtime.storage,
        resources: {
          quarantine: "same",
          released: "same",
          backup: "backup",
          ledger: "ledger",
        },
      },
    }),
  );
});
test("intent audit failure rolls back metadata creation", async () => {
  const before = await prisma.vaultDocument.count();
  sqlite.exec(
    "CREATE TRIGGER vault_intent_failure BEFORE INSERT ON AuditLog WHEN NEW.resource = 'secure_vault' BEGIN SELECT RAISE(FAIL, 'synthetic unavailable'); END",
  );
  try {
    await assert.rejects(() => newIntent());
    assert.equal(await prisma.vaultDocument.count(), before);
  } finally {
    sqlite.exec("DROP TRIGGER vault_intent_failure");
  }
});
test("concurrent disposal is serialized, never falsely completes twice", async () => {
  const id = await released();
  await retention(id);
  const results = await Promise.allSettled([
    disposal.dispose(req(), id, runtime),
    disposal.dispose(req(), id, runtime),
  ]);
  assert.ok(results.some((result) => result.status === "fulfilled"));
  assert.equal((await row(id)).disposalState, "COMPLETED");
  assert.equal(
    await prisma.auditLog.count({
      where: {
        resourceId: id,
        metadata: JSON.stringify({ action: "DISPOSAL_COMPLETED" }),
      },
    }),
    1,
  );
});
test("storage read outage yields no confidential response", async () => {
  const get = runtime.storage.get;
  runtime.storage.get = async () => {
    throw new Error("SYNTHETIC_STORAGE_OUTAGE");
  };
  try {
    await assert.rejects(() => vault.access(req(), cleanId, false, runtime));
  } finally {
    runtime.storage.get = get;
  }
});
test("revoked capability affects current session immediately", async () => {
  const grant = await prisma.capabilityGrant.findFirstOrThrow({
    where: { userId: "staff", capability: "vault_read" },
  });
  await prisma.capabilityGrant.delete({ where: { id: grant.id } });
  await assert.rejects(() => vault.access(req(), cleanId, false, runtime));
  await prisma.capabilityGrant.create({ data: grant });
});
test("expired upload intent cannot be reused", async () => {
  const doc = await newIntent();
  await prisma.vaultDocument.update({
    where: { id: doc.id },
    data: { expiresAt: new Date(0) },
  });
  await assert.rejects(() =>
    vault.upload(req("staff", "one", pdf()), doc.id, runtime),
  );
  assert.equal(await runtime.storage.exists("quarantine", doc.id), false);
});
test("scan-time permission revocation prevents release", async () => {
  const id = (await newIntent()).id;
  const scanner = runtime.scanner;
  runtime.scanner = {
    async scan() {
      await prisma.capabilityGrant.deleteMany({
        where: { userId: "staff", capability: "vault_upload" },
      });
      return "clean";
    },
  };
  try {
    await assert.rejects(() =>
      vault.upload(req("staff", "one", pdf()), id, runtime),
    );
    assert.equal((await row(id)).state, "SCANNING");
    await assert.rejects(() => vault.access(req(), id, false, runtime));
  } finally {
    runtime.scanner = scanner;
    await prisma.capabilityGrant.create({
      data: {
        userId: "staff",
        capability: "vault_upload",
        scope: "REQUEST",
        clientId: "one",
        requestId: "request",
      },
    });
  }
});
test("audit outage after storage deletion remains pending and recoverable", async () => {
  const id = await released();
  await retention(id);
  sqlite.exec(
    "CREATE TRIGGER vault_disposal_failure BEFORE INSERT ON AuditLog WHEN NEW.metadata = '{\"action\":\"DISPOSAL_COMPLETED\"}' BEGIN SELECT RAISE(FAIL, 'synthetic unavailable'); END",
  );
  try {
    await assert.rejects(() => disposal.dispose(req(), id, runtime));
    assert.equal((await row(id)).disposalState, "PENDING");
    await assert.rejects(() => vault.access(req(), id, false, runtime));
  } finally {
    sqlite.exec("DROP TRIGGER vault_disposal_failure");
  }
  await disposal.dispose(req(), id, runtime);
  assert.equal((await row(id)).disposalState, "COMPLETED");
});
test("disposal ledger failure blocks deletion and remains pending", async () => {
  const id = await released();
  await retention(id);
  const put = runtime.storage.put;
  runtime.storage.put = async (zone, key, bytes) => {
    if (zone === "ledger") throw new Error("SYNTHETIC_LEDGER_OUTAGE");
    await put(zone, key, bytes);
  };
  try {
    await assert.rejects(() => disposal.dispose(req(), id, runtime));
    assert.equal((await row(id)).disposalState, "PENDING");
    assert.equal(await runtime.storage.exists("released", id), true);
  } finally {
    runtime.storage.put = put;
  }
  await disposal.dispose(req(), id, runtime);
});
test("fake successful storage copy cannot release a missing object", async () => {
  const doc = await newIntent();
  const put = runtime.storage.put;
  runtime.storage.put = async (zone, key, bytes) => {
    if (zone !== "released") await put(zone, key, bytes);
  };
  try {
    await assert.rejects(() =>
      vault.upload(req("staff", "one", pdf()), doc.id, runtime),
    );
    assert.equal((await row(doc.id)).state, "RELEASING");
    await assert.rejects(() => vault.access(req(), doc.id, false, runtime));
  } finally {
    runtime.storage.put = put;
  }
});
test("recovery integrity failure does not approve restored metadata", async () => {
  const backupId = await recovery.backup(req(), "request", runtime);
  const manifest = await runtime.storage.get("backup", backupId);
  await runtime.storage.remove("backup", backupId);
  await runtime.storage.put(
    "backup",
    backupId,
    Buffer.from("invalid ciphertext"),
  );
  const target = await providers.createSyntheticRuntime();
  resources.push(target);
  await assert.rejects(() =>
    recovery.restore(req(), backupId, runtime, target),
  );
  assert.deepEqual(await target.storage.keys("released"), []);
  assert.ok(manifest);
});
test("bounded JSON cannot allocate an unbounded payload", async () => {
  await assert.rejects(() =>
    policy.smallJson(
      new Request("http://localhost/api/vault", {
        method: "POST",
        body: JSON.stringify({ value: "x".repeat(5000) }),
      }),
    ),
  );
});
test("unknown/unapproved retention policy cannot authorize disposal", async () => {
  const id = await released();
  const doc = await row(id);
  await assert.rejects(() =>
    disposal.applyRetention(
      req(),
      id,
      {
        reference: randomUUID(),
        policyVersion: "UNAPPROVED",
        triggerAt: "2000-01-01T00:00:00.000Z",
        version: doc.version,
      },
      runtime,
    ),
  );
});
test("approved policy with unset period remains ineligible for disposal", async () => {
  const id = await released(),
    reference = randomUUID();
  await prisma.vaultRetentionPolicy.create({
    data: {
      id: reference,
      category: "BOOKKEEPING_SOURCE",
      policyVersion: "UNSET_SYNTHETIC",
      approved: true,
    },
  });
  await disposal.applyRetention(
    req(),
    id,
    {
      reference,
      policyVersion: "UNSET_SYNTHETIC",
      triggerAt: "2000-01-01T00:00:00.000Z",
      version: (await row(id)).version,
    },
    runtime,
  );
  assert.equal((await row(id)).disposalEligibleAt, null);
  await assert.rejects(() => disposal.dispose(req(), id, runtime));
});
test("disposal fence prevents stale processor from resurrecting bytes", async () => {
  const id = await released();
  await retention(id);
  const encrypted = await runtime.storage.get("released", id);
  await disposal.dispose(req(), id, runtime);
  for (const zone of ["released", "quarantine", "backup"] as const)
    await assert.rejects(() => runtime.storage.put(zone, id, encrypted!));
  assert.equal(await runtime.storage.exists("released", id), false);
  await assert.rejects(() => runtime.storage.remove("ledger", id));
});
test("anonymous object enumeration returns identical authentication denial", async () => {
  const existing = await api.GET(req("anonymous"), {
    params: Promise.resolve({ id: cleanId }),
  });
  const missing = await api.GET(req("anonymous"), {
    params: Promise.resolve({ id: randomUUID() }),
  });
  assert.equal(existing.status, 401);
  assert.equal(missing.status, 401);
  assert.equal(await existing.text(), await missing.text());
});
test("unmarked files cannot enter disposable synthetic storage", async () => {
  const bytes = pdf()
    .toString()
    .replace("PK_SYNTHETIC_VAULT_V1", "NO_APPROVED_FIXTURE_MARKER");
  const doc = await newIntent(Buffer.from(bytes));
  await assert.rejects(() =>
    vault.upload(req("staff", "one", Buffer.from(bytes)), doc.id, runtime),
  );
  assert.equal(await runtime.storage.exists("quarantine", doc.id), false);
  assert.equal(await runtime.storage.exists("released", doc.id), false);
});
