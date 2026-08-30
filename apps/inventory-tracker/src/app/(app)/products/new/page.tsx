import Link from "next/link";
import { requireInventorySession } from "@/lib/auth-server";
import { listLocations } from "@/server/inventory/locations";
import { ProductForm } from "@/components/ProductForm";
import { Button } from "@/components/ui/button";

export const metadata = { title: "New Product" };

export default async function NewProductPage() {
  const ctx = await requireInventorySession("STAFF");
  const locations = await listLocations(ctx);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          render={<Link href="/products" />}
          variant="outline"
          className="min-h-11"
        >
          Back
        </Button>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Add Product
        </h1>
      </div>

      <div className="max-w-2xl rounded-lg border border-border bg-background p-6">
        <ProductForm
          locations={locations.map((l) => ({ id: l.id, name: l.name }))}
        />
      </div>
    </div>
  );
}
