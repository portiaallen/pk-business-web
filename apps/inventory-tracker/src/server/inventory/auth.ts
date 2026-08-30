import type { InventoryMemberRole } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { ensureTursoReady } from "@/server/db/apply-turso-schema";
import { ApiError } from "@/server/errors/api-error";
import {
  getSessionTokenFromRequest,
  getSessionUser,
  type SessionUser,
} from "@/server/auth/session";

export type InventoryContext = {
  user: SessionUser;
  clientId: string;
  role: InventoryMemberRole;
};

const ROLE_RANK: Record<InventoryMemberRole, number> = {
  VIEWER: 1,
  STAFF: 2,
  OWNER: 3,
};

export function hasInventoryPermission(
  role: InventoryMemberRole,
  minimum: InventoryMemberRole
): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export async function requireInventoryContext(
  request: Request,
  minimumRole: InventoryMemberRole = "VIEWER"
): Promise<InventoryContext> {
  await ensureTursoReady();

  const token = getSessionTokenFromRequest(request);
  const user = await getSessionUser(token);

  if (!user || user.status !== "ACTIVE") {
    throw ApiError.unauthorized();
  }

  const client = await prisma.client.findUnique({
    where: { userId: user.id },
  });

  if (!client || client.status !== "ACTIVE") {
    throw ApiError.forbidden(
      "Inventory Tracker is available to PK Business Services client accounts."
    );
  }

  let member = await prisma.inventoryMember.findUnique({
    where: {
      clientId_userId: { clientId: client.id, userId: user.id },
    },
  });

  if (!member) {
    member = await prisma.inventoryMember.create({
      data: {
        clientId: client.id,
        userId: user.id,
        role: "OWNER",
      },
    });
  }

  if (!hasInventoryPermission(member.role, minimumRole)) {
    throw ApiError.forbidden("You do not have permission for this action.");
  }

  return { user, clientId: client.id, role: member.role };
}

export async function requireInventoryContextFromToken(
  token: string | undefined,
  minimumRole: InventoryMemberRole = "VIEWER"
): Promise<InventoryContext> {
  const request = new Request("http://inventory.local", {
    headers: token ? { cookie: `pk_session=${encodeURIComponent(token)}` } : {},
  });
  return requireInventoryContext(request, minimumRole);
}
