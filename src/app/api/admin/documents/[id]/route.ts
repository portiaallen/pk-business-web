import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  getSessionUser,
  hasRole,
} from "@/lib/auth";
import { getObject } from "@/lib/storage";
import { ApiError, handleApiError } from "@/lib/api-error";

/** Securely download an uploaded client document for admin or staff. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const { id } = await params;
    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        fileName: true,
        mimeType: true,
        storageKey: true,
        uploadStatus: true,
        retentionStatus: true,
      },
    });
    if (
      !document ||
      document.uploadStatus !== "UPLOADED" ||
      document.retentionStatus === "DELETED"
    ) {
      throw ApiError.notFound("Document not found");
    }

    const data = await getObject(document.storageKey);
    if (!data) throw ApiError.notFound("Document content missing");

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
