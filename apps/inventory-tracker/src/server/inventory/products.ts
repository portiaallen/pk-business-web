import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { ApiError } from "@/server/errors/api-error";
import type { InventoryContext } from "@/server/inventory/auth";
import { hasInventoryPermission } from "@/server/inventory/auth";
import { getStockStatus } from "@/server/inventory/stock-status";
import { recordInventoryTransaction } from "@/server/inventory/transactions";

const productInclude = {
  location: true,
} satisfies Prisma.InventoryProductInclude;

export function serializeProduct(
  product: Prisma.InventoryProductGetPayload<{ include: typeof productInclude }>
) {
  const status = getStockStatus(
    product.currentQuantity,
    product.reorderThreshold
  );
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    description: product.description,
    category: product.category,
    unit: product.unit,
    currentQuantity: product.currentQuantity,
    reorderThreshold: product.reorderThreshold,
    locationId: product.locationId,
    locationName: product.location?.name ?? null,
    isActive: product.isActive,
    stockStatus: status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export async function listProducts(
  ctx: InventoryContext,
  filters: {
    search?: string;
    category?: string;
    locationId?: string;
    status?: "active" | "inactive" | "all";
    stock?: "low" | "out" | "all";
    sort?: "name" | "sku" | "quantity" | "updated";
    order?: "asc" | "desc";
  } = {}
) {
  const where: Prisma.InventoryProductWhereInput = {
    clientId: ctx.clientId,
    ...(filters.status === "inactive"
      ? { isActive: false }
      : filters.status === "all"
        ? {}
        : { isActive: true }),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search } },
            { sku: { contains: filters.search } },
            { description: { contains: filters.search } },
          ],
        }
      : {}),
  };

  const products = await prisma.inventoryProduct.findMany({
    where,
    include: productInclude,
    orderBy:
      filters.sort === "sku"
        ? { sku: filters.order ?? "asc" }
        : filters.sort === "quantity"
          ? { currentQuantity: filters.order ?? "asc" }
          : filters.sort === "updated"
            ? { updatedAt: filters.order ?? "desc" }
            : { name: filters.order ?? "asc" },
  });

  let serialized = products.map(serializeProduct);

  if (filters.stock === "low") {
    serialized = serialized.filter((p) => p.stockStatus === "LOW_STOCK");
  } else if (filters.stock === "out") {
    serialized = serialized.filter((p) => p.stockStatus === "OUT_OF_STOCK");
  }

  return serialized;
}

export async function getProduct(ctx: InventoryContext, productId: string) {
  const product = await prisma.inventoryProduct.findFirst({
    where: { id: productId, clientId: ctx.clientId },
    include: productInclude,
  });
  if (!product) throw ApiError.notFound("Product not found.");
  return serializeProduct(product);
}

export async function createProduct(
  ctx: InventoryContext,
  input: {
    name: string;
    sku: string;
    description?: string;
    category?: string;
    unit: string;
    initialQuantity: number;
    reorderThreshold: number;
    locationId?: string;
  }
) {
  if (!hasInventoryPermission(ctx.role, "STAFF")) {
    throw ApiError.forbidden();
  }

  const sku = input.sku.trim().toUpperCase();
  const existing = await prisma.inventoryProduct.findUnique({
    where: { clientId_sku: { clientId: ctx.clientId, sku } },
  });
  if (existing) {
    throw ApiError.badRequest("SKU already exists for your organization.");
  }

  if (input.locationId) {
    const location = await prisma.inventoryLocation.findFirst({
      where: { id: input.locationId, clientId: ctx.clientId, isActive: true },
    });
    if (!location) throw ApiError.badRequest("Invalid location.");
  }

  const product = await prisma.inventoryProduct.create({
    data: {
      clientId: ctx.clientId,
      name: input.name.trim(),
      sku,
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      unit: input.unit.trim() || "each",
      currentQuantity: 0,
      reorderThreshold: Math.max(0, input.reorderThreshold),
      locationId: input.locationId || null,
    },
    include: productInclude,
  });

  if (input.initialQuantity > 0) {
    await recordInventoryTransaction(ctx, {
      productId: product.id,
      transactionType: "STOCK_IN",
      quantityChange: input.initialQuantity,
      reason: "Initial stock",
      notes: "Product created with opening quantity",
    });
    const updated = await prisma.inventoryProduct.findUniqueOrThrow({
      where: { id: product.id },
      include: productInclude,
    });
    return serializeProduct(updated);
  }

  return serializeProduct(product);
}

export async function updateProduct(
  ctx: InventoryContext,
  productId: string,
  input: {
    name?: string;
    sku?: string;
    description?: string;
    category?: string;
    unit?: string;
    reorderThreshold?: number;
    locationId?: string | null;
    isActive?: boolean;
  }
) {
  if (!hasInventoryPermission(ctx.role, "STAFF")) {
    throw ApiError.forbidden();
  }

  const existing = await prisma.inventoryProduct.findFirst({
    where: { id: productId, clientId: ctx.clientId },
  });
  if (!existing) throw ApiError.notFound("Product not found.");

  if (input.sku && input.sku.trim().toUpperCase() !== existing.sku) {
    const sku = input.sku.trim().toUpperCase();
    const conflict = await prisma.inventoryProduct.findUnique({
      where: { clientId_sku: { clientId: ctx.clientId, sku } },
    });
    if (conflict) throw ApiError.badRequest("SKU already exists.");
  }

  const product = await prisma.inventoryProduct.update({
    where: { id: productId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.sku !== undefined
        ? { sku: input.sku.trim().toUpperCase() }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
      ...(input.category !== undefined
        ? { category: input.category.trim() || null }
        : {}),
      ...(input.unit !== undefined ? { unit: input.unit.trim() || "each" } : {}),
      ...(input.reorderThreshold !== undefined
        ? { reorderThreshold: Math.max(0, input.reorderThreshold) }
        : {}),
      ...(input.locationId !== undefined ? { locationId: input.locationId } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: productInclude,
  });

  return serializeProduct(product);
}
