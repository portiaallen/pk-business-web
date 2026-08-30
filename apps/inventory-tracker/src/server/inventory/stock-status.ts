export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export function getStockStatus(
  currentQuantity: number,
  reorderThreshold: number
): StockStatus {
  if (currentQuantity <= 0) return "OUT_OF_STOCK";
  if (currentQuantity <= reorderThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

export function formatStockStatus(status: StockStatus): string {
  switch (status) {
    case "IN_STOCK":
      return "In Stock";
    case "LOW_STOCK":
      return "Low Stock";
    case "OUT_OF_STOCK":
      return "Out of Stock";
  }
}

export function stockStatusClassName(status: StockStatus): string {
  switch (status) {
    case "IN_STOCK":
      return "bg-emerald-100 text-emerald-900";
    case "LOW_STOCK":
      return "bg-amber-100 text-amber-900";
    case "OUT_OF_STOCK":
      return "bg-red-100 text-red-900";
  }
}
