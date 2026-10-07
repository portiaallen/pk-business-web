import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { authorize, audit } from "./authorization";
import {
  intentInput,
  validateFile,
  boundedBytes,
  SYNTHETIC_MARKER,
} from "./policy";
import {
  assertRuntime,
  encrypt,
  decrypt,
  digest,
  vaultRuntime,
  type VaultRuntime,
} from "./providers";
import type { VaultDocument } from "@/generated/prisma/client";

export const vaultHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};
export function publicMetadata(doc: VaultDocument) {
  return {
    id: doc.id,
    version: doc.version,
    classifications: [
      "CONFIDENTIAL_CLIENT",
      ...(doc.highRisk ? ["HIGH_RISK_CLIENT_DATA"] : []),
      ...(doc.taxInformation ? ["TAX_RETURN_INFORMATION"] : []),
    ],
    canView: ["image/png", "image/jpeg"].includes(doc.mimeType),
    requestId: doc.requestId,
    category: doc.category,
    purpose: doc.purpose,
    highRisk: doc.highRisk,
    taxInformation: doc.taxInformation,
    state: doc.state,
    legalHold: doc.legalHold,
    disposalState: doc.disposalState,
    retentionCategory: doc.retentionCategory,
    createdAt: doc.createdAt,
  };
}
async function document(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw ApiError.notFound();
  const doc = await prisma.vaultDocument.findUnique({ where: { id } });
  if (!doc) throw ApiError.notFound();
  return doc;
}
export async function createIntent(
  request: Request,
  input: unknown,
  runtime?: VaultRuntime,
) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const parsed = intentInput.safeParse(input);
  if (!parsed.success)
    throw ApiError.badRequest(
      "Invalid document purpose, classification, type or size",
    );
  const data = parsed.data;
  const clientId = request.headers.get("x-pk-client-context") || "";
  const scope = { ...data, clientId };
  return prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, scope, "vault_upload");
    const existing = await tx.vaultDocument.findUnique({
      where: {
        createdBy_idempotencyKey: {
          createdBy: user.id,
          idempotencyKey: data.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (
        existing.clientId !== clientId ||
        existing.requestId !== data.requestId ||
        existing.purpose !== data.purpose ||
        existing.category !== data.category ||
        existing.highRisk !== data.highRisk ||
        existing.taxInformation !== data.taxInformation ||
        existing.expectedSize !== data.size ||
        existing.mimeType !== data.mimeType ||
        existing.retentionCategory !== data.retentionCategory
      )
        throw ApiError.conflict("Upload intent differs from original request");
      return publicMetadata(existing);
    }
    // Bound pending work; no unlimited anonymous or authenticated object creation.
    const pending = await tx.vaultDocument.count({
      where: {
        clientId,
        state: {
          in: ["INTENT", "UPLOADING", "PENDING", "SCANNING", "RELEASING"],
        },
      },
    });
    if (pending >= 50) throw new ApiError(429, "Pending upload limit reached");
    const doc = await tx.vaultDocument.create({
      data: {
        id: randomUUID(),
        clientId,
        requestId: data.requestId,
        createdBy: user.id,
        idempotencyKey: data.idempotencyKey,
        purpose: data.purpose,
        category: data.category,
        highRisk: data.highRisk,
        taxInformation: data.taxInformation,
        expectedSize: data.size,
        mimeType: data.mimeType,
        retentionCategory: data.retentionCategory,
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    });
    await audit(tx, user.id, doc, doc.id, "UPLOAD_INTENT");
    return publicMetadata(doc);
  });
}
export async function upload(
  request: Request,
  id: string,
  runtime?: VaultRuntime,
) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const doc = await document(id);
  await prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, doc, "vault_upload");
    if (doc.createdBy !== user.id) throw ApiError.forbidden();
    const locked = await tx.vaultDocument.updateMany({
      where: {
        id,
        version: doc.version,
        state: "INTENT",
        expiresAt: { gt: new Date() },
        disposalState: "NONE",
      },
      data: {
        state: "UPLOADING",
        leaseUntil: new Date(Date.now() + 10 * 60_000),
        version: { increment: 1 },
      },
    });
    if (locked.count !== 1)
      throw ApiError.conflict("Upload already claimed or expired");
    await audit(tx, user.id, doc, id, "UPLOAD_STARTED");
  });
  try {
    if (request.headers.get("content-type") !== doc.mimeType)
      throw ApiError.badRequest("Upload type does not match intent");
    // Only extension is accepted transiently; original filename never reaches database/storage/audit.
    const bytes = await boundedBytes(request, doc.expectedSize);
    validateFile(
      bytes,
      doc.mimeType,
      request.headers.get("x-vault-extension") || "",
    );
    if (runtime.synthetic && !bytes.includes(Buffer.from(SYNTHETIC_MARKER))) {
      bytes.fill(0);
      throw ApiError.badRequest(
        "Only designated synthetic Vault fixtures are permitted",
      );
    }
    const checksum = digest(bytes);
    await runtime.storage.put(
      "quarantine",
      id,
      await encrypt(runtime, bytes, id),
    );
    bytes.fill(0);
    await prisma.$transaction(async (tx) => {
      const user = await authorize(tx, request, doc, "vault_upload");
      const moved = await tx.vaultDocument.updateMany({
        where: { id, state: "UPLOADING", disposalState: "NONE" },
        data: {
          state: "PENDING",
          digest: checksum,
          uploadedAt: new Date(),
          leaseUntil: null,
          version: { increment: 1 },
        },
      });
      if (moved.count !== 1) throw ApiError.conflict();
      await audit(tx, user.id, doc, id, "UPLOAD_COMPLETED");
    });
  } catch (error) {
    // Keep encrypted remnants visible for reconciliation if delete/audit/storage fails.
    await prisma.$transaction(async (tx) => {
      await tx.vaultDocument.updateMany({
        where: { id, state: "UPLOADING" },
        data: {
          state: "UPLOAD_FAILED",
          leaseUntil: null,
          version: { increment: 1 },
        },
      });
      await audit(tx, null, doc, id, "UPLOAD_FAILED");
    });
    throw error;
  }
  return processDocument(request, id, runtime);
}
export async function processDocument(
  request: Request,
  id: string,
  runtime?: VaultRuntime,
) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const doc = await document(id);
  await prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, doc, "vault_upload");
    const locked = await tx.vaultDocument.updateMany({
      where: {
        id,
        version: doc.version,
        state: { in: ["PENDING", "SCAN_FAILED"] },
        disposalState: "NONE",
      },
      data: {
        state: "SCANNING",
        leaseUntil: new Date(Date.now() + 10 * 60_000),
        version: { increment: 1 },
      },
    });
    if (locked.count !== 1)
      throw ApiError.conflict("Document is not eligible for scanning");
    await audit(tx, user.id, doc, id, "SCAN_STARTED");
  });
  let state = "SCAN_FAILED";
  try {
    const encrypted = await runtime.storage.get("quarantine", id);
    if (!encrypted) throw new Error("QUARANTINE_MISSING");
    const bytes = await decrypt(runtime, encrypted, id);
    try {
      if (digest(bytes) !== doc.digest) throw new Error("DIGEST_MISMATCH");
      const result = await runtime.scanner.scan(bytes, doc.mimeType);
      state =
        result === "clean"
          ? "CLEAN"
          : result === "rejected"
            ? "REJECTED"
            : "REQUIRES_REVIEW";
    } finally {
      bytes.fill(0);
    }
  } catch {
    state = "SCAN_FAILED";
  }
  await prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, doc, "vault_upload");
    const moved = await tx.vaultDocument.updateMany({
      where: { id, state: "SCANNING", disposalState: "NONE" },
      data: { state, leaseUntil: null, version: { increment: 1 } },
    });
    if (moved.count !== 1) throw ApiError.conflict();
    await audit(tx, user.id, doc, id, `SCAN_${state}`);
  });
  if (state === "CLEAN") await release(request, id, runtime);
  return publicMetadata(await document(id));
}
export async function release(
  request: Request,
  id: string,
  runtime?: VaultRuntime,
) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const doc = await document(id);
  await prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, doc, "vault_upload");
    const claimed = await tx.vaultDocument.updateMany({
      where: {
        id,
        version: doc.version,
        state: "CLEAN",
        disposalState: "NONE",
      },
      data: {
        state: "RELEASING",
        leaseUntil: new Date(Date.now() + 10 * 60_000),
        version: { increment: 1 },
      },
    });
    if (claimed.count !== 1)
      throw ApiError.conflict("Only verified clean documents may be released");
    await audit(tx, user.id, doc, id, "RELEASE_STARTED");
  });
  const encrypted = await runtime.storage.get("quarantine", id);
  if (!encrypted) throw new Error("QUARANTINE_MISSING");
  const bytes = await decrypt(runtime, encrypted, id);
  try {
    if (digest(bytes) !== doc.digest) throw new Error("DIGEST_MISMATCH");
  } finally {
    bytes.fill(0);
  }
  // An interrupted release is reconciled explicitly; never treat a copy as approved just because it exists.
  await runtime.storage.put("released", id, encrypted);
  const releasedCopy = await runtime.storage.get("released", id);
  if (!releasedCopy || digest(releasedCopy) !== digest(encrypted))
    throw new Error("RELEASE_COPY_UNVERIFIED");
  await runtime.storage.remove("quarantine", id);
  if (await runtime.storage.exists("quarantine", id))
    throw new Error("QUARANTINE_DELETE_UNVERIFIED");
  await prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, doc, "vault_upload");
    const moved = await tx.vaultDocument.updateMany({
      where: { id, state: "RELEASING", disposalState: "NONE" },
      data: {
        state: "RELEASED",
        releasedAt: new Date(),
        leaseUntil: null,
        version: { increment: 1 },
      },
    });
    if (moved.count !== 1) throw ApiError.conflict();
    await audit(tx, user.id, doc, id, "RELEASE_COMPLETED");
  });
}
export async function access(
  request: Request,
  id: string,
  view = false,
  runtime?: VaultRuntime,
): Promise<Response> {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const doc = await document(id);
  await prisma.$transaction((tx) => authorize(tx, request, doc));
  if (doc.state !== "RELEASED" || doc.disposalState !== "NONE")
    throw ApiError.notFound();
  if (view && !["image/png", "image/jpeg"].includes(doc.mimeType))
    throw ApiError.badRequest("This document requires a controlled download");
  const encrypted = await runtime.storage.get("released", id);
  if (!encrypted) throw ApiError.notFound();
  const bytes = await decrypt(runtime, encrypted, id);
  try {
    if (digest(bytes) !== doc.digest) throw new Error("DIGEST_MISMATCH");
    await prisma.$transaction(async (tx) => {
      const user = await authorize(tx, request, doc);
      const fresh = await tx.vaultDocument.findUnique({ where: { id } });
      if (
        !fresh ||
        fresh.state !== "RELEASED" ||
        fresh.disposalState !== "NONE" ||
        fresh.version !== doc.version ||
        (await tx.vaultTombstone.findUnique({ where: { id } }))
      )
        throw ApiError.notFound();
      await audit(
        tx,
        user.id,
        doc,
        id,
        view ? "DOCUMENT_VIEW" : "DOCUMENT_DOWNLOAD",
      );
    });
    // Copy only after mandatory audit commit. No stream starts before authorization and audit succeed.
    const extension =
      doc.mimeType === "application/pdf"
        ? "pdf"
        : doc.mimeType === "image/png"
          ? "png"
          : "jpg";
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...vaultHeaders,
        "Content-Type": doc.mimeType,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${view ? "inline" : "attachment"}; filename="secure-document.${extension}"`,
      },
    });
  } finally {
    bytes.fill(0);
  }
}
export async function list(request: Request, runtime?: VaultRuntime) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const clientId = request.headers.get("x-pk-client-context") || "";
  const requestId = new URL(request.url).searchParams.get("requestId") || "";
  const scope = { clientId, requestId, highRisk: false, taxInformation: false };
  return prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, scope);
    const docs = await tx.vaultDocument.findMany({
      where: { clientId, requestId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const allowed: VaultDocument[] = [];
    for (const doc of docs) {
      try {
        await authorize(tx, request, doc);
        allowed.push(doc);
      } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 403)
          throw error;
      }
    }
    await audit(tx, user.id, scope, null, "DOCUMENT_LIST");
    return allowed.map(publicMetadata);
  });
}
/** No scanner or storage outage silently approves a file. Reconciliation closes stalled work. */
export async function reconcile(
  request: Request,
  id: string,
  runtime?: VaultRuntime,
) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const doc = await document(id);
  await prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, doc, "vault_upload", true);
    if (doc.leaseUntil && doc.leaseUntil > new Date())
      throw ApiError.conflict("Operation is still in progress");
    if (
      ![
        "INTENT",
        "UPLOADING",
        "UPLOAD_FAILED",
        "SCANNING",
        "RELEASING",
        "RECONCILING",
      ].includes(doc.state)
    )
      throw ApiError.conflict();
    const updated = await tx.vaultDocument.updateMany({
      where: { id, version: doc.version },
      data: {
        state: "RECONCILING",
        leaseUntil: new Date(Date.now() + 10 * 60_000),
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw ApiError.conflict();
    await audit(tx, user.id, doc, id, "RECONCILIATION_STARTED");
  });
  // Stalled uploads/releases must restart with a new intent; unsafe intermediate copies are removed.
  for (const zone of ["quarantine", "released"] as const) {
    await runtime.storage.remove(zone, id);
    if (await runtime.storage.exists(zone, id))
      throw new Error("CLEANUP_UNVERIFIED");
  }
  await prisma.$transaction(async (tx) => {
    const user = await authorize(tx, request, doc, "vault_upload", true);
    await tx.vaultDocument.update({
      where: { id },
      data: { state: "CANCELLED", leaseUntil: null, version: { increment: 1 } },
    });
    await audit(tx, user.id, doc, id, "RECONCILIATION_COMPLETED");
  });
}
export async function engagements(request: Request, runtime?: VaultRuntime) {
  runtime ??= await vaultRuntime();
  assertRuntime(runtime);
  const clientId = request.headers.get("x-pk-client-context") || "";
  return prisma.$transaction(async (tx) => {
    const candidates = await tx.verificationRequest.findMany({
      where: { clientId },
      select: { id: true, service: { select: { shortName: true } } },
      take: 100,
    });
    const result: { id: string; label: string }[] = [];
    for (const candidate of candidates) {
      try {
        await authorize(tx, request, {
          clientId,
          requestId: candidate.id,
          highRisk: false,
          taxInformation: false,
        });
        result.push({ id: candidate.id, label: candidate.service.shortName });
      } catch (error) {
        if (!(error instanceof ApiError) || error.statusCode !== 403)
          throw error;
      }
    }
    if (!result.length) throw ApiError.forbidden();
    return result;
  });
}
