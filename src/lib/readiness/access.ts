import type { Prisma, ReadinessAssessment } from "@/generated/prisma/client";
import {
  hashToken,
  sessionValid,
  getSessionTokenFromRequest,
  requireRecentAuthentication,
  type SessionUser,
} from "@/lib/auth";
import { grantMatches, type Capability } from "@/lib/capabilities";
import { ApiError } from "@/lib/api-error";
export type Tx = Prisma.TransactionClient;
export async function session(tx: Tx, request: Request) {
  const token = getSessionTokenFromRequest(request);
  if (!token) throw ApiError.unauthorized();
  const record = await tx.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!record || !sessionValid(record)) throw ApiError.unauthorized();
  const user: SessionUser = {
    ...record.user,
    sessionId: record.id,
    securityVersion: record.securityVersion,
    activeClientId: record.activeClientId,
    passwordVerifiedAt: record.passwordVerifiedAt,
    mfaVerifiedAt: record.mfaVerifiedAt,
    assurance: record.assurance,
  };
  return user;
}
export async function globalAccess(tx: Tx, request: Request, write = false) {
  const user = await session(tx, request);
  if (user.role === "CLIENT" || user.assurance !== "WEBAUTHN")
    throw ApiError.forbidden();
  const grants = await tx.capabilityGrant.findMany({
    where: { userId: user.id },
  });
  if (
    !grants.some((g) =>
      grantMatches(
        g,
        write ? "readiness_library_write" : "readiness_library_read",
      ),
    )
  )
    throw ApiError.forbidden();
  if (write) requireRecentAuthentication(user);
  return user;
}
export async function assessmentAccess(
  tx: Tx,
  request: Request,
  id: string,
  mode: "read" | "write" | "qa" | "credit" = "read",
  admin = false,
) {
  const user = await session(tx, request); // Authenticate before object lookup.
  const assessment = await tx.readinessAssessment.findUnique({ where: { id } });
  if (!assessment) throw ApiError.notFound();
  if (!admin && user.role !== "CLIENT") throw ApiError.forbidden();
  const client = await tx.client.findUnique({
    where: { id: assessment.clientId },
  });
  if (client?.status !== "ACTIVE") throw ApiError.forbidden();
  if (request.headers.get("x-pk-client-context") !== assessment.clientId)
    throw ApiError.forbidden("Explicit client context required");
  if (user.activeClientId && user.activeClientId !== assessment.clientId)
    throw ApiError.forbidden(
      "Client context changed; reload before continuing",
    );
  if (user.role === "CLIENT" && !admin) {
    const membership = await tx.clientMember.findUnique({
      where: {
        clientId_userId: { clientId: assessment.clientId, userId: user.id },
      },
    });
    if (!membership || (mode !== "read" && membership.role === "VIEWER"))
      throw ApiError.forbidden();
  } else {
    if (
      user.role === "CLIENT" ||
      user.assurance !== "WEBAUTHN" ||
      user.activeClientId !== assessment.clientId
    )
      throw ApiError.forbidden();
    const grants = await tx.capabilityGrant.findMany({
      where: { userId: user.id },
    });
    const required: Capability[] = [
      "confidential_access",
      mode === "qa"
        ? "readiness_qa"
        : mode === "credit"
          ? "readiness_credit"
          : mode === "write"
            ? "readiness_review"
            : "readiness_read",
    ];
    if (
      !required.every((c) =>
        grants.some((g) =>
          grantMatches(g, c, assessment.clientId, assessment.requestId),
        ),
      )
    )
      throw ApiError.forbidden();
    if (["qa", "credit"].includes(mode)) requireRecentAuthentication(user);
  }
  return { user, assessment };
}
export async function audit(
  tx: Tx,
  actorId: string | null,
  a: Pick<ReadinessAssessment, "clientId" | "id"> | null,
  event: string,
  extra: Record<string, number | string> = {},
) {
  if (!/^[A-Z_]{1,64}$/.test(event))
    throw new Error("READINESS_AUDIT_CODE_INVALID");
  const safe: Record<string, string | number> = { action: event };
  for (const [key, value] of Object.entries(extra)) {
    if (
      ["version", "amountCents", "count"].includes(key) &&
      Number.isSafeInteger(value) &&
      (value as number) >= 0
    )
      safe[key] = value;
    if (
      ["from", "to", "reason"].includes(key) &&
      typeof value === "string" &&
      /^[A-Z_]{1,64}$/.test(value)
    )
      safe[key] = value;
  }
  await tx.auditLog.create({
    data: {
      actorId,
      clientId: a?.clientId,
      action: "ADMIN_ACTION",
      resource: "readiness",
      resourceId: a?.id,
      metadata: JSON.stringify(safe),
    },
  });
}
export async function lockAssessment(
  tx: Tx,
  a: ReadinessAssessment,
  expectedVersion: number,
  data: Prisma.ReadinessAssessmentUpdateManyMutationInput = {},
) {
  if (a.version !== expectedVersion)
    throw ApiError.conflict("Assessment changed; reload before continuing");
  const result = await tx.readinessAssessment.updateMany({
    where: { id: a.id, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });
  if (result.count !== 1)
    throw ApiError.conflict("Assessment changed; reload before continuing");
}
export function requirePaid(a: ReadinessAssessment) {
  if (a.paymentStatus !== "PAID" || !a.paymentId)
    throw ApiError.conflict("Verified payment is required");
}
export function requireDraft(a: ReadinessAssessment) {
  requirePaid(a);
  if (!["IN_REVIEW", "REPORT_DRAFT", "QA_REVIEW"].includes(a.status))
    throw ApiError.conflict(
      "This assessment is not editable in its current state",
    );
}
