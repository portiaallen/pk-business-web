import { prisma } from "@/server/db/client";
import { ApiError } from "@/server/errors/api-error";
import type { InventoryContext } from "@/server/inventory/auth";
import { hasInventoryPermission } from "@/server/inventory/auth";

export async function listLocations(ctx: InventoryContext, activeOnly = true) {
  return prisma.inventoryLocation.findMany({
    where: {
      clientId: ctx.clientId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
}

export async function getLocation(ctx: InventoryContext, locationId: string) {
  const location = await prisma.inventoryLocation.findFirst({
    where: { id: locationId, clientId: ctx.clientId },
    include: {
      products: {
        where: { isActive: true },
        orderBy: { name: "asc" },
      },
    },
  });
  if (!location) throw ApiError.notFound("Location not found.");
  return location;
}

export async function createLocation(
  ctx: InventoryContext,
  input: { name: string; description?: string }
) {
  if (!hasInventoryPermission(ctx.role, "STAFF")) {
    throw ApiError.forbidden();
  }

  const name = input.name.trim();
  const existing = await prisma.inventoryLocation.findUnique({
    where: { clientId_name: { clientId: ctx.clientId, name } },
  });
  if (existing) throw ApiError.badRequest("Location name already exists.");

  return prisma.inventoryLocation.create({
    data: {
      clientId: ctx.clientId,
      name,
      description: input.description?.trim() || null,
    },
  });
}

export async function updateLocation(
  ctx: InventoryContext,
  locationId: string,
  input: { name?: string; description?: string; isActive?: boolean }
) {
  if (!hasInventoryPermission(ctx.role, "STAFF")) {
    throw ApiError.forbidden();
  }

  const existing = await prisma.inventoryLocation.findFirst({
    where: { id: locationId, clientId: ctx.clientId },
  });
  if (!existing) throw ApiError.notFound("Location not found.");

  if (input.name && input.name.trim() !== existing.name) {
    const conflict = await prisma.inventoryLocation.findUnique({
      where: {
        clientId_name: { clientId: ctx.clientId, name: input.name.trim() },
      },
    });
    if (conflict) throw ApiError.badRequest("Location name already exists.");
  }

  return prisma.inventoryLocation.update({
    where: { id: locationId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}
