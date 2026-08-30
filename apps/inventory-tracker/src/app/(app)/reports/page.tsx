import { requireInventorySession } from "@/lib/auth-server";
import {
  getInventorySummaryReport,
  getInventoryActivityReport,
} from "@/server/inventory/reports";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const ctx = await requireInventorySession();

  const [summary, activity] = await Promise.all([
    getInventorySummaryReport(ctx),
    getInventoryActivityReport(ctx),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Reports
        </h1>
        <p className="mt-1 text-muted-gray">
          Inventory summaries and activity exports.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-background p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-xl font-semibold text-charcoal">
            Inventory Summary
          </h2>
          <a
            href="/api/inventory/reports/summary?csv=1"
            className="inline-flex min-h-11 items-center rounded-lg border border-border bg-cream px-4 text-sm font-medium text-charcoal transition-colors hover:border-charcoal/30"
          >
            Download CSV
          </a>
        </div>

        {summary.length === 0 ? (
          <p className="mt-4 text-muted-gray">No active products to report.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-cream">
                <tr>
                  <th className="px-3 py-2 font-semibold text-charcoal">Product</th>
                  <th className="px-3 py-2 font-semibold text-charcoal">SKU</th>
                  <th className="px-3 py-2 font-semibold text-charcoal">Category</th>
                  <th className="px-3 py-2 font-semibold text-charcoal">Location</th>
                  <th className="px-3 py-2 font-semibold text-charcoal">Qty</th>
                  <th className="px-3 py-2 font-semibold text-charcoal">Threshold</th>
                  <th className="px-3 py-2 font-semibold text-charcoal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.map((row, i) => (
                  <tr key={i} className="hover:bg-cream/50">
                    <td className="px-3 py-2 text-charcoal">{row.product}</td>
                    <td className="px-3 py-2 text-muted-gray">{row.sku}</td>
                    <td className="px-3 py-2 text-muted-gray">{row.category || "\u2014"}</td>
                    <td className="px-3 py-2 text-muted-gray">{row.location || "\u2014"}</td>
                    <td className="px-3 py-2 text-charcoal">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="px-3 py-2 text-muted-gray">{row.reorderThreshold}</td>
                    <td className="px-3 py-2 text-charcoal">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-background p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-heading text-xl font-semibold text-charcoal">
            Recent Activity
          </h2>
          <a
            href="/api/inventory/reports/activity?csv=1"
            className="inline-flex min-h-11 items-center rounded-lg border border-border bg-cream px-4 text-sm font-medium text-charcoal transition-colors hover:border-charcoal/30"
          >
            Download CSV
          </a>
        </div>

        {activity.length === 0 ? (
          <p className="mt-4 text-muted-gray">No recent activity.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-cream">
                <tr>
                  <th className="px-3 py-2 font-semibold text-charcoal">Date</th>
                  <th className="px-3 py-2 font-semibold text-charcoal">Product</th>
                  <th className="px-3 py-2 font-semibold text-charcoal">Type</th>
                  <th className="px-3 py-2 font-semibold text-charcoal">Change</th>
                  <th className="px-3 py-2 font-semibold text-charcoal">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activity.slice(0, 50).map((row, i) => (
                  <tr key={i} className="hover:bg-cream/50">
                    <td className="px-3 py-2 text-muted-gray">
                      {new Date(row.date).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-charcoal">
                      {row.product}
                      <span className="ml-1 text-xs text-muted-gray">({row.sku})</span>
                    </td>
                    <td className="px-3 py-2 text-charcoal">
                      {row.transactionType.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2 text-charcoal">
                      {row.quantityChange > 0 ? "+" : ""}
                      {row.quantityChange}
                    </td>
                    <td className="px-3 py-2 text-muted-gray">{row.user}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
