// Admin API for the PK Practice Partners CPA application pipeline.
// Staff-only. Statuses follow the founder-approved pipeline: new
// application, in review, quote sent, approved, declined, onboarded.
// Founder retains approval authority: only ADMIN may approve, decline, or
// complete onboarding (see assertCpaStatusTransition). Secure-folder
// onboarding fields are internal-only: they are never exposed publicly and
// are edited by hand following the day-one manual checklist.
import { requireAdminApiAccess } from "@/lib/admin-access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionTokenFromRequest,
  getSessionUser,
  hasRole,
} from "@/lib/auth";
import { ApiError } from "@/lib/api-error";
import { assertCpaStatusTransition } from "@/lib/cpa-partners";

const STATUS_VALUES = [
  "NEW_APPLICATION",
  "IN_REVIEW",
  "QUOTE_SENT",
  "APPROVED",
  "DECLINED",
  "ONBOARDED",
] as const;

const INTERNAL_NOTE_MAX = 2000;
const TEXT_FIELD_MAX = 2000;

function asText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function GET(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const applications = await prisma.cpaPartnerApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json(
      applications.map((a) => ({
        id: a.id,
        intakeSubmissionId: a.intakeSubmissionId,
        firmName: a.firmName,
        contactName: a.contactName,
        email: a.email,
        phone: a.phone,
        serviceNeeds: JSON.parse(a.serviceNeeds) as string[],
        partnershipModel: a.partnershipModel,
        scopeNotes: a.scopeNotes,
        acknowledgement: a.acknowledgement,
        status: a.status,
        internalNotes: JSON.parse(a.internalNotes) as Array<{
          at: string;
          author: string;
          text: string;
        }>,
        quoteAmount: a.quoteAmount,
        quoteNotes: a.quoteNotes,
        secureFolderName: a.secureFolderName,
        secureFolderAccess: a.secureFolderAccess,
        onboardingNotes: a.onboardingNotes,
        onboardingComplete: a.onboardingComplete,
        emailSent: a.emailSent,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.internal();
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminApiAccess(request);
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN", "STAFF")) throw ApiError.forbidden();

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw ApiError.badRequest("Invalid application update.");

    const existing = await prisma.cpaPartnerApplication.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound();

    const data: Record<string, unknown> = {};

    if (typeof body.status === "string") {
      const status = body.status;
      if (!(STATUS_VALUES as readonly string[]).includes(status)) {
        throw ApiError.badRequest("Invalid status.");
      }
      const isAdmin = hasRole(user, "ADMIN");
      const guard = assertCpaStatusTransition(isAdmin, existing.status, status);
      if (!guard.ok) throw ApiError.conflict(guard.error);
      data.status = status;
      if (status === "APPROVED") data.approvedAt = new Date();
      if (status === "DECLINED") data.declinedAt = new Date();
      if (status === "ONBOARDED") data.onboardedAt = new Date();
    }

    // Internal-only fields. Founder-controlled manual onboarding: secure
    // Drive folder details live on the partner record, never in public
    // surfaces, and never in the general app database with taxpayer files.
    if (typeof body.quoteAmount === "string" || body.quoteAmount === null) {
      data.quoteAmount = body.quoteAmount === null ? null : asText(body.quoteAmount, 100);
    }
    if (typeof body.quoteNotes === "string" || body.quoteNotes === null) {
      data.quoteNotes = body.quoteNotes === null ? null : asText(body.quoteNotes, TEXT_FIELD_MAX);
    }
    if (typeof body.secureFolderName === "string" || body.secureFolderName === null) {
      data.secureFolderName = body.secureFolderName === null ? null : asText(body.secureFolderName, 300);
    }
    if (typeof body.secureFolderAccess === "string" || body.secureFolderAccess === null) {
      data.secureFolderAccess =
        body.secureFolderAccess === null ? null : asText(body.secureFolderAccess, TEXT_FIELD_MAX);
    }
    if (typeof body.onboardingNotes === "string" || body.onboardingNotes === null) {
      data.onboardingNotes =
        body.onboardingNotes === null ? null : asText(body.onboardingNotes, TEXT_FIELD_MAX);
    }
    if (body.onboardingComplete === true) data.onboardingComplete = true;

    // Internal notes append-only: each entry is dated and attributed, never
    // overwritten.
    if (typeof body.newInternalNote === "string" && body.newInternalNote.trim()) {
      const note = asText(body.newInternalNote, INTERNAL_NOTE_MAX);
      if (note) {
        const current = JSON.parse(existing.internalNotes) as Array<{
          at: string;
          author: string;
          text: string;
        }>;
        current.push({ at: new Date().toISOString(), author: user.email ?? "staff", text: note });
        data.internalNotes = JSON.stringify(current.slice(-100));
      }
    }

    if (Object.keys(data).length === 0) {
      throw ApiError.badRequest("Nothing to update.");
    }

    const updated = await prisma.cpaPartnerApplication.update({ where: { id }, data });

    return NextResponse.json({ success: true, id: updated.id, status: updated.status });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.internal();
  }
}
