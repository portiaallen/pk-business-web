import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 storage backend (S3-compatible).
 * Selected behind the src/lib/storage.ts abstraction — the rest of the
 * document system (authorization, tenant scoping, validation, audit) is
 * untouched. Objects are private; all access flows through the app's
 * authorized API endpoints (no public URLs, no presigned-URL exposure).
 */

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY =
  process.env.R2_SECRET_ACCESS_KEY || process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET_NAME;

let client: S3Client | null = null;

/** Only construct the client when R2 env vars are present (all of them). */
export function isR2Configured(): boolean {
  return Boolean(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET);
}

function getClient(): S3Client {
  if (!client) {
    if (!isR2Configured()) {
      throw new Error(
        "R2 storage is not configured. Required env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME"
      );
    }
    client = new S3Client({
      region: "auto",
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ACCESS_KEY_ID!,
        secretAccessKey: SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export async function r2Put(key: string, data: Buffer, contentType?: string): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: BUCKET!,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );
}

export async function r2Get(key: string): Promise<Buffer | null> {
  try {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: BUCKET!, Key: key })
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    if (name === "NoSuchKey" || name === "NotFound") return null;
    throw err;
  }
}

export async function r2Delete(key: string): Promise<void> {
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: BUCKET!, Key: key })
    );
  } catch {
    // already gone — fine
  }
}
