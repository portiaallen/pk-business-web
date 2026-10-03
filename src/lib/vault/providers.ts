// Server-only entry points; Node crypto/fs intentionally cannot enter browser bundles.
if (typeof window !== "undefined") throw new Error("SERVER_ONLY_VAULT");
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
  createHash,
} from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  unlink,
  readdir,
  mkdtemp,
} from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { securityEnvironment } from "@/lib/security-environment";
import { ApiError } from "@/lib/api-error";

export type Zone = "quarantine" | "released" | "backup" | "ledger";
/** Implementations must provide private, distinct resources; no public or signed URLs. */
export interface PrivateStorage {
  readonly resources: Record<Zone, string>;
  /** Content writes must atomically reject keys present in the independent disposal ledger. */
  put(zone: Zone, key: string, encrypted: Buffer): Promise<void>;
  get(zone: Zone, key: string): Promise<Buffer | null>;
  remove(zone: Zone, key: string): Promise<void>;
  exists(zone: Zone, key: string): Promise<boolean>;
  keys(zone: Zone): Promise<string[]>;
}
export interface KeyProvider {
  /** KEKs stay outside the database/object store. Production adapters require separate key authority. */
  wrap(key: Buffer): Promise<{ reference: string; wrapped: string }>;
  unwrap(reference: string, wrapped: string): Promise<Buffer>;
}
export interface Scanner {
  scan(
    bytes: Buffer,
    mime: string,
  ): Promise<"clean" | "rejected" | "requires_review">;
}
export interface VaultRuntime {
  storage: PrivateStorage;
  keys: KeyProvider;
  scanner: Scanner;
  synthetic: boolean;
}
export function digest(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}
function seal(key: Buffer, bytes: Buffer, aad: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}
function open(key: Buffer, bytes: Buffer, aad: string): Buffer {
  if (bytes.length < 28) throw new Error("VAULT_INTEGRITY_FAILURE");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
}
export async function encrypt(
  runtime: VaultRuntime,
  bytes: Buffer,
  id: string,
): Promise<Buffer> {
  const dek = randomBytes(32);
  try {
    const { reference, wrapped } = await runtime.keys.wrap(dek);
    // Wrapped DEK is ciphertext, not a plaintext key. Authenticated payload is bound to opaque ID.
    return Buffer.from(
      JSON.stringify({
        version: 1,
        reference,
        wrapped,
        payload: seal(dek, bytes, id).toString("base64"),
      }),
    );
  } finally {
    dek.fill(0);
  }
}
export async function decrypt(
  runtime: VaultRuntime,
  encrypted: Buffer,
  id: string,
): Promise<Buffer> {
  const envelope = JSON.parse(encrypted.toString());
  if (
    envelope.version !== 1 ||
    typeof envelope.reference !== "string" ||
    typeof envelope.wrapped !== "string" ||
    typeof envelope.payload !== "string"
  )
    throw new Error("VAULT_ENVELOPE_INVALID");
  const dek = await runtime.keys.unwrap(envelope.reference, envelope.wrapped);
  try {
    return open(dek, Buffer.from(envelope.payload, "base64"), id);
  } finally {
    dek.fill(0);
  }
}
export function syntheticAllowed(): boolean {
  return (
    !process.env.VERCEL &&
    process.env.NODE_ENV !== "production" &&
    ["test", "development"].includes(securityEnvironment()) &&
    process.env.PK_VAULT_SYNTHETIC === "true" &&
    process.env.PK_ALLOW_SYNTHETIC_SETUP === "true"
  );
}
function requireSynthetic() {
  if (!syntheticAllowed())
    throw new ApiError(503, "Secure Vault is not enabled in this environment");
}
/** Test-only mock. This is NOT a malware scanner, and can never be selected in production/preview. */
export class SyntheticScanner implements Scanner {
  async scan(bytes: Buffer): Promise<"clean" | "rejected" | "requires_review"> {
    requireSynthetic();
    if (bytes.includes(Buffer.from("SYNTHETIC_SCANNER_OUTAGE")))
      throw new Error("SCANNER_UNAVAILABLE");
    if (bytes.includes(Buffer.from("SYNTHETIC_REVIEW")))
      return "requires_review";
    return bytes.includes(Buffer.from("SYNTHETIC_MALWARE"))
      ? "rejected"
      : "clean";
  }
}
/** Disposable resources only. Each zone is a separate directory/resource, not an object-key prefix. */
export async function createSyntheticRuntime(): Promise<VaultRuntime> {
  requireSynthetic();
  const parent = process.env.PK_VAULT_SYNTHETIC_ROOT || tmpdir();
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const roots = await Promise.all(
    ["quarantine", "released", "backup", "ledger"].map((z) =>
      mkdtemp(join(parent, `pk-vault-synthetic-${z}-`)),
    ),
  );
  const resources: Record<Zone, string> = {
    quarantine: roots[0],
    released: roots[1],
    backup: roots[2],
    ledger: roots[3],
  };
  const path = (zone: Zone, key: string) => {
    requireSynthetic();
    if (!/^[a-f0-9-]{36}$/.test(key)) throw new Error("OPAQUE_KEY_REQUIRED");
    return join(resources[zone], key);
  };
  // Synthetic single-process fencing. Production implementations must provide durable,
  // distributed conditional writes; a process mutex is not a production lock service.
  const pending = new Map<string, Promise<void>>();
  async function serialize(key: string, operation: () => Promise<void>) {
    const previous = pending.get(key) || Promise.resolve();
    let unlock!: () => void;
    const held = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    const tail = previous.then(() => held);
    pending.set(key, tail);
    await previous;
    try {
      await operation();
    } finally {
      unlock();
      if (pending.get(key) === tail) pending.delete(key);
    }
  }
  const storage: PrivateStorage = {
    resources,
    async put(zone, key, bytes) {
      await serialize(key, async () => {
        const target = path(zone, key);
        if (zone !== "ledger" && (await storage.exists("ledger", key)))
          throw new Error("DISPOSAL_FENCE");
        await mkdir(resources[zone], { recursive: true, mode: 0o700 });
        await writeFile(target, bytes, { mode: 0o600, flag: "wx" });
      });
    },
    async get(zone, key) {
      try {
        return await readFile(path(zone, key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async remove(zone, key) {
      if (zone === "ledger") throw new Error("DISPOSAL_LEDGER_IMMUTABLE");
      await serialize(key, async () => {
        try {
          await unlink(path(zone, key));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
      });
    },
    async exists(zone, key) {
      return (await storage.get(zone, key)) !== null;
    },
    async keys(zone) {
      requireSynthetic();
      return readdir(resources[zone]);
    },
  };
  // Process-only key authority. Never persisted beside objects or in ordinary PK database.
  // Restart recovery is intentionally unsupported by this disposable test adapter.
  const kek = randomBytes(32),
    reference = randomUUID();
  const keys: KeyProvider = {
    async wrap(key) {
      requireSynthetic();
      return {
        reference,
        wrapped: seal(kek, key, reference).toString("base64"),
      };
    },
    async unwrap(ref, wrapped) {
      requireSynthetic();
      if (ref !== reference) throw new Error("KEY_AUTHORITY_UNAVAILABLE");
      return open(kek, Buffer.from(wrapped, "base64"), reference);
    },
  };
  return { storage, keys, scanner: new SyntheticScanner(), synthetic: true };
}
let instance: Promise<VaultRuntime> | undefined;
export async function vaultRuntime(): Promise<VaultRuntime> {
  requireSynthetic();
  // No approved production provider is registered. Environment flags cannot manufacture approval.
  return (instance ??= createSyntheticRuntime());
}
export function assertRuntime(runtime: VaultRuntime) {
  requireSynthetic();
  const resources = Object.values(runtime.storage.resources).map((r) =>
    resolve(r),
  );
  if (
    !runtime.synthetic ||
    new Set(resources).size !== 4 ||
    resources.some((a, i) =>
      resources.some((b, j) => i !== j && a.startsWith(b + sep)),
    )
  )
    throw new ApiError(503, "Vault resource isolation is not configured");
}
export function allowedDestination(destination: string): boolean {
  // No external sharing/export adapter exists. Backup is restricted to the encrypted boundary.
  return (
    destination === "VAULT_BROKER" || destination === "ENCRYPTED_VAULT_BACKUP"
  );
}
