import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/api-error";
import { securityEnvironment } from "@/lib/security-environment";
import { safeOrigin } from "@/lib/url-privacy";
export const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: privateHeaders });
}
export function failure(error: unknown) {
  const response =
    error instanceof z.ZodError
      ? json({ error: "Check the required fields and permitted values" }, 400)
      : handleApiError(error);
  for (const [key, value] of Object.entries(privateHeaders))
    response.headers.set(key, value);
  return response;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  let expected = new URL(request.url).origin;
  if (["production", "preview"].includes(securityEnvironment())) {
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!configured)
      throw new ApiError(503, "Approved application origin is required");
    expected = safeOrigin(configured);
  }
  if (
    origin !== expected ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    throw ApiError.forbidden("Same-origin JSON request required");
}
export async function body(request: Request, limit = 65536): Promise<unknown> {
  sameOrigin(request);
  if (!request.body) throw ApiError.badRequest();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) throw ApiError.badRequest();
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    await reader.cancel().catch(() => {});
    throw ApiError.badRequest("Invalid bounded request");
  }
}
