import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user) throw ApiError.unauthorized();

    const membership = await prisma.clientMember.findFirst({
      where: { userId: user.id },
    });
    if (!membership) throw ApiError.forbidden();

    const req = await prisma.verificationRequest.findUnique({
      where: { id },
      include: {
        service: { select: { name: true, shortName: true } },
        documents: {
          select: {
            id: true,
            fileName: true,
            category: true,
            uploadStatus: true,
            reviewStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        documentRequests: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            required: true,
          },
          orderBy: { createdAt: "desc" },
        },
        clientMessages: {
          include: {
            author: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        deliverables: {
          select: {
            id: true,
            title: true,
            fileName: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        assignedStaff: {
          select: { name: true },
        },
      },
    });

    if (!req || req.clientId !== membership.clientId) {
      throw ApiError.notFound("Request not found");
    }

    return NextResponse.json({
      id: req.id,
      service: req.service.name,
      status: req.status,
      requestType: req.requestType,
      clientNotes: req.clientNotes,
      assignedStaff: req.assignedStaff?.name || null,
      submittedAt: req.submittedAt?.toISOString() || null,
      completedAt: req.completedAt?.toISOString() || null,
      createdAt: req.createdAt.toISOString(),
      updatedAt: req.updatedAt.toISOString(),
      documents: req.documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        category: d.category,
        uploadStatus: d.uploadStatus,
        reviewStatus: d.reviewStatus,
        createdAt: d.createdAt.toISOString(),
      })),
      documentRequests: req.documentRequests.map((dr) => ({
        id: dr.id,
        title: dr.title,
        description: dr.description,
        status: dr.status,
        required: dr.required,
      })),
      messages: req.clientMessages.map((m) => ({
        id: m.id,
        body: m.body,
        isFromStaff: m.isFromStaff,
        authorName: m.author.name,
        createdAt: m.createdAt.toISOString(),
      })),
      deliverables: req.deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        fileName: d.fileName,
        createdAt: d.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
