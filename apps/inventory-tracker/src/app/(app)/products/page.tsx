import Link from "next/link";
import { requireInventorySession } from "@/lib/auth-server";
import { listProducts } from "@/server/inventory/products";
import { listLocations } from "@/server/inventory/locations";
import {
  formatStockStatus,
  stockStatusClassName,
} from "@/server/inventory/stock-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Products" };

type SearchParams = Promise<{
  search?: string;
  category?: string;
  locationId?: string;
  status?: string;
  stock?: string;
  sort?: string;
  order?: string;
}>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const ctx = await requireInventorySession();

  const [products, locations] = await Promise.all([
    listProducts(ctx, {
      search: params.search,
      category: params.category,
      locationId: params.locationId,
      status: (params.status as "active" | "inactive" | "all") || "active",
      stock: (params.stock as "low" | "out" | "all") || "all",
      sort: (params.sort as "name" | "sku" | "quantity" | "updated") || "name",
      order: (params.order as "asc" | "desc") || "asc",
    }),
    listLocations(ctx),
  ]);

  const categories = [
    ...new Set(products.map((p) => p.category).filter(Boolean)),
  ] as string[];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-charcoal">
            Products
          </h1>
          <p className="mt-1 text-muted-gray">
            {products.length} product{products.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          render={<Link href="/products/new" />}
          className="min-h-11 bg-charcoal text-ivory hover:bg-charcoal/90"
        >
          Add Product
        </Button>
      </div>

      <form
        method="GET"
        className="rounded-lg border border-border bg-background p-4"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              name="search"
              defaultValue={params.search ?? ""}
              placeholder="Name, SKU, or description"
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <select
              id="category"
              name="category"
              defaultValue={params.category ?? ""}
              className="form-select min-h-11"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="locationId">Location</Label>
            <select
              id="locationId"
              name="locationId"
              defaultValue={params.locationId ?? ""}
              className="form-select min-h-11"
            >
              <option value="">All locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stock">Stock Status</Label>
            <select
              id="stock"
              name="stock"
              defaultValue={params.stock ?? "all"}
              className="form-select min-h-11"
            >
              <option value="all">All</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={params.status ?? "active"}
              className="form-select min-h-11"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sort">Sort By</Label>
            <select
              id="sort"
              name="sort"
              defaultValue={params.sort ?? "name"}
              className="form-select min-h-11"
            >
              <option value="name">Name</option>
              <option value="sku">SKU</option>
              <option value="quantity">Quantity</option>
              <option value="updated">Last Updated</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit" className="min-h-11">
            Apply Filters
          </Button>
          <Button
            render={<Link href="/products" />}
            type="button"
            variant="outline"
            className="min-h-11"
          >
            Clear
          </Button>
        </div>
      </form>

      {products.length === 0 ? (
        <p className="rounded-lg border border-border bg-background p-6 text-muted-gray">
          No products found.{" "}
          <Link href="/products/new" className="text-charcoal hover:text-gold">
            Add your first product
          </Link>
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-border bg-background md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-cream">
                <tr>
                  <th className="px-4 py-3 font-semibold text-charcoal">Name</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">SKU</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">Qty</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">Location</th>
                  <th className="px-4 py-3 font-semibold text-charcoal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => (
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
                      {product.locationName ?? "\u2014"}
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
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="block rounded-lg border border-border bg-background p-4 transition-colors hover:border-charcoal/30"
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
                  {product.currentQuantity} {product.unit}
                  {product.locationName ? ` \u00b7 ${product.locationName}` : ""}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
