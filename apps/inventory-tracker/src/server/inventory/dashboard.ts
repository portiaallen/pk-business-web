import { prisma } from "@/server/db/client";
import type { InventoryContext } from "@/server/inventory/auth";
import { getStockStatus } from "@/server/inventory/stock-status";
import { listTransactions } from "@/server/inventory/transactions";

export async function getInventoryDashboard(ctx: InventoryContext) {
  const [products, locations, recentActivity] = await Promise.all([
    prisma.inventoryProduct.findMany({
      where: { clientId: ctx.clientId, isActive: true },
      include: { location: true },
    }),
    prisma.inventoryLocation.count({
      where: { clientId: ctx.clientId, isActive: true },
    }),
    listTransactions(ctx, { limit: 10 }),
  ]);

  let totalUnits = 0;
  let lowStock = 0;
  let outOfStock = 0;

  const lowStockProducts = products
    .map((product) => {
      const status = getStockStatus(
        product.currentQuantity,
        product.reorderThreshold
      );
      totalUnits += product.currentQuantity;
      if (status === "LOW_STOCK") lowStock += 1;
      if (status === "OUT_OF_STOCK") outOfStock += 1;
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        currentQuantity: product.currentQuantity,
        reorderThreshold: product.reorderThreshold,
        unit: product.unit,
        stockStatus: status,
        locationName: product.location?.name ?? null,
      };
    })
    .filter((p) => p.stockStatus !== "IN_STOCK")
    .sort((a, b) => a.currentQuantity - b.currentQuantity)
    .slice(0, 8);

  return {
    totalActiveProducts: products.length,
    totalUnits,
    lowStockCount: lowStock,
    outOfStockCount: outOfStock,
    locationCount: locations,
    lowStockProducts,
    recentActivity,
  };
}
