import { safeAuditMetadata } from "@/lib/security-log";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { readDeleteId, requireAdminForDelete } from "@/lib/admin-delete";

export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();

    const services = await prisma.service.findMany({
      include: {
        _count: { select: { verificationRequests: true } },
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(
      services.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        shortDescription: s.shortDescription,
        priceDisplay: s.priceDisplay,
        status: s.status,
        requestCount: s._count.verificationRequests,
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE — remove a service from the catalog (ADMIN only). Body: { id }.
 * Refused while requests or invoices still reference it (SetNull would blur
 * what past engagements were sold as) — deactivate instead if needed.
 */
export async function DELETE(request: Request) {
  try {
    await requireAdminForDelete(request);
    const id = await readDeleteId(request);

    const service = await prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        _count: { select: { verificationRequests: true, invoices: true } },
      },
    });
    if (!service) throw ApiError.notFound("Service not found");

    const refCount = service._count.verificationRequests + service._count.invoices;
    if (refCount > 0) {
      throw ApiError.conflict(
        `${service.name} is used by ${service._count.verificationRequests} request(s) and ${service._count.invoices} invoice(s). Set it INACTIVE instead of deleting it.`
     );
    }

    await prisma.service.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "ADMIN_ACTION",
        resource: "service",
        resourceId: id,
        metadata: safeAuditMetadata({ action: "SERVICE_DELETED", name: service.name }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
