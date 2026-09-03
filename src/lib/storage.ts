import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { isR2Configured, r2Put, r2Get, r2Delete } from "@/lib/storage-r2";

// ─── Storage configuration ────────────────────────────────────────────────────
// Local filesystem storage. Storage keys are tenant-scoped by construction:
//   clients/<clientId>/<requestId>/<uuid>-<safeName>
// The clientId component is ALWAYS derived from the authenticated session,
// never from browser input. Storage keys are never exposed to clients —
// downloads are streamed through an authorized API endpoint.

const STORAGE_ROOT = process.env.STORAGE_DIR || path.join(process.cwd(), ".storage");

/**
 * Backend selection: if R2 env vars are fully configured, use R2 (persistent,
 * multi-instance safe). Otherwise fall back to local filesystem (dev only).
 * Production deployments MUST set the R2 vars — there is no silent weak
 * fallback in the auth layer, and storage behaves the same way by convention:
 * document this in the deploy checklist.
 */
function useR2(): boolean {
  if (isR2Configured()) return true;

  // Fail closed: never silently write client documents to the local
  // filesystem in production, and fail loudly when S3 storage was
  // explicitly requested but is missing required env vars.
  const provider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  const inProduction = process.env.NODE_ENV === "production";
  if (inProduction || provider === "s3") {
    throw new Error(
      "Document storage is not configured for this environment. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME (or the legacy S3_* equivalents) before enabling document uploads."
    );
  }
  return false;
}

/** Allowed upload MIME types for client documents */
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
]);

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/** Sanitize a user-supplied filename to a safe storage component. */
export function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return base || "file";
}

/** Build a tenant-scoped storage key. clientId MUST come from session membership. */
export function buildStorageKey(
  clientId: string,
  requestId: string,
  originalName: string
): string {
  return `clients/${clientId}/${requestId}/${randomUUID()}-${sanitizeFileName(originalName)}`;
}

function resolveSafe(storageKey: string): string {
  const full = path.resolve(STORAGE_ROOT, storageKey);
  if (!full.startsWith(path.resolve(STORAGE_ROOT) + path.sep)) {
    throw new Error("INVALID_STORAGE_KEY");
  }
  return full;
}

export async function putObject(
  storageKey: string,
  data: Buffer,
  contentType?: string
): Promise<void> {
  if (useR2()) {
    await r2Put(storageKey, data, contentType);
    return;
  }
  const full = resolveSafe(storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
}

export async function getObject(storageKey: string): Promise<Buffer | null> {
  if (useR2()) {
    return r2Get(storageKey);
  }
  try {
    return await readFile(resolveSafe(storageKey));
  } catch {
    return null;
  }
}

export async function deleteObject(storageKey: string): Promise<void> {
  if (useR2()) {
    await r2Delete(storageKey);
    return;
  }
  try {
    await unlink(resolveSafe(storageKey));
  } catch {
    // already gone — fine
  }
}
