"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@pk/components/ui/button";
import { Input } from "@pk/components/ui/input";
import { Label } from "@pk/components/ui/label";
import { Textarea } from "@pk/components/ui/textarea";

export function LocationForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
    };

    try {
      const res = await fetch("/api/inventory/locations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create location.");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create location."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="location-name">Location Name</Label>
        <Input
          id="location-name"
          name="name"
          required
          className="min-h-11"
          placeholder="e.g. Warehouse A"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location-description">Description</Label>
        <Textarea
          id="location-description"
          name="description"
          rows={2}
          placeholder="Optional details"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="min-h-11 bg-charcoal text-ivory hover:bg-charcoal/90"
      >
        {loading ? "Adding…" : "Add Location"}
      </Button>
    </form>
  );
}
