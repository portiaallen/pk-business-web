import Link from "next/link";
import { requireInventorySession } from "@/lib/auth-server";
import { listProducts } from "@/server/inventory/products";
import {
  formatStockStatus,
  stockStatusClassName,
} from "@/server/inventory/stock-status";

export const metadata = { title: "Alerts" };

export default async function AlertsPage() {
  const ctx = await requireInventorySession();

  const products = await listProducts(ctx, { stock: "low" });
  const outOfStock = await listProducts(ctx, { stock: "out" });
  const alerts = [...outOfStock, ...products.filter((p) => p.stockStatus === "LOW_STOCK")];

  const uniqueAlerts = Array.from(
    new Map(alerts.map((p) => [p.id, p])).values()
  ).sort((a, b) => a.currentQuantity - b.currentQuantity);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Stock Alerts
        </h1>
        <p className="mt-1 text-muted-gray">
          Products at or below their reorder threshold.
        </p>
      </div>

      {uniqueAlerts.length === 0 ? (
        <p className="rounded-lg border border-border bg-background p-6 text-muted-gray">
          All products are adequately stocked.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-background md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-cream">
                <tr>
                  <th className="px-4 py-3 font-semibold text-charcoal">Product</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">SKU</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">Quantity</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">Threshold</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {uniqueAlerts.map((product) => (
                  <tr key={product.id} className="hover:bg-cream/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/products/${product.id}`}
                        className="font-medium text-charcoal hover:text-gold"
                      >
                        {product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-gray">{product.sku}</td>
                    <td className="px-4 py-3 text-charcoal">
                      {product.currentQuantity} {product.unit}
                    </td>
                    <td className="px-4 py-3 text-muted-gray">
                      {product.reorderThreshold}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${stockStatusClassName(product.stockStatus)}`}
                      >
                        {formatStockStatus(product.stockStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {uniqueAlerts.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="block rounded-lg border border-border bg-background p-4 hover:border-charcoal/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-charcoal">{product.name}</p>
                    <p className="text-sm text-muted-gray">{product.sku}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${stockStatusClassName(product.stockStatus)}`}
                  >
                    {formatStockStatus(product.stockStatus)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-charcoal">
                  {product.currentQuantity} {product.unit} (threshold:{" "}
                  {product.reorderThreshold})
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
