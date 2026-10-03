import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import {
  getSessionUser,
  getSessionTokenFromRequest,
  requireRecentAuthentication,
  type SessionUser,
} from "@/lib/auth";

export const CAPABILITIES = [
  "confidential_access",
  "vault_read",
  "vault_upload",
  "high_risk_access",
  "tax_information_access",
  "bookkeeping",
  "tax_preparation",
  "qa",
  "filing",
  "pricing",
  "payments",
  "client_management",
  "consultations",
  "assignments",
  "permissions",
  "audit",
  "security",
  "legal_hold",
  "disposal",
  "bulk_export",
] as const;
export type Capability = (typeof CAPABILITIES)[number];
const GLOBAL_ONLY: Capability[] = [
  "permissions",
  "security",
  "audit",
  "pricing",
  "client_management",
  "consultations",
  "assignments",
];
export function grantMatches(
  grant: {
    capability: string;
    scope: string;
    clientId: string;
    requestId?: string;
  },
  capability: Capability,
  clientId?: string,
  requestId?: string,
): boolean {
  return (
    grant.capability === capability &&
    (GLOBAL_ONLY.includes(capability)
      ? grant.scope === "GLOBAL" && grant.clientId === ""
      : !!clientId &&
        grant.clientId === clientId &&
        (grant.scope === "CLIENT" ||
          (grant.scope === "REQUEST" &&
            !!requestId &&
            grant.requestId === requestId)))
  );
}
export async function requireCapability(
  user: SessionUser,
  capability: Capability,
  clientId?: string,
  requestId?: string,
) {
  if (user.role === "CLIENT" || user.assurance !== "WEBAUTHN")
    throw ApiError.forbidden();
  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: { status: true, securityVersion: true },
  });
  if (
    !fresh ||
    fresh.status !== "ACTIVE" ||
    fresh.securityVersion !== user.securityVersion
  )
    throw ApiError.unauthorized();
  const grants = await prisma.capabilityGrant.findMany({
    where: { userId: user.id, capability },
  });
  if (!grants.some((g) => grantMatches(g, capability, clientId, requestId)))
    throw ApiError.forbidden("Required capability is not granted");
  if (clientId) {
    if (user.activeClientId !== clientId)
      throw ApiError.forbidden("Select the authorized client first");
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { status: true },
    });
    if (client?.status !== "ACTIVE") throw ApiError.forbidden();
  }
}
export async function requireRequestAccess(
  user: SessionUser,
  requestId: string,
  capability: Capability = "confidential_access",
) {
  const engagement = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { clientId: true, assignedStaffId: true },
  });
  if (!engagement) throw ApiError.notFound();
  await requireCapability(user, capability, engagement.clientId, requestId);
  // A CLIENT scoped capability is an explicit grant; assignment alone never supplies a capability.
  return engagement;
}
export async function requireStaff(request: Request) {
  const user = await getSessionUser(getSessionTokenFromRequest(request));
  if (!user || user.role === "CLIENT") throw ApiError.unauthorized();
  return user;
}
/** Future filing/legal-hold/export callers must use this gate; no future workflows are built here. */
export async function requireSensitiveOperation(
  request: Request,
  capability: Capability,
  clientId?: string,
  requestId?: string,
) {
  const user = await requireStaff(request);
  requireRecentAuthentication(user);
  await requireCapability(user, capability, clientId, requestId);
  return user;
}
/** Collection queries are constrained to grants; REQUEST grants never widen to the entire client. */
export async function confidentialRequestFilter(user: SessionUser) {
  const fresh = await prisma.user.findUnique({
    where: { id: user.id },
    select: { status: true, securityVersion: true },
  });
  if (
    !fresh ||
    fresh.status !== "ACTIVE" ||
    fresh.securityVersion !== user.securityVersion
  )
    throw ApiError.unauthorized();
  if (
    !user.activeClientId ||
    user.role === "CLIENT" ||
    user.assurance !== "WEBAUTHN"
  )
    throw ApiError.forbidden("Select an authorized client first");
  const client = await prisma.client.findUnique({
    where: { id: user.activeClientId },
    select: { status: true },
  });
  if (client?.status !== "ACTIVE") throw ApiError.forbidden();
  const grants = await prisma.capabilityGrant.findMany({
    where: {
      userId: user.id,
      clientId: user.activeClientId,
      capability: "confidential_access",
    },
  });
  if (grants.some((g) => g.scope === "CLIENT"))
    return { clientId: user.activeClientId };
  const ids = grants
    .filter((g) => g.scope === "REQUEST" && g.requestId)
    .map((g) => g.requestId);
  if (!ids.length) throw ApiError.forbidden();
  return { clientId: user.activeClientId, id: { in: ids } };
}
