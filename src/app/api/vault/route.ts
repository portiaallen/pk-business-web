import { authenticateVaultRequest } from "@/lib/vault/http";
import {
  createIntent,
  list,
  engagements,
  vaultHeaders,
} from "@/lib/vault/service";
import { smallJson } from "@/lib/vault/policy";
import { handleApiError } from "@/lib/api-error";
import { denyAudit } from "@/lib/vault/authorization";
async function failure(request: Request, error: unknown) {
  try {
    await denyAudit(request);
  } catch {
    return Response.json(
      { error: "Secure audit unavailable" },
      { status: 503, headers: vaultHeaders },
    );
  }
  const response = handleApiError(error);
  for (const [key, value] of Object.entries(vaultHeaders))
    response.headers.set(key, value);
  return response;
}
export async function GET(request: Request) {
  try {
    await authenticateVaultRequest(request);
    return Response.json(
      new URL(request.url).searchParams.has("requestId")
        ? { documents: await list(request), synthetic: true }
        : { engagements: await engagements(request), synthetic: true },
      { headers: vaultHeaders },
    );
  } catch (error) {
    return failure(request, error);
  }
}
export async function POST(request: Request) {
  try {
    await authenticateVaultRequest(request);
    if (Number(request.headers.get("content-length")) > 4096)
      return Response.json(
        { error: "Request too large" },
        { status: 413, headers: vaultHeaders },
      );
    return Response.json(
      await createIntent(request, await smallJson(request)),
      { status: 201, headers: vaultHeaders },
    );
  } catch (error) {
    return failure(request, error);
  }
}
