import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { authorize, audit } from "./authorization";
import {
  assertRuntime,
  encrypt,
  decrypt,
  vaultRuntime,
  type VaultRuntime,
} from "./providers";
const holdInput = z
  .object({
    hold: z.boolean(),
    reason: z.enum(["LEGAL_ORDER", "PRESERVATION_REQUEST", "APPROVED_POLICY"]),
    reference: z.string().uuid(),
    version: z.number().int().nonnegative(),
  })
  .strict();
const policyInput = z
  .object({
    reference: z.string().uuid(),
    policyVersion: z.string().regex(/^[A-Z0-9_.-]{1,32}$/),
    triggerAt: z.string().datetime(),
    version: z.number().int().nonnegative(),
  })
  .strict();
export async function setHold(
  request: Request,
  id: string,
  input: unknown,
  runtime?: VaultRuntime,
) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const parsed = holdInput.safeParse(input);
  if (!parsed.success) throw ApiError.badRequest("Invalid hold metadata");
  const data = parsed.data;
  return prisma.$transaction(async (tx) => {
    const doc = await tx.vaultDocument.findUnique({ where: { id } });
    if (!doc) throw ApiError.notFound();
    const user = await authorize(tx, request, doc, "legal_hold", true);
    // Hold/disposal races are serialized by version. No late hold may pretend to recover deleted bytes.
    if (doc.disposalState !== "NONE")
      throw ApiError.conflict("Disposal has started; security review required");
    const updated = await tx.vaultDocument.updateMany({
      where: { id, version: data.version, disposalState: "NONE" },
      data: {
        legalHold: data.hold,
        holdReference: data.hold ? data.reference : null,
        holdReason: data.hold ? data.reason : null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw ApiError.conflict();
    await audit(tx, user.id, doc, id, data.hold ? "HOLD_SET" : "HOLD_RELEASED");
  });
}
/** No legal period is assumed. Dates come from a separately approved, versioned policy authority. */
export async function applyRetention(
  request: Request,
  id: string,
  input: unknown,
  runtime?: VaultRuntime,
) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const parsed = policyInput.safeParse(input);
  if (!parsed.success || new Date(parsed.data.triggerAt) > new Date())
    throw ApiError.badRequest("Approved retention policy metadata required");
  const data = parsed.data;
  return prisma.$transaction(async (tx) => {
    const doc = await tx.vaultDocument.findUnique({ where: { id } });
    if (!doc) throw ApiError.notFound();
    const user = await authorize(tx, request, doc, "legal_hold", true);
    if (doc.disposalState !== "NONE") throw ApiError.conflict();
    const policy = await tx.vaultRetentionPolicy.findFirst({
      where: {
        id: data.reference,
        category: doc.retentionCategory,
        policyVersion: data.policyVersion,
        trigger: doc.retentionTrigger,
        approved: true,
      },
    });
    if (
      !policy ||
      (policy.durationDays !== null &&
        (!Number.isSafeInteger(policy.durationDays) || policy.durationDays < 0))
    )
      throw ApiError.forbidden("Approved retention policy is not configured");
    const trigger = new Date(data.triggerAt);
    const eligible =
      policy.durationDays === null
        ? null
        : new Date(trigger.getTime() + policy.durationDays * 86_400_000);
    const updated = await tx.vaultDocument.updateMany({
      where: { id, version: data.version, disposalState: "NONE" },
      data: {
        policyReference: data.reference,
        policyVersion: data.policyVersion,
        retentionTriggeredAt: trigger,
        disposalEligibleAt: eligible,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw ApiError.conflict();
    await audit(tx, user.id, doc, id, "RETENTION_POLICY_APPLIED");
  });
}
export async function dispose(
  request: Request,
  id: string,
  runtime?: VaultRuntime,
) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const doc = await prisma.vaultDocument.findUnique({ where: { id } });
  if (!doc) throw ApiError.notFound();
  await prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, doc, "disposal", true);
    const fresh = await tx.vaultDocument.findUniqueOrThrow({ where: { id } });
    if (
      fresh.legalHold ||
      !fresh.policyReference ||
      !fresh.policyVersion ||
      !fresh.retentionTriggeredAt ||
      !fresh.disposalEligibleAt ||
      fresh.disposalEligibleAt > new Date()
    )
      throw ApiError.forbidden("Hold or retention policy prevents disposal");
    if (fresh.disposalState === "COMPLETED") return;
    if (fresh.leaseUntil && fresh.leaseUntil > new Date())
      throw ApiError.conflict("Operation in progress");
    const updated = await tx.vaultDocument.updateMany({
      where: {
        id,
        version: fresh.version,
        legalHold: false,
        disposalState: { in: ["NONE", "PENDING", "REQUESTED"] },
      },
      data: {
        disposalState: "REQUESTED",
        disposalRequestedAt: fresh.disposalRequestedAt || new Date(),
        leaseUntil: new Date(Date.now() + 10 * 60_000),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw ApiError.conflict();
    await audit(tx, user.id, doc, id, "DISPOSAL_REQUESTED");
    // A durable tombstone precedes storage deletion. Restore must honor even pending disposals.
    await tx.vaultTombstone.upsert({
      where: { id },
      create: {
        id,
        clientId: doc.clientId,
        digest: doc.digest,
        disposedAt: new Date(),
        evidence: "DELETION_PENDING",
      },
      update: {},
    });
  });
  const fresh = await prisma.vaultDocument.findUniqueOrThrow({ where: { id } });
  if (fresh.disposalState === "COMPLETED") return;
  try {
    // Independent encrypted disposal ledger survives restoration of an older database/manifest.
    // Intent is sufficient to suppress restoration; pending disposal must not restore access.
    if (!(await runtime.storage.exists("ledger", id))) {
      const evidence = Buffer.from(
        JSON.stringify({
          id,
          clientId: doc.clientId,
          state: "DISPOSAL_REQUESTED",
        }),
      );
      await runtime.storage.put(
        "ledger",
        id,
        await encrypt(runtime, evidence, id),
      );
    }
    const ledger = await runtime.storage.get("ledger", id);
    if (!ledger) throw new Error("DISPOSAL_LEDGER_UNVERIFIED");
    const ledgerBytes = await decrypt(runtime, ledger, id);
    try {
      const entry = JSON.parse(ledgerBytes.toString());
      if (entry.id !== id || entry.clientId !== doc.clientId)
        throw new Error("DISPOSAL_LEDGER_INVALID");
    } finally {
      ledgerBytes.fill(0);
    }
    // Backup document objects are individually addressed, never embedded in immutable manifests.
    for (const zone of ["quarantine", "released", "backup"] as const) {
      await runtime.storage.remove(zone, id);
      if (await runtime.storage.exists(zone, id))
        throw new Error("DISPOSAL_UNVERIFIED");
    }
    await prisma.$transaction(async (tx) => {
      const user = await authorize(tx, request, doc, "disposal", true);
      const updated = await tx.vaultDocument.updateMany({
        where: { id, disposalState: "REQUESTED" },
        data: {
          state: "DISPOSED",
          disposalState: "COMPLETED",
          disposedAt: new Date(),
          leaseUntil: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw ApiError.conflict();
      await tx.vaultTombstone.update({
        where: { id },
        data: { evidence: "ALL_REQUIRED_ZONES_ABSENT", disposedAt: new Date() },
      });
      await audit(tx, user.id, doc, id, "DISPOSAL_COMPLETED");
    });
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.vaultDocument.updateMany({
        where: { id, disposalState: "REQUESTED" },
        data: {
          disposalState: "PENDING",
          leaseUntil: null,
          version: { increment: 1 },
        },
      });
      await audit(tx, null, doc, id, "DISPOSAL_PENDING");
    });
    throw error;
  }
}
