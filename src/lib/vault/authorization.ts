import { prisma } from "@/lib/prisma";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  requireRecentAuthentication,
  sessionValid,
  hashToken,
  type SessionUser,
} from "@/lib/auth";
import { grantMatches, type Capability } from "@/lib/capabilities";
import { ApiError } from "@/lib/api-error";
import type { Prisma } from "@/generated/prisma/client";
export type Scope = {
  clientId: string;
  requestId: string;
  highRisk: boolean;
  taxInformation: boolean;
};
export type Tx = Prisma.TransactionClient;
/** Used again inside write/audit transactions: stale caller snapshots never authorize byte delivery. */
export async function authorize(
  tx: Tx,
  request: Request,
  scope: Scope,
  capability: Capability = "vault_read",
  stepUp = false,
): Promise<SessionUser> {
  const token = getSessionTokenFromRequest(request);
  if (!token) throw ApiError.unauthorized();
  const session = await tx.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || !sessionValid(session)) throw ApiError.unauthorized();
  if (
    session.activeClientId !== scope.clientId ||
    request.headers.get("x-pk-client-context") !== scope.clientId
  )
    throw ApiError.forbidden("Authorized client context required");
  const user: SessionUser = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    status: session.user.status,
    sessionId: session.id,
    securityVersion: session.securityVersion,
    activeClientId: session.activeClientId,
    passwordVerifiedAt: session.passwordVerifiedAt,
    mfaVerifiedAt: session.mfaVerifiedAt,
    assurance: session.assurance,
  };
  await tx.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });
  const engagement = await tx.verificationRequest.findFirst({
    where: {
      id: scope.requestId,
      clientId: scope.clientId,
      client: { status: "ACTIVE" },
    },
    select: { id: true },
  });
  if (!engagement) throw ApiError.forbidden();
  // Membership alone is not approval for this confidential boundary. Client Vault grants
  // are not implemented here; an explicit approved client-access policy is a release prerequisite.
  if (user.role === "CLIENT" || user.assurance !== "WEBAUTHN")
    throw ApiError.forbidden("Vault access requires an approved staff grant");
  const required: Capability[] = ["confidential_access", capability];
  if (scope.highRisk) required.push("high_risk_access");
  if (scope.taxInformation) required.push("tax_information_access");
  const grants = await tx.capabilityGrant.findMany({
    where: { userId: user.id },
  });
  if (
    !required.every((cap) =>
      grants.some((grant) =>
        grantMatches(grant, cap, scope.clientId, scope.requestId),
      ),
    )
  )
    throw ApiError.forbidden();
  if (stepUp) requireRecentAuthentication(user);
  return user;
}
export async function audit(
  tx: Tx,
  actorId: string | null,
  scope: Pick<Scope, "clientId"> | null,
  id: string | null,
  action: string,
) {
  // Only internally controlled event codes and opaque IDs. No filenames, content, or exception text.
  if (!/^[A-Z_]{1,64}$/.test(action)) throw new Error("AUDIT_CODE_INVALID");
  await tx.auditLog.create({
    data: {
      actorId,
      clientId: scope?.clientId,
      action: "ADMIN_ACTION",
      resource: "secure_vault",
      resourceId: id,
      metadata: JSON.stringify({ action }),
    },
  });
}
export async function denyAudit(request: Request) {
  const user = await getSessionUser(getSessionTokenFromRequest(request));
  await prisma.$transaction((tx) =>
    audit(tx, user?.id ?? null, null, null, "ACCESS_DENIED"),
  );
}
