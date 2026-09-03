import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  requireAuthContext,
  requireMemberWriteContext,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireAuthContext(token);

    const requests = await prisma.verificationRequest.findMany({
      where: { clientId: ctx.clientId },
      include: { service: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(
      requests.map((r) => ({
        id: r.id,
        title: r.requestType || r.service.name,
        service: r.service.name,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const ctx = await requireMemberWriteContext(token);

    const body = await request.json();
    const serviceSlug = typeof body.serviceSlug === "string" ? body.serviceSlug : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!serviceSlug) throw ApiError.badRequest("Service is required");
    if (!description) throw ApiError.badRequest("Description is required");

    // Only ACTIVE services may be selected — a client cannot manipulate the
    // payload to pick an inactive/unreleased service from the catalog.
    const service = await prisma.service.findFirst({
      where: { slug: serviceSlug, status: "ACTIVE" },
    });
    if (!service) throw ApiError.badRequest("Invalid service");

    const req = await prisma.verificationRequest.create({
      data: {
        // Always derived from session membership — never from request body
        clientId: ctx.clientId,
        serviceId: service.id,
        requestType: service.name,
        status: "SUBMITTED",
        clientNotes: description,
        requesterName: ctx.user.name,
        requesterEmail: ctx.user.email,
        submittedAt: new Date(),
      },
      include: { service: { select: { name: true } } },
    });

    await prisma.auditLog.create({
      data: {
        actorId: ctx.user.id,
        clientId: ctx.clientId,
        action: "REQUEST_CREATED",
        resource: "verification_request",
        resourceId: req.id,
        metadata: JSON.stringify({ service: service.name }),
      },
    });

    return NextResponse.json({ id: req.id, status: req.status });
  } catch (error) {
    return handleApiError(error);
  }
}
