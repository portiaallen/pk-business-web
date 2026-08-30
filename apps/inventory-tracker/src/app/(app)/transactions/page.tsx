import Link from "next/link";
import { requireInventorySession } from "@/lib/auth-server";
import { listTransactions } from "@/server/inventory/transactions";
import { listProducts } from "@/server/inventory/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventoryTransactionType } from "@/generated/prisma/client";

export const metadata = { title: "Transactions" };

type SearchParams = Promise<{
  productId?: string;
  transactionType?: string;
  from?: string;
  to?: string;
}>;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ctx = await requireInventorySession();

  const [products, transactions] = await Promise.all([
    listProducts(ctx),
    listTransactions(ctx, {
      productId: params.productId,
      transactionType: params.transactionType as InventoryTransactionType | undefined,
      from: params.from ? new Date(params.from) : undefined,
      to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
      limit: 100,
    }),
  ]);

  const transactionTypes = [
    "STOCK_IN",
    "STOCK_OUT",
    "ADJUSTMENT",
    "CORRECTION",
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Transactions
        </h1>
        <p className="mt-1 text-muted-gray">
          Stock movement history across all products.
        </p>
      </div>

      <form
        method="GET"
        className="rounded-lg border border-border bg-background p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="productId">Product</Label>
            <select
              id="productId"
              name="productId"
              defaultValue={params.productId ?? ""}
              className="form-select min-h-11"
            >
              <option value="">All products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transactionType">Type</Label>
            <select
              id="transactionType"
              name="transactionType"
              defaultValue={params.transactionType ?? ""}
              className="form-select min-h-11"
            >
              <option value="">All types</option>
              {transactionTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="from">From Date</Label>
            <Input
              id="from"
              name="from"
              type="date"
              defaultValue={params.from ?? ""}
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To Date</Label>
            <Input
              id="to"
              name="to"
              type="date"
              defaultValue={params.to ?? ""}
              className="min-h-11"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit" className="min-h-11">
            Apply Filters
          </Button>
          <Button
            render={<Link href="/transactions" />}
            type="button"
            variant="outline"
            className="min-h-11"
          >
            Clear
          </Button>
        </div>
      </form>

      {transactions.length === 0 ? (
        <p className="rounded-lg border border-border bg-background p-6 text-muted-gray">
          No transactions found.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-background md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-cream">
                <tr>
                  <th className="px-4 py-3 font-semibold text-charcoal">Date</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">Product</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">Type</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">Change</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-cream/50">
                    <td className="px-4 py-3 text-muted-gray">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/products/${tx.productId}`}
                        className="font-medium text-charcoal hover:text-gold"
                      >
                        {tx.productName}
                      </Link>
                      <p className="text-xs text-muted-gray">{tx.productSku}</p>
                    </td>
                    <td className="px-4 py-3 text-charcoal">
                      {tx.transactionType.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-charcoal">
                      {tx.quantityChange > 0 ? "+" : ""}
                      {tx.quantityChange} ({tx.quantityBefore} \u2192 {tx.quantityAfter})
                    </td>
                    <td className="px-4 py-3 text-muted-gray">
                      {tx.performedBy.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/products/${tx.productId}`}
                    className="font-medium text-charcoal hover:text-gold"
                  >
                    {tx.productName}
                  </Link>
                  <span className="text-xs text-muted-gray">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-gray">
                  {tx.transactionType.replace(/_/g, " ")} \u00b7 {tx.performedBy.name}
                </p>
                <p className="mt-2 text-sm text-charcoal">
                  {tx.quantityChange > 0 ? "+" : ""}
                  {tx.quantityChange} ({tx.quantityBefore} \u2192 {tx.quantityAfter})
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
