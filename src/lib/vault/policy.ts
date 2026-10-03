import { z } from "zod";
import { ApiError } from "@/lib/api-error";
export const SYNTHETIC_MARKER = "PK_SYNTHETIC_VAULT_V1";
export const MAX_BYTES = 10 * 1024 * 1024;
export const purpose = z.enum([
  "REQUIRED_ENGAGEMENT_RECORD",
  "APPROVED_COMPLIANCE_COPY",
  "VENDOR_UNAVAILABLE_HANDOFF",
]);
export const category = z.enum([
  "BOOKKEEPING",
  "TAX",
  "IDENTITY",
  "AUTHORIZATION",
  "OTHER_CONFIDENTIAL",
]);
export const retentionCategory = z.enum([
  "ENGAGEMENT",
  "BOOKKEEPING_SOURCE",
  "TAX_SOURCE",
  "AUTHORIZATION",
  "COMPLIANCE",
]);
export const intentInput = z
  .object({
    requestId: z.string().min(1).max(64),
    idempotencyKey: z.string().uuid(),
    purpose,
    category,
    retentionCategory,
    highRisk: z.boolean(),
    taxInformation: z.boolean(),
    mimeType: z.enum(["application/pdf", "image/png", "image/jpeg"]),
    size: z.number().int().positive().max(MAX_BYTES),
  })
  .strict()
  .superRefine((v, ctx) => {
    // Conservative minimum classification; callers may classify any category as high risk/tax.
    if (
      ["TAX", "IDENTITY", "AUTHORIZATION"].includes(v.category) &&
      !v.highRisk
    )
      ctx.addIssue({
        code: "custom",
        message: "High-risk classification required",
      });
    if (v.category === "TAX" && !v.taxInformation)
      ctx.addIssue({
        code: "custom",
        message: "Tax-information classification required",
      });
  });
export function validateFile(bytes: Buffer, mime: string, extension: string) {
  if (!bytes.length || bytes.length > MAX_BYTES)
    throw ApiError.badRequest("File size is not allowed");
  const ext = extension.toLowerCase();
  if (
    mime === "application/pdf" &&
    ext === "pdf" &&
    bytes.subarray(0, 5).toString() === "%PDF-" &&
    /%%EOF\s*$/.test(bytes.toString("latin1"))
  )
    return;
  if (
    mime === "image/png" &&
    ext === "png" &&
    bytes.length >= 45 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.subarray(12, 16).toString() === "IHDR" &&
    bytes.subarray(-8, -4).toString() === "IEND"
  )
    return;
  if (
    mime === "image/jpeg" &&
    ["jpg", "jpeg"].includes(ext) &&
    bytes.length >= 10 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes.subarray(-2).equals(Buffer.from([255, 217]))
  )
    return;
  throw ApiError.badRequest("File bytes, type and extension do not agree");
}
export async function boundedBytes(
  request: Request,
  expected: number,
): Promise<Buffer> {
  const length = Number(request.headers.get("content-length"));
  if (
    !request.body ||
    !Number.isSafeInteger(length) ||
    length !== expected ||
    length > MAX_BYTES
  )
    throw ApiError.badRequest("A bounded file size is required");
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.length;
      if (total > expected || total > MAX_BYTES)
        throw ApiError.badRequest("File exceeds upload intent");
      chunks.push(Buffer.from(part.value));
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  if (total !== expected) throw ApiError.badRequest("Upload is incomplete");
  return Buffer.concat(chunks);
}
export async function smallJson(request: Request): Promise<unknown> {
  if (!request.body) throw ApiError.badRequest();
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) throw ApiError.badRequest("Request too large");
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    await reader.cancel().catch(() => {});
    throw ApiError.badRequest("Invalid bounded request");
  }
}
