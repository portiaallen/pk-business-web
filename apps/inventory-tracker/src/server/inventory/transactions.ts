import type { InventoryTransactionType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/client";
import { ApiError } from "@/server/errors/api-error";
import type { InventoryContext } from "@/server/inventory/auth";
import { hasInventoryPermission } from "@/server/inventory/auth";

const transactionInclude = {
  product: { include: { location: true } },
  performedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InventoryTransactionInclude;

export function serializeTransaction(
  tx: Prisma.InventoryTransactionGetPayload<{
    include: typeof transactionInclude;
  }>
) {
  return {
    id: tx.id,
    productId: tx.productId,
    productName: tx.product.name,
    productSku: tx.product.sku,
    transactionType: tx.transactionType,
    quantityChange: tx.quantityChange,
    quantityBefore: tx.quantityBefore,
    quantityAfter: tx.quantityAfter,
    reason: tx.reason,
    notes: tx.notes,
    performedBy: tx.performedBy,
    createdAt: tx.createdAt.toISOString(),
  };
}

export async function recordInventoryTransaction(
  ctx: InventoryContext,
  input: {
    productId: string;
    transactionType: InventoryTransactionType;
    quantityChange?: number;
    newQuantity?: number;
    reason?: string;
    notes?: string;
    allowNegative?: boolean;
  }
) {
  const minRole =
    input.transactionType === "ADJUSTMENT" ||
    input.transactionType === "CORRECTION"
      ? "STAFF"
      : "STAFF";

  if (!hasInventoryPermission(ctx.role, minRole)) {
    throw ApiError.forbidden();
  }

  if (
    input.allowNegative &&
    !hasInventoryPermission(ctx.role, "OWNER")
  ) {
    throw ApiError.forbidden("Only owners can override negative inventory.");
  }

  const product = await prisma.inventoryProduct.findFirst({
    where: { id: input.productId, clientId: ctx.clientId },
  });
  if (!product) throw ApiError.notFound("Product not found.");

  const quantityBefore = product.currentQuantity;
  let quantityChange = input.quantityChange ?? 0;
  let quantityAfter = quantityBefore;

  if (input.transactionType === "ADJUSTMENT" || input.transactionType === "CORRECTION") {
    if (input.newQuantity === undefined) {
      throw ApiError.badRequest("New quantity is required for adjustments.");
    }
    quantityAfter = input.newQuantity;
    quantityChange = quantityAfter - quantityBefore;
  } else if (input.transactionType === "STOCK_IN") {
    if (!input.quantityChange || input.quantityChange <= 0) {
      throw ApiError.badRequest("Quantity must be greater than zero.");
    }
    quantityAfter = quantityBefore + input.quantityChange;
  } else if (input.transactionType === "STOCK_OUT") {
    if (!input.quantityChange || input.quantityChange <= 0) {
      throw ApiError.badRequest("Quantity must be greater than zero.");
    }
    quantityChange = -input.quantityChange;
    quantityAfter = quantityBefore + quantityChange;
  }

  if (quantityAfter < 0 && !input.allowNegative) {
    throw ApiError.badRequest("Insufficient stock. Quantity cannot go negative.");
  }

  const [, transaction] = await prisma.$transaction([
    prisma.inventoryProduct.update({
      where: { id: product.id },
      data: { currentQuantity: quantityAfter },
    }),
    prisma.inventoryTransaction.create({
      data: {
        clientId: ctx.clientId,
        productId: product.id,
        transactionType: input.transactionType,
        quantityChange,
        quantityBefore,
        quantityAfter,
        reason: input.reason?.trim() || null,
        notes: input.notes?.trim() || null,
        performedById: ctx.user.id,
      },
      include: transactionInclude,
    }),
  ]);

  return serializeTransaction(transaction);
}

export async function listTransactions(
  ctx: InventoryContext,
  filters: {
    productId?: string;
    transactionType?: InventoryTransactionType;
    performedById?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  } = {}
) {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: {
      clientId: ctx.clientId,
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.transactionType
        ? { transactionType: filters.transactionType }
        : {}),
      ...(filters.performedById
        ? { performedById: filters.performedById }
        : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: transactionInclude,
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 100,
  });

  return transactions.map(serializeTransaction);
}
