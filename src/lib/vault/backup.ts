import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize, audit } from "./authorization";
import {
  assertRuntime,
  encrypt,
  decrypt,
  digest,
  vaultRuntime,
  type VaultRuntime,
} from "./providers";
import { ApiError } from "@/lib/api-error";
import { category, purpose, retentionCategory } from "./policy";
const snapshot = z.object({
  id: z.string().uuid(),
  clientId: z.string().min(1).max(64),
  requestId: z.string().min(1).max(64),
  createdBy: z.string().min(1).max(64),
  idempotencyKey: z.string().uuid(),
  purpose,
  category,
  classification: z.literal("CONFIDENTIAL_CLIENT"),
  highRisk: z.boolean(),
  taxInformation: z.boolean(),
  mimeType: z.enum(["application/pdf", "image/png", "image/jpeg"]),
  expectedSize: z.number().int().positive(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  retentionCategory,
  policyReference: z.string().uuid().nullable(),
  policyVersion: z.string().nullable(),
  retentionTrigger: z.literal("ENGAGEMENT_CLOSEOUT"),
  retentionTriggeredAt: z.string().datetime().nullable(),
  disposalEligibleAt: z.string().datetime().nullable(),
  legalHold: z.boolean(),
  holdReference: z.string().uuid().nullable(),
  holdReason: z.string().nullable(),
});
const manifestSchema = z.object({
  version: z.literal(1),
  clientId: z.string().min(1).max(64),
  documents: z.array(snapshot).max(1000),
});
/** Application-side manifest and reconciliation foundation, not provider backup certification. */
export async function backup(
  request: Request,
  requestId: string,
  runtime?: VaultRuntime,
) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const clientId = request.headers.get("x-pk-client-context") || "";
  const id = randomUUID();
  const scope = { clientId, requestId, highRisk: false, taxInformation: false };
  await prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, scope, "bulk_export", true);
    await tx.vaultBackup.create({ data: { id, clientId } });
    await audit(tx, user.id, scope, id, "BACKUP_STARTED");
  });
  // Serialization prevents disposal/permission changes from racing object copy. Slow providers
  // require a durable worker/lease implementation before production adapters are accepted.
  await prisma.$transaction(
    async (tx) => {
      const user = await authorize(tx, request, scope, "bulk_export", true);
      const docs = await tx.vaultDocument.findMany({
        where: {
          clientId,
          requestId,
          state: "RELEASED",
          disposalState: "NONE",
        },
      });
      const snapshots: z.infer<typeof snapshot>[] = [];
      for (const doc of docs) {
        await authorize(tx, request, doc, "bulk_export", true);
        if (
          (await tx.vaultTombstone.findUnique({ where: { id: doc.id } })) ||
          (await runtime.storage.exists("ledger", doc.id))
        )
          throw ApiError.conflict("Disposal ledger prevents backup");
        const encrypted = await runtime.storage.get("released", doc.id);
        if (!encrypted) throw new Error("BACKUP_SOURCE_MISSING");
        const bytes = await decrypt(runtime, encrypted, doc.id);
        try {
          if (digest(bytes) !== doc.digest)
            throw new Error("BACKUP_INTEGRITY_FAILURE");
        } finally {
          bytes.fill(0);
        }
        const existing = await runtime.storage.get("backup", doc.id);
        if (existing) {
          const previous = await decrypt(runtime, existing, doc.id);
          try {
            if (digest(previous) !== doc.digest)
              throw new Error("BACKUP_CONFLICT");
          } finally {
            previous.fill(0);
          }
        } else await runtime.storage.put("backup", doc.id, encrypted);
        const verifiedCopy = await runtime.storage.get("backup", doc.id);
        if (!verifiedCopy) throw new Error("BACKUP_COPY_UNVERIFIED");
        const recoveredCopy = await decrypt(runtime, verifiedCopy, doc.id);
        try {
          if (digest(recoveredCopy) !== doc.digest)
            throw new Error("BACKUP_COPY_CORRUPT");
        } finally {
          recoveredCopy.fill(0);
        }
        snapshots.push(
          snapshot.parse({
            ...doc,
            retentionTriggeredAt:
              doc.retentionTriggeredAt?.toISOString() ?? null,
            disposalEligibleAt: doc.disposalEligibleAt?.toISOString() ?? null,
          }),
        );
      }
      const manifest = Buffer.from(
        JSON.stringify({ version: 1, clientId, documents: snapshots }),
      );
      await runtime.storage.put(
        "backup",
        id,
        await encrypt(runtime, manifest, id),
      );
      const storedManifest = await runtime.storage.get("backup", id);
      if (!storedManifest) throw new Error("MANIFEST_WRITE_UNVERIFIED");
      const verifiedManifest = await decrypt(runtime, storedManifest, id);
      try {
        if (digest(verifiedManifest) !== digest(manifest))
          throw new Error("MANIFEST_WRITE_CORRUPT");
      } finally {
        verifiedManifest.fill(0);
      }
      await tx.vaultBackup.update({
        where: { id },
        data: { state: "COMPLETE", digest: digest(manifest) },
      });
      await audit(tx, user.id, scope, id, "BACKUP_COMPLETED");
    },
    { timeout: 30_000 },
  );
  return id;
}
/** Restoration requires the independent disposal ledger, not just an old database snapshot. */
export async function restore(
  request: Request,
  backupId: string,
  source: VaultRuntime,
  target: VaultRuntime,
) {
  assertRuntime(source);
  assertRuntime(target);
  const record = await prisma.vaultBackup.findUnique({
    where: { id: backupId },
  });
  if (!record || record.state !== "COMPLETE") throw ApiError.notFound();
  const encryptedManifest = await source.storage.get("backup", backupId);
  if (!encryptedManifest) throw new Error("BACKUP_MANIFEST_MISSING");
  const bytes = await decrypt(source, encryptedManifest, backupId);
  let manifest: z.infer<typeof manifestSchema>;
  try {
    if (digest(bytes) !== record.digest)
      throw new Error("MANIFEST_INTEGRITY_FAILURE");
    manifest = manifestSchema.parse(JSON.parse(bytes.toString()));
  } finally {
    bytes.fill(0);
  }
  if (manifest.clientId !== record.clientId) throw ApiError.forbidden();
  // Persist the attempted restore before external writes. An audit outage cannot start restoration.
  await prisma.$transaction(async (tx) => {
    for (const doc of manifest.documents) {
      if (doc.clientId !== record.clientId) throw ApiError.forbidden();
      const user = await authorize(tx, request, doc, "vault_upload", true);
      const grants = await tx.capabilityGrant.findMany({
        where: { userId: user.id, capability: "security", scope: "GLOBAL" },
      });
      if (!grants.length) throw ApiError.forbidden();
      await audit(tx, user.id, doc, doc.id, "RESTORE_STARTED");
    }
  });
  let restored = 0,
    skipped = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const doc of manifest.documents) {
        if (doc.clientId !== record.clientId) throw ApiError.forbidden();
        const user = await authorize(tx, request, doc, "vault_upload", true);
        const grants = await tx.capabilityGrant.findMany({
          where: { userId: user.id, capability: "security", scope: "GLOBAL" },
        });
        if (!grants.length) throw ApiError.forbidden();
        const tombstone = await tx.vaultTombstone.findUnique({
          where: { id: doc.id },
        });
        const ledger = await source.storage.get("ledger", doc.id);
        if (tombstone || ledger) {
          if (ledger) {
            const evidence = await decrypt(source, ledger, doc.id);
            try {
              const entry = JSON.parse(evidence.toString());
              if (entry.id !== doc.id || entry.clientId !== doc.clientId)
                throw new Error("DISPOSAL_LEDGER_INVALID");
            } finally {
              evidence.fill(0);
            }
            // Carry independent tombstones into a recovered database, without resurrecting content.
            await tx.vaultTombstone.upsert({
              where: { id: doc.id },
              create: {
                id: doc.id,
                clientId: doc.clientId,
                digest: doc.digest,
                disposedAt: new Date(),
                evidence: "RESTORED_DISPOSAL_LEDGER",
              },
              update: {},
            });
          }
          if (!(await target.storage.exists("ledger", doc.id))) {
            const evidence = Buffer.from(
              JSON.stringify({
                id: doc.id,
                clientId: doc.clientId,
                state: "DISPOSAL_REQUESTED",
              }),
            );
            await target.storage.put(
              "ledger",
              doc.id,
              await encrypt(target, evidence, doc.id),
            );
          }
          if (!(await target.storage.exists("ledger", doc.id)))
            throw new Error("RESTORE_LEDGER_UNVERIFIED");
          if (await target.storage.exists("released", doc.id)) {
            await target.storage.remove("released", doc.id);
            if (await target.storage.exists("released", doc.id))
              throw new Error("RESTORE_DISPOSAL_UNVERIFIED");
          }
          await audit(tx, user.id, doc, doc.id, "RESTORE_TOMBSTONE_SKIPPED");
          skipped++;
          continue;
        }
        const current = await tx.vaultDocument.findUnique({
          where: { id: doc.id },
        });
        if (
          current &&
          (current.disposalState !== "NONE" ||
            current.state !== "RELEASED" ||
            current.clientId !== doc.clientId ||
            current.requestId !== doc.requestId ||
            current.digest !== doc.digest)
        )
          throw ApiError.conflict("Restore conflicts with current metadata");
        if (current)
          await authorize(tx, request, current, "vault_upload", true);
        const encrypted = await source.storage.get("backup", doc.id);
        if (!encrypted) throw new Error("BACKUP_OBJECT_MISSING");
        const content = await decrypt(source, encrypted, doc.id);
        try {
          if (
            digest(content) !== doc.digest ||
            content.length !== doc.expectedSize
          )
            throw new Error("RESTORE_INTEGRITY_FAILURE");
          if (await target.storage.exists("released", doc.id)) {
            const existing = await target.storage.get("released", doc.id);
            const recovered = await decrypt(target, existing!, doc.id);
            try {
              if (digest(recovered) !== doc.digest)
                throw new Error("RESTORE_TARGET_CONFLICT");
            } finally {
              recovered.fill(0);
            }
          } else
            await target.storage.put(
              "released",
              doc.id,
              await encrypt(target, content, doc.id),
            );
        } finally {
          content.fill(0);
        }
        const restoredObject = await target.storage.get("released", doc.id);
        if (!restoredObject) throw new Error("RESTORE_WRITE_UNVERIFIED");
        const verified = await decrypt(target, restoredObject, doc.id);
        try {
          if (digest(verified) !== doc.digest)
            throw new Error("RESTORE_WRITE_CORRUPT");
        } finally {
          verified.fill(0);
        }
        if (!current)
          await tx.vaultDocument.create({
            data: {
              ...doc,
              state: "RELEASED",
              expiresAt: new Date(),
              releasedAt: new Date(),
              retentionTriggeredAt: doc.retentionTriggeredAt
                ? new Date(doc.retentionTriggeredAt)
                : null,
              disposalEligibleAt: doc.disposalEligibleAt
                ? new Date(doc.disposalEligibleAt)
                : null,
            },
          });
        await audit(tx, user.id, doc, doc.id, "DOCUMENT_RESTORED");
        restored++;
      }
      await tx.vaultBackup.update({
        where: { id: backupId },
        data: { restoredAt: new Date() },
      });
    },
    { timeout: 30_000 },
  );
  return { restored, skipped };
}
