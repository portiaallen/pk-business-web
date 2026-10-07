import { prisma } from "@/lib/prisma";
import {
  requireStaff,
  requireCapability,
  requireRequestAccess,
  confidentialRequestFilter,
  type Capability,
} from "@/lib/capabilities";
import { requireRecentAuthentication } from "@/lib/auth";
import { ApiError } from "@/lib/api-error";
/** Central guard for every existing admin route, in addition to existing business rules. */
export async function requireAdminApiAccess(request: Request) {
  const user = await requireStaff(request);
  const path = new URL(request.url).pathname.split("/").filter(Boolean);
  const area = path[2];
  const id = path[3];
  const write = !["GET", "HEAD"].includes(request.method);
  let capability: Capability = "client_management";
  if (["requests", "documents", "dashboard"].includes(area))
    capability = "confidential_access";
  if (area === "intake-submissions") capability = "consultations";
  if (area === "invoices") capability = "payments";
  if (area === "services") capability = "pricing";
  if (area === "activity") capability = "audit";
  if (area === "team") capability = "security";
  if (area === "staff") capability = "assignments";
  if (path.includes("qb-review")) capability = "qa";
  if (path.includes("deliverables") && write) capability = "bookkeeping";
  if (write && area === "team") await requireCapability(user, "security");
  if (write && area === "services") await requireCapability(user, "pricing");
  if (write && area === "intake-submissions")
    await requireCapability(user, "consultations");
  if (request.method === "DELETE") {
    capability = "disposal";
    requireRecentAuthentication(user);
  }
  if (write && ["services", "team", "staff"].includes(area))
    requireRecentAuthentication(user);
  if (area === "clients" && id) {
    await requireCapability(user, "client_management");
    await requireCapability(
      user,
      request.method === "DELETE" ? "disposal" : "confidential_access",
      id,
    );
  } else if (area === "requests" && id) {
    await requireRequestAccess(user, id, capability);
    if (capability !== "confidential_access")
      await requireRequestAccess(user, id, "confidential_access");
  } else if (area === "documents" && id) {
    const document = await prisma.document.findUnique({
      where: { id },
      select: { requestId: true },
    });
    if (!document) throw ApiError.notFound();
    await requireRequestAccess(user, document.requestId, capability);
  } else if (area === "invoices" && id) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { clientId: true },
    });
    if (!invoice) throw ApiError.notFound();
    await requireCapability(user, capability, invoice.clientId);
    if (write) await requireCapability(user, "payments", invoice.clientId);
  } else if (
    capability === "confidential_access" &&
    ["requests", "documents", "dashboard"].includes(area)
  ) {
    await confidentialRequestFilter(user);
  } else {
    await requireCapability(
      user,
      capability,
      [
        "confidential_access",
        "payments",
        "disposal",
        "qa",
        "bookkeeping",
      ].includes(capability)
        ? user.activeClientId || undefined
        : undefined,
    );
  }
  // Protect cross-client mutation IDs carried in collection-route bodies.
  if (write && ["invoices", "documents"].includes(area) && !id) {
    const body = await request
      .clone()
      .json()
      .catch(() => null);
    if (area === "invoices" && body?.clientId !== user.activeClientId)
      throw ApiError.forbidden();
    if (area === "invoices" && body?.requestId)
      await requireRequestAccess(user, body.requestId, "payments");
    if (area === "documents" && request.method === "DELETE") {
      const doc = await prisma.document.findUnique({
        where: { id: typeof body?.id === "string" ? body.id : "" },
        select: { requestId: true },
      });
      if (!doc) throw ApiError.notFound();
      await requireRequestAccess(user, doc.requestId, "disposal");
    }
  }
  if (
    write &&
    area === "invoices" &&
    (!id || (request.method === "PATCH" && path.length === 4))
  ) {
    requireRecentAuthentication(user);
    await requireCapability(user, "pricing");
  }
  if (write && area === "requests" && id) {
    const body = request.headers
      .get("content-type")
      ?.includes("application/json")
      ? await request
          .clone()
          .json()
          .catch(() => null)
      : null;
    if (body && "assignedStaffId" in body)
      throw ApiError.forbidden("Use the audited security assignment endpoint");
    if (
      path.includes("qb-review") ||
      (path.includes("deliverables") && request.method === "PATCH")
    ) {
      await requireRequestAccess(user, id, "qa");
      requireRecentAuthentication(user);
    }
  }
  return user;
}
