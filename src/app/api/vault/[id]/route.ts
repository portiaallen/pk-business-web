import { authenticateVaultRequest } from "@/lib/vault/http";
import {
  access,
  upload,
  processDocument,
  reconcile,
  vaultHeaders,
} from "@/lib/vault/service";
import { setHold, applyRetention, dispose } from "@/lib/vault/disposal";
import { denyAudit } from "@/lib/vault/authorization";
import { smallJson } from "@/lib/vault/policy";
import { ApiError, handleApiError } from "@/lib/api-error";
type Context = { params: Promise<{ id: string }> };
async function failure(request: Request, error: unknown) {
  try {
    await denyAudit(request);
  } catch {
    return Response.json(
      { error: "Secure audit unavailable" },
      { status: 503, headers: vaultHeaders },
    );
  }
  // Prevent IDOR enumeration: nonexistent and unauthorized identifiers disclose no object metadata.
  const normalized =
    error instanceof ApiError && [403, 404].includes(error.statusCode)
      ? ApiError.notFound()
      : error;
  const response = handleApiError(normalized);
  for (const [key, value] of Object.entries(vaultHeaders))
    response.headers.set(key, value);
  return response;
}
export async function PUT(request: Request, context: Context) {
  try {
    await authenticateVaultRequest(request);
    return Response.json(await upload(request, (await context.params).id), {
      headers: vaultHeaders,
    });
  } catch (error) {
    return failure(request, error);
  }
}
export async function GET(request: Request, context: Context) {
  try {
    await authenticateVaultRequest(request);
    return await access(
      request,
      (await context.params).id,
      new URL(request.url).searchParams.get("view") === "true",
    );
  } catch (error) {
    return failure(request, error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    await authenticateVaultRequest(request);
    if (Number(request.headers.get("content-length")) > 4096)
      throw ApiError.badRequest();
    const body = await smallJson(request);
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw ApiError.badRequest();
    const { action, ...input } = body as Record<string, unknown>;
    const { id } = await context.params;
    if (action === "hold") await setHold(request, id, input);
    else if (action === "retention") await applyRetention(request, id, input);
    else if (action === "dispose") await dispose(request, id);
    else if (action === "retry-scan") await processDocument(request, id);
    else if (action === "reconcile") await reconcile(request, id);
    else throw ApiError.badRequest();
    return Response.json({ success: true }, { headers: vaultHeaders });
  } catch (error) {
    return failure(request, error);
  }
}
