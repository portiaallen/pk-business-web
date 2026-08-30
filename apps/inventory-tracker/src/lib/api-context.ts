import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@pk/server/auth/constants";
import {
  requireInventoryContextFromToken,
  type InventoryContext,
} from "@pk/server/inventory/auth";
import type { InventoryMemberRole } from "@pk/generated/prisma/client";

export async function getInventoryApiContext(
  minimumRole: InventoryMemberRole = "VIEWER"
): Promise<InventoryContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return requireInventoryContextFromToken(token, minimumRole);
}
