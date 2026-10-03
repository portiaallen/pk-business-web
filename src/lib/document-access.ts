import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import type { SessionUser } from "@/lib/auth";
/** Interim containment. Capability-based grants follow in Phase 1B. */
export async function requireDocumentRequestAccess(user: SessionUser, requestId: string): Promise<void> {
  const scope = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { assignedStaffId: true, client: { select: { status: true } } },
  });
  if (!scope || scope.client.status !== "ACTIVE" ||
      !(user.role === "ADMIN" || (user.role === "STAFF" && scope.assignedStaffId === user.id))) {
    throw ApiError.notFound("Document not found");
  }
}
