import { requireAdminApiAccess } from "@/lib/admin-access";
import { safeAuditMetadata } from "@/lib/security-log";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getSessionTokenFromRequest, hasRole } from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { QB_CHECKLIST_TEMPLATE } from "@/lib/qb-checklist-template";

/**
 * QB Cleanup — Initial Review API.
 * ADMIN/STAFF only. Client users can never reach these endpoints.
 * All data is scoped by the VerificationRequest (which belongs to a Client tenant).
 */

async function requireStaff(request: Request) {
  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);
  if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();
  return user;
}

function serializeItem(item: {
  id: string;
  status: string;
  notes: string | null;
  isFollowUp: boolean;
  isDocumentationNeeded: boolean;
  isCompleted: boolean;
  notApplicable: boolean;
}) {
  return {
    id: item.id,
    status: item.status,
    notes: item.notes ?? "",
    isFollowUp: item.isFollowUp,
    isDocumentationNeeded: item.isDocumentationNeeded,
    isCompleted: item.isCompleted,
    notApplicable: item.notApplicable,
  };
}

/** GET /api/admin/requests/[id]/qb-review — load or lazily create the review */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const user = await requireStaff(request);

    const req = await prisma.verificationRequest.findUnique({
      where: { id },
      select: {
        id: true, clientId: true, requestType: true, service: true, status: true,
        client: { select: { id: true, name: true } },
      },
    });
    if (!req) throw ApiError.notFound("Request not found");

    let review = await prisma.qbCleanupReview.findUnique({
      where: { requestId: id },
      include: {
        reviewer: { select: { id: true, name: true } },
        checklists: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
        findings: { orderBy: { createdAt: "desc" } },
        questions: { orderBy: { createdAt: "desc" } },
        docLogs: { orderBy: { createdAt: "desc" } },
      },
    });

    // Lazily instantiate the review + full checklist from the template
    if (!review) {
      review = await prisma.qbCleanupReview.create({
        data: {
          requestId: id,
          reviewerId: user.id,
          status: "NOT_STARTED",
          notes: "",
          checklists: {
            create: QB_CHECKLIST_TEMPLATE.flatMap((cat, ci) =>
              cat.items.map((item, ii) => ({
                category: cat.category,
                itemKey: item.key,
                title: item.title,
                description: item.description ?? null,
                sortOrder: ci * 1000 + ii,
              }))
            ),
          },
        },
        include: {
          reviewer: { select: { id: true, name: true } },
          checklists: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
          findings: { orderBy: { createdAt: "desc" } },
          questions: { orderBy: { createdAt: "desc" } },
          docLogs: { orderBy: { createdAt: "desc" } },
        },
      });

      // Checklist items: create one state row per checklist definition
      await prisma.qbCleanupChecklistItem.createMany({
        data: review.checklists.map((c) => ({
          checklistId: c.id,
          reviewId: review!.id,
        })),
      });

      review = await prisma.qbCleanupReview.findUnique({
        where: { requestId: id },
        include: {
          reviewer: { select: { id: true, name: true } },
          checklists: { orderBy: [{ category: "asc" }, { sortOrder: "asc" }] },
          findings: { orderBy: { createdAt: "desc" } },
          questions: { orderBy: { createdAt: "desc" } },
          docLogs: { orderBy: { createdAt: "desc" } },
        },
      })!;
    }

    const activeReview = review!;
    if (!activeReview) throw ApiError.notFound("Review could not be created");

    // Attach item state to each checklist definition
    const items = await prisma.qbCleanupChecklistItem.findMany({
      where: { reviewId: activeReview.id },
    });
    const itemByChecklist = new Map(items.map((i) => [i.checklistId, i]));

    const categories: {
      category: string;
      items: ((typeof activeReview.checklists)[number] & { state?: ReturnType<typeof serializeItem> })[];
    }[] = [];
    for (const c of activeReview.checklists) {
      let cat = categories.find((x) => x.category === c.category);
      if (!cat) {
        cat = { category: c.category, items: [] };
        categories.push(cat);
      }
      (cat.items as unknown[]).push({
        ...c,
        state: itemByChecklist.has(c.id)
          ? serializeItem(itemByChecklist.get(c.id)!)
          : undefined,
      });
    }

    const totalItems = activeReview.checklists.length;
    const completed = items.filter(
      (i) => i.isCompleted || i.notApplicable
    ).length;
    const counts = {
      critical: items.filter((i) => i.status === "CRITICAL").length,
      needsInvestigation: items.filter((i) => i.status === "NEEDS_INVESTIGATION").length,
      cleanup: items.filter((i) => i.status === "CLEANUP").length,
      followUp: items.filter((i) => i.isFollowUp).length,
      documentationNeeded: items.filter((i) => i.isDocumentationNeeded).length,
    };
    const openQuestions = activeReview.questions.filter((q) => q.status !== "RESOLVED").length;

    return NextResponse.json({
      id: activeReview.id,
      status: activeReview.status,
      reviewer: activeReview.reviewer,
      notes: activeReview.notes ?? "",
      completedAt: activeReview.completedAt?.toISOString() ?? null,
      createdAt: activeReview.createdAt.toISOString(),
      updatedAt: activeReview.updatedAt.toISOString(),
      categories,
      findings: activeReview.findings,
      questions: activeReview.questions,
      docLogs: activeReview.docLogs,
      progress: {
        totalItems,
        completed,
        percent: totalItems === 0 ? 0 : Math.round((completed / totalItems) * 100),
      },
      counts: { ...counts, openQuestions },
      request: {
        id: req.id,
        clientName: req.client.name,
        requestType: req.requestType,
        service: req.service,
        status: req.status,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH — update review (status, notes) or a checklist item / finding / question / docLog */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const user = await requireStaff(request);

    const review = await prisma.qbCleanupReview.findUnique({
      where: { requestId: id },
    });
    if (!review) throw ApiError.notFound("Review not found");

    const body = await request.json();

    // Review-level update
    if (body.reviewStatus) {
      const valid = ["NOT_STARTED", "IN_PROGRESS", "READY_FOR_CLEANUP", "ON_HOLD", "COMPLETED"];
      if (!valid.includes(body.reviewStatus)) throw ApiError.badRequest("Invalid review status");
      const updated = await prisma.qbCleanupReview.update({
        where: { id: review.id },
        data: {
          status: body.reviewStatus,
          completedAt: body.reviewStatus === "COMPLETED" ? new Date() : null,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          clientId: (await prisma.verificationRequest.findUnique({ where: { id }, select: { clientId: true } }))?.clientId ?? null,
          action: "ADMIN_ACTION",
          resource: "qb_review",
          resourceId: review.id,
          metadata: safeAuditMetadata({ action: "review_status_changed", newStatus: body.reviewStatus }),
        },
      });

      return NextResponse.json({ id: updated.id, status: updated.status });
    }

    if (typeof body.notes === "string" && !body.itemId) {
      await prisma.qbCleanupReview.update({
        where: { id: review.id },
        data: { notes: body.notes },
      });
      return NextResponse.json({ saved: true });
    }

    // Checklist item update (autosave)
    if (body.itemId) {
      const item = await prisma.qbCleanupChecklistItem.findUnique({
        where: { id: body.itemId },
      });
      if (!item || item.reviewId !== review.id) throw ApiError.notFound("Item not found");

      const data: Record<string, unknown> = {};
      if (typeof body.isCompleted === "boolean") data.isCompleted = body.isCompleted;
      if (typeof body.notApplicable === "boolean") data.notApplicable = body.notApplicable;
      if (typeof body.isFollowUp === "boolean") data.isFollowUp = body.isFollowUp;
      if (typeof body.isDocumentationNeeded === "boolean") data.isDocumentationNeeded = body.isDocumentationNeeded;
      if (typeof body.notes === "string") data.notes = body.notes;
      if (typeof body.status === "string") {
        const validStatuses = ["NOT_REVIEWED", "REVIEWED", "LOOKS_GOOD", "NEEDS_INVESTIGATION", "CLEANUP", "CRITICAL", "NOT_APPLICABLE"];
        if (!validStatuses.includes(body.status)) throw ApiError.badRequest("Invalid status");
        data.status = body.status;
      }

      const updated = await prisma.qbCleanupChecklistItem.update({
        where: { id: body.itemId },
        data,
      });

      // Auto-sync findings: items flagged CRITICAL / NEEDS_INVESTIGATION / CLEANUP
      const isFinding = ["CRITICAL", "NEEDS_INVESTIGATION", "CLEANUP"].includes(updated.status);
      const existingFinding = await prisma.qbCleanupFinding.findFirst({
        where: { reviewId: review.id, checklistItemId: updated.id },
      });
      const checklist = await prisma.qbCleanupChecklist.findUnique({
        where: { id: updated.checklistId },
      });

      if (isFinding) {
        const findingText = checklist ? `${checklist.title}${updated.notes ? ` — ${updated.notes}` : ""}` : (updated.notes ?? "");
        if (!existingFinding) {
          await prisma.qbCleanupFinding.create({
            data: {
              reviewId: review.id,
              checklistItemId: updated.id,
              category: checklist?.category ?? "General",
              finding: findingText,
              status: updated.status,
              notes: updated.notes,
              isFollowUp: updated.isFollowUp,
              isDocumentationNeeded: updated.isDocumentationNeeded,
            },
          });
        } else {
          await prisma.qbCleanupFinding.update({
            where: { id: existingFinding.id },
            data: {
              status: updated.status,
              notes: updated.notes,
              isFollowUp: updated.isFollowUp,
              isDocumentationNeeded: updated.isDocumentationNeeded,
            },
          });
        }
      } else if (existingFinding) {
        // Item no longer flagged — remove the auto-created finding
        await prisma.qbCleanupFinding.delete({ where: { id: existingFinding.id } });
      }

      return NextResponse.json(serializeItem(updated));
    }

    // Finding manual edit
    if (body.findingId) {
      const finding = await prisma.qbCleanupFinding.findUnique({ where: { id: body.findingId } });
      if (!finding || finding.reviewId !== review.id) throw ApiError.notFound("Finding not found");
      const updated = await prisma.qbCleanupFinding.update({
        where: { id: body.findingId },
        data: {
          finding: typeof body.finding === "string" ? body.finding : undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
          isFollowUp: typeof body.isFollowUp === "boolean" ? body.isFollowUp : undefined,
          isDocumentationNeeded: typeof body.isDocumentationNeeded === "boolean" ? body.isDocumentationNeeded : undefined,
        },
      });
      return NextResponse.json(updated);
    }

    // Question update
    if (body.questionId) {
      const q = await prisma.qbCleanupQuestion.findUnique({ where: { id: body.questionId } });
      if (!q || q.reviewId !== review.id) throw ApiError.notFound("Question not found");
      const updated = await prisma.qbCleanupQuestion.update({
        where: { id: body.questionId },
        data: {
          question: typeof body.question === "string" ? body.question : undefined,
          clientResponse: typeof body.clientResponse === "string" ? body.clientResponse : undefined,
          internalNotes: typeof body.internalNotes === "string" ? body.internalNotes : undefined,
          status: typeof body.status === "string" ? body.status : undefined,
        },
      });
      return NextResponse.json(updated);
    }

    // DocLog update
    if (body.docLogId) {
      const d = await prisma.qbCleanupDocLog.findUnique({ where: { id: body.docLogId } });
      if (!d || d.reviewId !== review.id) throw ApiError.notFound("DocLog not found");
      const updated = await prisma.qbCleanupDocLog.update({
        where: { id: body.docLogId },
        data: {
          name: typeof body.name === "string" ? body.name : undefined,
          description: typeof body.description === "string" ? body.description : undefined,
          notes: typeof body.notes === "string" ? body.notes : undefined,
          dateOrPeriod: typeof body.dateOrPeriod === "string" ? body.dateOrPeriod : undefined,
        },
      });
      return NextResponse.json(updated);
    }

    throw ApiError.badRequest("Nothing to update");
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST — create a question or docLog entry */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    const user = await requireStaff(request);

    const review = await prisma.qbCleanupReview.findUnique({
      where: { requestId: id },
    });
    if (!review) throw ApiError.notFound("Review not found");

    const body = await request.json();

    if (body.type === "question") {
      if (typeof body.question !== "string" || !body.question.trim()) {
        throw ApiError.badRequest("Question text required");
      }
      const created = await prisma.qbCleanupQuestion.create({
        data: {
          reviewId: review.id,
          findingId: typeof body.findingId === "string" ? body.findingId : null,
          question: body.question.trim(),
          internalNotes: typeof body.internalNotes === "string" ? body.internalNotes : null,
        },
      });
      return NextResponse.json(created, { status: 201 });
    }

    if (body.type === "docLog") {
      if (typeof body.name !== "string" || !body.name.trim()) {
        throw ApiError.badRequest("Document name required");
      }
      const created = await prisma.qbCleanupDocLog.create({
        data: {
          reviewId: review.id,
          name: body.name.trim(),
          docType: typeof body.docType === "string" ? body.docType : "OTHER",
          dateOrPeriod: typeof body.dateOrPeriod === "string" ? body.dateOrPeriod : null,
          description: typeof body.description === "string" ? body.description : null,
          checklistItemId: typeof body.checklistItemId === "string" ? body.checklistItemId : null,
          notes: typeof body.notes === "string" ? body.notes : null,
        },
      });
      return NextResponse.json(created, { status: 201 });
    }

    throw ApiError.badRequest("Unknown type");
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE — remove a question or docLog */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminApiAccess(request);
    const { id } = await params;
    await requireStaff(request);

    const review = await prisma.qbCleanupReview.findUnique({
      where: { requestId: id },
    });
    if (!review) throw ApiError.notFound("Review not found");

    const url = new URL(request.url);
    const questionId = url.searchParams.get("questionId");
    const docLogId = url.searchParams.get("docLogId");

    if (questionId) {
      const q = await prisma.qbCleanupQuestion.findUnique({ where: { id: questionId } });
      if (!q || q.reviewId !== review.id) throw ApiError.notFound("Question not found");
      await prisma.qbCleanupQuestion.delete({ where: { id: questionId } });
      return NextResponse.json({ deleted: true });
    }
    if (docLogId) {
      const d = await prisma.qbCleanupDocLog.findUnique({ where: { id: docLogId } });
      if (!d || d.reviewId !== review.id) throw ApiError.notFound("DocLog not found");
      await prisma.qbCleanupDocLog.delete({ where: { id: docLogId } });
      return NextResponse.json({ deleted: true });
    }

    throw ApiError.badRequest("Specify questionId or docLogId");
  } catch (error) {
    return handleApiError(error);
  }
}
