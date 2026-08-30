import Link from "next/link";
import { notFound } from "next/navigation";
import { requireInventorySession } from "@/lib/auth-server";
import { getLocation } from "@pk/server/inventory/locations";
import {
  formatStockStatus,
  getStockStatus,
  stockStatusClassName,
} from "@pk/server/inventory/stock-status";
import { Button } from "@pk/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const ctx = await requireInventorySession();
    const location = await getLocation(ctx, id);
    return { title: location.name };
  } catch {
    return { title: "Location" };
  }
}

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireInventorySession();

  let location;
  try {
    location = await getLocation(ctx, id);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          render={<Link href="/locations" />}
          variant="outline"
          className="mb-4 min-h-11"
        >
          Back to Locations
        </Button>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          {location.name}
        </h1>
        {location.description && (
          <p className="mt-1 text-muted-gray">{location.description}</p>
        )}
        {!location.isActive && (
          <p className="mt-2 text-sm text-amber-800">This location is inactive.</p>
        )}
      </div>

      <section className="rounded-lg border border-border bg-background p-6">
        <h2 className="font-heading text-xl font-semibold text-charcoal">
          Products at this Location
        </h2>
        {location.products.length === 0 ? (
          <p className="mt-4 text-muted-gray">No products at this location.</p>
        ) : (
          <>
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-cream">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-charcoal">Name</th>
                    <th className="px-4 py-3 font-semibold text-charcoal">SKU</th>
                    <th className="px-4 py-3 font-semibold text-charcoal">Quantity</th>
                    <th className="px-4 py-3 font-semibold text-charcoal">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {location.products.map((product) => {
                    const status = getStockStatus(
                      product.currentQuantity,
                      product.reorderThreshold
                    );
                    return (
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
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${stockStatusClassName(status)}`}
                          >
                            {formatStockStatus(status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-3 md:hidden">
              {location.products.map((product) => {
                const status = getStockStatus(
                  product.currentQuantity,
                  product.reorderThreshold
                );
                return (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="block rounded-lg border border-border p-4 hover:border-charcoal/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-charcoal">{product.name}</p>
                        <p className="text-sm text-muted-gray">{product.sku}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${stockStatusClassName(status)}`}
                      >
                        {formatStockStatus(status)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-charcoal">
                      {product.currentQuantity} {product.unit}
                    </p>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
