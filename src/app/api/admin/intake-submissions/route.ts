import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  hasRole,
} from "@/lib/auth";
import { ApiError, handleApiError } from "@/lib/api-error";
import { serviceOptions } from "@/content/services";

function serviceLabel(slug: string): string {
  return serviceOptions.find((o) => o.value === slug)?.label ?? slug;
}

/** GET — list consultation submissions (newest first) for the admin portal. */
export async function GET(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();

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
        createdAt: s.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** PATCH — mark a submission processed/unprocessed. */
export async function PATCH(request: Request) {
  try {
    const token = getSessionTokenFromRequest(request);
    const user = await getSessionUser(token);
    if (!user || !hasRole(user, "ADMIN")) throw ApiError.forbidden();

    const body = (await request.json().catch(() => null)) as {
      id?: string;
      processed?: boolean;
    } | null;
    if (!body?.id || typeof body.processed !== "boolean") {
      throw ApiError.badRequest("id and processed are required");
    }

    const existing = await prisma.intakeSubmission.findUnique({
      where: { id: body.id },
      select: { id: true },
    });
    if (!existing) throw ApiError.notFound("Submission not found");

    await prisma.intakeSubmission.update({
      where: { id: body.id },
      data: { processed: body.processed },
    });

    return NextResponse.json({ id: body.id, processed: body.processed });
  } catch (error) {
    return handleApiError(error);
  }
}
