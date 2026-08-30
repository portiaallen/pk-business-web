import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInventorySession } from "@/lib/auth-server";
import { getProduct } from "@/server/inventory/products";
import { listLocations } from "@/server/inventory/locations";
import { listTransactions } from "@/server/inventory/transactions";
import {
  formatStockStatus,
  stockStatusClassName,
} from "@/server/inventory/stock-status";
import { ProductForm } from "@/components/ProductForm";
import { StockTransactionForm } from "@/components/StockTransactionForm";
import { Button } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const ctx = await requireInventorySession();
    const product = await getProduct(ctx, id);
    return { title: product.name };
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireInventorySession();

  let product;
  try {
    product = await getProduct(ctx, id);
  } catch {
    notFound();
  }

  const [locations, transactions] = await Promise.all([
    listLocations(ctx),
    listTransactions(ctx, { productId: id, limit: 20 }),
  ]);

  const canEdit = ctx.role === "STAFF" || ctx.role === "OWNER";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button
            render={<Link href="/products" />}
            variant="outline"
            className="mb-4 min-h-11"
          >
            Back to Products
          </Button>
          <h1 className="font-heading text-3xl font-semibold text-charcoal">
            {product.name}
          </h1>
          <p className="mt-1 text-muted-gray">SKU: {product.sku}</p>
        </div>
        <span
          className={`inline-flex self-start rounded-full px-3 py-1 text-sm font-medium ${stockStatusClassName(product.stockStatus)}`}
        >
          {formatStockStatus(product.stockStatus)}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-background p-6">
          <h2 className="font-heading text-xl font-semibold text-charcoal">
            Details
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <DetailRow label="Quantity" value={`${product.currentQuantity} ${product.unit}`} />
            <DetailRow label="Reorder Threshold" value={String(product.reorderThreshold)} />
            <DetailRow label="Category" value={product.category ?? "\u2014"} />
            <DetailRow label="Location" value={product.locationName ?? "\u2014"} />
            <DetailRow label="Status" value={product.isActive ? "Active" : "Inactive"} />
            {product.description && (
              <div>
                <dt className="font-medium text-muted-gray">Description</dt>
                <dd className="mt-1 text-charcoal">{product.description}</dd>
              </div>
            )}
          </dl>
        </section>

        {canEdit && (
          <section className="rounded-lg border border-border bg-background p-6">
            <h2 className="font-heading text-xl font-semibold text-charcoal">
              Record Transaction
            </h2>
            <div className="mt-4">
              <StockTransactionForm
                productId={product.id}
                currentQuantity={product.currentQuantity}
                isOwner={ctx.role === "OWNER"}
              />
            </div>
          </section>
        )}
      </div>

      {canEdit && (
        <section className="rounded-lg border border-border bg-background p-6">
          <h2 className="font-heading text-xl font-semibold text-charcoal">
            Edit Product
          </h2>
          <div className="mt-4 max-w-2xl">
            <ProductForm
              productId={product.id}
              locations={locations.map((l) => ({ id: l.id, name: l.name }))}
              initial={{
                name: product.name,
                sku: product.sku,
                description: product.description ?? "",
                category: product.category ?? "",
                unit: product.unit,
                reorderThreshold: product.reorderThreshold,
                locationId: product.locationId ?? "",
                isActive: product.isActive,
              }}
            />
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border bg-background p-6">
        <h2 className="font-heading text-xl font-semibold text-charcoal">
          Transaction History
        </h2>
        {transactions.length === 0 ? (
          <p className="mt-4 text-muted-gray">No transactions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {transactions.map((tx) => (
              <li
                key={tx.id}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-charcoal">
                    {tx.transactionType.replace(/_/g, " ")}
                  </p>
                  <p className="text-sm text-muted-gray">
                    {tx.performedBy.name} ·{" "}
                    {new Date(tx.createdAt).toLocaleString()}
                  </p>
                  {tx.reason && (
                    <p className="text-sm text-muted-gray">{tx.reason}</p>
                  )}
                </div>
                <div className="text-sm text-charcoal">
                  {tx.quantityChange > 0 ? "+" : ""}
                  {tx.quantityChange} ({tx.quantityBefore} → {tx.quantityAfter})
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-gray">{label}</dt>
      <dd className="text-charcoal">{value}</dd>
    </div>
  );
}
