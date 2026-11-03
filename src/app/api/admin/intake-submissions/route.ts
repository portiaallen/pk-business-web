import { requireAdminApiAccess } from "@/lib/admin-access";
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
import { serviceOptions } from "@/content/services";
import {
  canTransitionFulfillmentStatus,
  isClarityFulfillmentStatus,
} from "@/lib/clarity-fulfillment";

function serviceLabel(slug: string): string {
  return serviceOptions.find((o) => o.value === slug)?.label ?? slug;
}

/** GET — list consultation submissions (newest first) for the admin portal. */
export async function GET(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const submissions = await prisma.intakeSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(
      submissions.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        phone: s.phone,
        businessName: s.businessName,
        service: serviceLabel(s.serviceSlug),
        description: s.description,
        contactMethod: s.contactMethod,
        processed: s.processed,
        sourceChannel: s.sourceChannel,
        questionnaireVersion: s.questionnaireVersion,
        questionnaireJson: s.questionnaireJson,
        fulfillmentStatus: s.fulfillmentStatus,
        assignedToUserId: s.assignedToUserId,
        createdAt: s.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — permanently remove a consultation submission (ADMIN only). */
export async function DELETE(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const admin = await requireAdminForDelete(request);
    const id = await readDeleteId(request);

    const existing = await prisma.intakeSubmission.findUnique({
      where: { id },
      select: { id: true, email: true },
    });
    if (!existing) throw ApiError.notFound("Submission not found");

    // A submission promoted to a purchased Readiness Assessment is anchored to
    // it by a Restrict FK (financial record): deleting it can never succeed, so
    // say so instead of surfacing a raw 500.
    const assessment = await prisma.readinessAssessment.findUnique({
      where: { intakeSubmissionId: id },
      select: { id: true },
    });
    if (assessment)
      throw ApiError.conflict(
        "This submission is tied to a purchased readiness assessment and cannot be deleted."
      );

    await prisma.intakeSubmission.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        action: "ADMIN_ACTION",
        resource: "intake_submission",
        resourceId: id,
        metadata: safeAuditMetadata({
          action: "INTAKE_SUBMISSION_DELETED",
          email: existing.email,
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH — mark a submission processed/unprocessed. */
export async function PATCH(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const body = (await request.json().catch(() => null)) as {
      id?: string;
      processed?: boolean;
      fulfillmentStatus?: string;
      assignedToUserId?: string | null;
    } | null;
    if (!body?.id) {
      throw ApiError.badRequest("id is required");
    }

    const existing = await prisma.intakeSubmission.findUnique({
      where: { id: body.id },
      select: { id: true, fulfillmentStatus: true },
    });
    if (!existing) throw ApiError.notFound("Submission not found");

    const data: Record<string, unknown> = {};

    if (typeof body.processed === "boolean") {
      data.processed = body.processed;
    }

    if (body.fulfillmentStatus !== undefined) {
      if (!isClarityFulfillmentStatus(body.fulfillmentStatus)) {
        throw ApiError.badRequest(
          `Invalid fulfillmentStatus. Valid: new | in_review | awaiting_client | fulfilled`
        );
      }
      if (
        body.fulfillmentStatus !== existing.fulfillmentStatus &&
        !canTransitionFulfillmentStatus(existing.fulfillmentStatus, body.fulfillmentStatus)
      ) {
        throw ApiError.conflict(
          `Cannot move a fulfilled submission back to ${body.fulfillmentStatus}. Reopen to in_review first.`
        );
      }
      data.fulfillmentStatus = body.fulfillmentStatus;
    }

    if (body.assignedToUserId !== undefined) {
      if (body.assignedToUserId === null || body.assignedToUserId === "") {
        data.assignedToUserId = null;
      } else if (typeof body.assignedToUserId === "string") {
        const assignee = await prisma.user.findUnique({
          where: { id: body.assignedToUserId },
          select: { id: true, role: true },
        });
        if (!assignee || !hasRole(assignee, "ADMIN", "STAFF")) {
          throw ApiError.badRequest("Assignee must be an existing ADMIN or STAFF user");
        }
        data.assignedToUserId = assignee.id;
      }
    }

    if (Object.keys(data).length === 0) {
      throw ApiError.badRequest("Nothing to update");
    }

    const updated = await prisma.intakeSubmission.update({
      where: { id: body.id },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      processed: updated.processed,
      fulfillmentStatus: updated.fulfillmentStatus,
      assignedToUserId: updated.assignedToUserId,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
