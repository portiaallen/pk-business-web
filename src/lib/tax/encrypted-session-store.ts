// PK Tax Division - encrypted persistent session storage adapter (v1.0).
// Replaces the synthetic in-memory session store whenever the owner has
// configured the restricted backend (PK_SESSION_ENC_KEY) and the repository's
// persisted session layer (DATABASE_URL) is available.
//
// Security posture (matches the intake architecture correction, 2026-10-16):
// - Only ciphertext is persisted. The full session JSON is sealed with
//   AES-256-GCM; the row carries no plaintext field whatsoever.
// - The intake screening (server-side reject-before-persistence) runs AGAIN
//   here as defense in depth before any write. A session that somehow carries
//   a sensitive identifier (SSN/ITIN/IP PIN/bank details) never reaches disk.
// - Fail-closed: without an owner-configured key this adapter refuses to run.
// - Tamper-evident: a modified row fails the GCM authentication check and is
//   surfaced as EncryptedSessionCorrupt, never silently decrypted.
"use strict";

if (typeof window !== "undefined") throw new Error("SERVER_ONLY_TAX_SESSION_STORE");

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { prisma, isDatabaseConfigured } from "@/lib/prisma";
import { rejectIfSensitive } from "@/lib/tax/intake-screen";
import { SENSITIVE_FIELDS, type Session } from "@/lib/tax/onboarding-core";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const SCRYPT_KEYLEN = 32;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export class SessionStoreMisconfigured extends Error {}
export class EncryptedSessionCorrupt extends Error {}
export class SensitiveSessionRejected extends Error {
  readonly findings: string[];
  constructor(findings: string[]) {
    super("sensitive data rejected before encrypted persistence");
    this.name = "SensitiveSessionRejected";
    this.findings = findings;
  }
}

export interface LoadedKey {
  key: Buffer;
  keyVersion: number;
}

export function loadSessionEncryptionKey(env: Partial<NodeJS.ProcessEnv> = process.env): LoadedKey {
  const raw = (env.PK_SESSION_ENC_KEY ?? "").trim();
  if (!raw) {
    throw new SessionStoreMisconfigured(
      "PK_SESSION_ENC_KEY is not configured; the encrypted session store refuses to run (fail-closed).",
    );
  }
  const versionRaw = (env.PK_SESSION_ENC_KEY_VERSION ?? "1").trim();
  const keyVersion = Number.parseInt(versionRaw, 10);
  if (!Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > 9999) {
    throw new SessionStoreMisconfigured("PK_SESSION_ENC_KEY_VERSION must be an integer between 1 and 9999.");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return { key: Buffer.from(raw, "hex"), keyVersion };
  }
  const salt = (env.PK_SESSION_ENC_SALT ?? "pk-tax-session-enc-v1").trim();
  return { key: scryptSync(raw.normalize("NFKC"), salt, SCRYPT_KEYLEN, SCRYPT_PARAMS), keyVersion };
}

// Defense-in-depth re-screening before persistence. The routes already run
// rejectIfSensitive on inbound payloads; this catches anything that could
// reach the store through another path. Never logs matched content.
function assertSessionPersistable(session: Session): void {
  const screen = rejectIfSensitive({ answers: session.answers, uploads: session.uploads });
  const findings = screen.allowed ? [] : screen.findings.map((f) => f.label);
  for (const key of Object.keys(session.answers)) {
    if (SENSITIVE_FIELDS.has(key)) findings.push(`sensitive field name: ${key}`);
  }
  if (findings.length > 0) throw new SensitiveSessionRejected(findings);
}

function seal(session: Session, loaded: LoadedKey): { nonce: string; ciphertext: string; authTag: string } {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, loaded.key, iv);
  const plaintext = Buffer.from(JSON.stringify(session), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    nonce: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function unseal(row: { nonce: string; ciphertext: string; authTag: string; keyVersion: number }, key: Buffer): Session {
  if (!row.nonce || !row.ciphertext || !row.authTag) {
    throw new EncryptedSessionCorrupt("stored session row is incomplete");
  }
  let decipher;
  try {
    decipher = createDecipheriv(ALGO, key, Buffer.from(row.nonce, "base64"));
    decipher.setAuthTag(Buffer.from(row.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(row.ciphertext, "base64")),
      decipher.final(),
    ]);
    const parsed = JSON.parse(plaintext.toString("utf8")) as Session;
    if (!parsed || typeof parsed !== "object" || typeof parsed.sessionId !== "string") {
      throw new EncryptedSessionCorrupt("decrypted payload is not a session");
    }
    return parsed;
  } catch (error) {
    if (error instanceof EncryptedSessionCorrupt) throw error;
    throw new EncryptedSessionCorrupt("encrypted session failed authentication or decryption");
  }
}

export const encryptedTaxSessionStore = {
  mode: "encrypted" as const,

  async put(session: Session): Promise<void> {
    assertSessionPersistable(session);
    const loaded = loadSessionEncryptionKey();
    const sealed = seal(session, loaded);
    await prisma.taxOnboardingSession.upsert({
      where: { sessionId: session.sessionId },
      update: {
        keyVersion: loaded.keyVersion,
        nonce: sealed.nonce,
        ciphertext: sealed.ciphertext,
        authTag: sealed.authTag,
      },
      create: {
        sessionId: session.sessionId,
        keyVersion: loaded.keyVersion,
        nonce: sealed.nonce,
        ciphertext: sealed.ciphertext,
        authTag: sealed.authTag,
      },
    });
  },

  async get(sessionId: string): Promise<Session | null> {
    const row = await prisma.taxOnboardingSession.findUnique({ where: { sessionId } });
    if (!row) return null;
    if (typeof row.keyVersion !== "number") throw new EncryptedSessionCorrupt("stored session row has no key version");
    const loaded = loadSessionEncryptionKey();
    if (row.keyVersion !== loaded.keyVersion) {
      throw new EncryptedSessionCorrupt(
        `stored session was sealed under key version ${row.keyVersion}, active key is version ${loaded.keyVersion}`,
      );
    }
    return unseal(row, loaded.key);
  },

  async delete(sessionId: string): Promise<void> {
    await prisma.taxOnboardingSession.deleteMany({ where: { sessionId } });
  },

  async reset(): Promise<void> {
    await prisma.taxOnboardingSession.deleteMany({});
  },
};

export function encryptedStoreReady(env: Partial<NodeJS.ProcessEnv> = process.env): boolean {
  if (!(env.PK_SESSION_ENC_KEY ?? "").trim()) return false;
  return isDatabaseConfigured();
}
