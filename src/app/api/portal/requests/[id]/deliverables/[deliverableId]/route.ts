import { forbidNetlifyPayload } from "@/lib/ordinary-transfer/provider";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  requireAuthContext,
} from "@/lib/auth";
import { getObject } from "@/lib/storage";
import { ApiError, handleApiError } from "@/lib/api-error";

/**
 * Secure client deliverable download.
 *
 * Authorization happens BEFORE any byte is streamed, and every failure is a
 * uniform 404 (cross-tenant, draft, and unknown IDs are indistinguishable):
 *  1. Valid session + active client membership
 *  2. Request/deliverable pair matches and belongs to the caller's tenant
 *  3. Deliverable visibility is RELEASED (drafts never leave the building)
 * Storage keys are never exposed; content streams with private, no-store headers.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; deliverableId: string }> }
) {
  try {
    const { id, deliverableId } = await params;
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const deliverable = await prisma.deliverable.findUnique({
      where: { id: deliverableId },
      include: { request: { select: { clientId: true } } },
    });

    if (
      !deliverable ||
      deliverable.requestId !== id ||
      deliverable.request.clientId !== ctx.clientId ||
      deliverable.visibility !== "RELEASED" || deliverable.transferDeleteState !== "NONE"
    ) {
      throw ApiError.notFound("Deliverable not found");
    }

    forbidNetlifyPayload();
    const data = await getObject(deliverable.storageKey);
    if (!data) throw ApiError.notFound("Deliverable not found");

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": deliverable.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(deliverable.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
