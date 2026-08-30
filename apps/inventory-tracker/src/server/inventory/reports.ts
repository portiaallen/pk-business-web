import { prisma } from "@/server/db/client";
import type { InventoryContext } from "@/server/inventory/auth";
import { getStockStatus } from "@/server/inventory/stock-status";
import { formatStockStatus } from "@/server/inventory/stock-status";
import { listTransactions } from "@/server/inventory/transactions";

export async function getInventorySummaryReport(ctx: InventoryContext) {
  const products = await prisma.inventoryProduct.findMany({
    where: { clientId: ctx.clientId, isActive: true },
    include: { location: true },
    orderBy: { name: "asc" },
  });

  return products.map((product) => {
    const status = getStockStatus(
      product.currentQuantity,
      product.reorderThreshold
    );
    return {
      product: product.name,
      sku: product.sku,
      category: product.category ?? "",
      location: product.location?.name ?? "",
      quantity: product.currentQuantity,
      reorderThreshold: product.reorderThreshold,
      unit: product.unit,
      status: formatStockStatus(status),
    };
  });
}

export async function getInventoryActivityReport(
  ctx: InventoryContext,
  filters: { from?: Date; to?: Date } = {}
) {
  const transactions = await listTransactions(ctx, {
    from: filters.from,
    to: filters.to,
    limit: 500,
  });

  return transactions.map((tx) => ({
    date: tx.createdAt,
    product: tx.productName,
    sku: tx.productSku,
    transactionType: tx.transactionType,
    quantityChange: tx.quantityChange,
    user: tx.performedBy.name,
    reason: tx.reason ?? "",
  }));
}

export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number) => {
    const str = String(value);
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ].join("\n");
}
