import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/constants";
import {
  requireInventoryContextFromToken,
  type InventoryContext,
} from "@/server/inventory/auth";
import type { InventoryMemberRole } from "@/generated/prisma/client";

export async function getInventoryApiContext(
  minimumRole: InventoryMemberRole = "VIEWER"
): Promise<InventoryContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return requireInventoryContextFromToken(token, minimumRole);
}
