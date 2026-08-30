"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@pk/components/ui/button";
import { Input } from "@pk/components/ui/input";
import { Label } from "@pk/components/ui/label";
import { Textarea } from "@pk/components/ui/textarea";

const TRANSACTION_TYPES = [
  { value: "STOCK_IN", label: "Stock In" },
  { value: "STOCK_OUT", label: "Stock Out" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "CORRECTION", label: "Correction" },
] as const;

export function StockTransactionForm({
  productId,
  currentQuantity,
  isOwner,
}: {
  productId: string;
  currentQuantity: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txType, setTxType] = useState<string>("STOCK_IN");

  const isAdjustment =
    txType === "ADJUSTMENT" || txType === "CORRECTION";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const transactionType = String(form.get("transactionType"));
    const body: Record<string, unknown> = {
      transactionType,
      reason: String(form.get("reason") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };

    if (transactionType === "ADJUSTMENT" || transactionType === "CORRECTION") {
      body.newQuantity = Number(form.get("newQuantity"));
    } else {
      body.quantityChange = Number(form.get("quantityChange"));
    }

    if (form.get("allowNegative") === "on") {
      body.allowNegative = true;
    }

    try {
      const res = await fetch(
        `/api/inventory/products/${productId}/transactions`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record transaction.");
      router.refresh();
      (e.target as HTMLFormElement).reset();
      setTxType("STOCK_IN");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record transaction."
      );
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

      <p className="text-sm text-muted-gray">
        Current quantity: <strong className="text-charcoal">{currentQuantity}</strong>
      </p>

      <div className="space-y-2">
        <Label htmlFor="transactionType">Transaction Type</Label>
        <select
          id="transactionType"
          name="transactionType"
          value={txType}
          onChange={(e) => setTxType(e.target.value)}
          className="form-select min-h-11"
          required
        >
          {TRANSACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {isAdjustment ? (
        <div className="space-y-2">
          <Label htmlFor="newQuantity">New Quantity</Label>
          <Input
            id="newQuantity"
            name="newQuantity"
            type="number"
            min={0}
            required
            defaultValue={currentQuantity}
            className="min-h-11"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="quantityChange">Quantity</Label>
          <Input
            id="quantityChange"
            name="quantityChange"
            type="number"
            min={1}
            required
            className="min-h-11"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Input id="reason" name="reason" className="min-h-11" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>

      {isOwner && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="allowNegative"
            name="allowNegative"
            className="size-4 rounded border-input"
          />
          <Label htmlFor="allowNegative">Allow negative inventory</Label>
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="min-h-11 bg-charcoal text-ivory hover:bg-charcoal/90"
      >
        {loading ? "Recording…" : "Record Transaction"}
      </Button>
    </form>
  );
}
