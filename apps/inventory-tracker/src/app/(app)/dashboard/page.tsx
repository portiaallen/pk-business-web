import Link from "next/link";
import { requireInventorySession } from "@/lib/auth-server";
import { getInventoryDashboard } from "@pk/server/inventory/dashboard";
import {
  formatStockStatus,
  stockStatusClassName,
} from "@pk/server/inventory/stock-status";
import { Button } from "@pk/components/ui/button";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const ctx = await requireInventorySession();
  const dashboard = await getInventoryDashboard(ctx);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Dashboard
        </h1>
        <p className="mt-2 text-muted-gray">
          Overview of your inventory at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Products" value={dashboard.totalActiveProducts} />
        <StatCard label="Total Units" value={dashboard.totalUnits} />
        <StatCard label="Low Stock" value={dashboard.lowStockCount} alert />
        <StatCard label="Out of Stock" value={dashboard.outOfStockCount} alert />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Locations" value={dashboard.locationCount} />
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-background p-5">
          <QuickAction href="/products/new" label="Add Product" />
          <QuickAction href="/transactions" label="View Transactions" />
          <QuickAction href="/alerts" label="View Alerts" />
          <QuickAction href="/reports" label="Export Reports" />
        </div>
      </div>

      {dashboard.lowStockProducts.length > 0 && (
        <section className="rounded-lg border border-border bg-background p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-heading text-xl font-semibold text-charcoal">
              Low Stock Alerts
            </h2>
            <Link
              href="/alerts"
              className="text-sm font-medium text-charcoal hover:text-gold"
            >
              View all
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {dashboard.lowStockProducts.map((product) => (
              <li
                key={product.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link
                    href={`/products/${product.id}`}
                    className="font-medium text-charcoal hover:text-gold"
                  >
                    {product.name}
                  </Link>
                  <p className="text-sm text-muted-gray">
                    SKU: {product.sku}
                    {product.locationName
                      ? ` · ${product.locationName}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-charcoal">
                    {product.currentQuantity} {product.unit}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${stockStatusClassName(product.stockStatus)}`}
                  >
                    {formatStockStatus(product.stockStatus)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dashboard.recentActivity.length > 0 && (
        <section className="rounded-lg border border-border bg-background p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-heading text-xl font-semibold text-charcoal">
              Recent Activity
            </h2>
            <Link
              href="/transactions"
              className="text-sm font-medium text-charcoal hover:text-gold"
            >
              View all
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {dashboard.recentActivity.map((tx) => (
              <li
                key={tx.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-charcoal">{tx.productName}</p>
                  <p className="text-sm text-muted-gray">
                    {tx.transactionType.replace(/_/g, " ")} ·{" "}
                    {tx.performedBy.name}
                  </p>
                </div>
                <div className="text-sm text-charcoal">
                  {tx.quantityChange > 0 ? "+" : ""}
                  {tx.quantityChange} → {tx.quantityAfter}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-gray">
        {label}
      </p>
      <p
        className={`mt-2 font-heading text-3xl font-semibold ${alert && value > 0 ? "text-amber-800" : "text-charcoal"}`}
      >
        {value}
      </p>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Button
      render={<Link href={href} />}
      variant="outline"
      className="min-h-11"
    >
      {label}
    </Button>
  );
}
