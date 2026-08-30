import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/server/auth/constants";
import {
  requireInventoryContextFromToken,
  type InventoryContext,
} from "@/server/inventory/auth";
import type { InventoryMemberRole } from "@/generated/prisma/client";
import { getMainAppUrl, getInventoryAppUrl } from "@/lib/urls";

export async function getInventorySession(): Promise<InventoryContext | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  try {
    return await requireInventoryContextFromToken(token);
  } catch {
    return null;
  }
}

export async function requireInventorySession(
  minimumRole: InventoryMemberRole = "VIEWER"
): Promise<InventoryContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  try {
    return await requireInventoryContextFromToken(token, minimumRole);
  } catch {
    const loginUrl = new URL("/portal/login", getMainAppUrl());
    loginUrl.searchParams.set("next", getInventoryAppUrl());
    redirect(loginUrl.toString());
  }
}
