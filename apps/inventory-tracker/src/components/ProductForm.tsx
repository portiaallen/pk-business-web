"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@pk/components/ui/button";
import { Input } from "@pk/components/ui/input";
import { Label } from "@pk/components/ui/label";
import { Textarea } from "@pk/components/ui/textarea";

type LocationOption = { id: string; name: string };

export function ProductForm({
  locations,
  initial,
  productId,
}: {
  locations: LocationOption[];
  initial?: {
    name: string;
    sku: string;
    description: string;
    category: string;
    unit: string;
    reorderThreshold: number;
    locationId: string;
    isActive?: boolean;
  };
  productId?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(productId);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      name: String(form.get("name") ?? ""),
      sku: String(form.get("sku") ?? ""),
      description: String(form.get("description") ?? ""),
      category: String(form.get("category") ?? ""),
      unit: String(form.get("unit") ?? "each"),
      reorderThreshold: Number(form.get("reorderThreshold") ?? 0),
      locationId: String(form.get("locationId") ?? "") || undefined,
      ...(isEdit
        ? { isActive: form.get("isActive") === "on" }
        : { initialQuantity: Number(form.get("initialQuantity") ?? 0) }),
    };

    try {
      const res = await fetch(
        isEdit ? `/api/inventory/products/${productId}` : "/api/inventory/products",
        {
          method: isEdit ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save product.");
      router.push(`/products/${data.product.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Product Name</Label>
          <Input
            id="name"
            name="name"
            required
            defaultValue={initial?.name}
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            name="sku"
            required
            defaultValue={initial?.sku}
            className="min-h-11 uppercase"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initial?.description}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            defaultValue={initial?.category}
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Input
            id="unit"
            name="unit"
            defaultValue={initial?.unit ?? "each"}
            className="min-h-11"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="reorderThreshold">Reorder Threshold</Label>
          <Input
            id="reorderThreshold"
            name="reorderThreshold"
            type="number"
            min={0}
            required
            defaultValue={initial?.reorderThreshold ?? 0}
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="locationId">Location</Label>
          <select
            id="locationId"
            name="locationId"
            defaultValue={initial?.locationId ?? ""}
            className="form-select min-h-11"
          >
            <option value="">No location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="initialQuantity">Initial Quantity</Label>
          <Input
            id="initialQuantity"
            name="initialQuantity"
            type="number"
            min={0}
            defaultValue={0}
            className="min-h-11"
          />
        </div>
      )}

      {isEdit && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            name="isActive"
            defaultChecked={initial?.isActive !== false}
            className="size-4 rounded border-input"
          />
          <Label htmlFor="isActive">Active product</Label>
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading} className="min-h-11 bg-charcoal text-ivory hover:bg-charcoal/90">
          {loading ? "Saving…" : isEdit ? "Update Product" : "Create Product"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
