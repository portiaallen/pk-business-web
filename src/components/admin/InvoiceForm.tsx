"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Eye, ArrowLeft } from "lucide-react";

type LineItem = { description: string; quantity: number; rateCents: number };
type Client = { id: string; name: string };
type RequestRow = { id: string; requestType: string; clientId: string };

const TERMS = [
  { value: "DEPOSIT_50", label: "50% deposit before work begins; balance on completion" },
  { value: "DUE_ON_RECEIPT", label: "Due upon receipt" },
  { value: "NET_15", label: "Net 15" },
  { value: "NET_30", label: "Net 30" },
];

function fmtCents(c: number) {
  return `$${(c / 100).toFixed(2)}`;
}

export function InvoiceForm({ mode, invoiceId }: { mode: "create" | "edit"; invoiceId?: string }) {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [clientId, setClientId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, rateCents: 0 }]);
  const [adjustDollars, setAdjustDollars] = useState("0");
  const [dueAt, setDueAt] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("DEPOSIT_50");
  const [notes, setNotes] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/clients").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/admin/requests").then((r) => (r.ok ? r.json() : [])),
    ]).then(([clientRows, requestRows]) => {
      setClients(Array.isArray(clientRows) ? clientRows : clientRows?.clients ?? []);
      setRequests(Array.isArray(requestRows) ? requestRows : requestRows?.requests ?? []);
    });
    if (mode === "edit" && invoiceId) {
      fetch(`/api/admin/invoices/${invoiceId}`)
        .then((r) => r.json())
        .then((data) => {
          const inv = data.invoice;
          setClientId(inv.clientId);
          setRequestId(inv.requestId ?? "");
          setDescription(inv.description ?? "");
          setItems(
            inv.lineItems.length
              ? inv.lineItems
              : [{ description: "", quantity: 1, rateCents: 0 }]
          );
          setAdjustDollars((inv.adjustmentCents / 100).toFixed(2));
          setDueAt(inv.dueAt ? inv.dueAt.slice(0, 10) : "");
          setNotes(inv.notes ?? "");
          setPaymentInstructions(inv.paymentInstructions ?? "");
          setInvoiceNumber(inv.invoiceNumber);
          setLoading(false);
        });
    }
  }, [mode, invoiceId]);

  const subtotalCents = useMemo(
    () =>
      items.reduce(
        (sum, it) => sum + Math.round((Number(it.quantity) || 0) * (Number(it.rateCents) || 0)),
        0
      ),
    [items]
  );
  const adjustmentCents = Math.round((Number(adjustDollars) || 0) * 100);
  const totalCents = subtotalCents + adjustmentCents;

  const clientRequests = requests.filter((r) => r.clientId === clientId);

  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function save() {
    setError("");
    if (!clientId) {
      setError("Select a client before saving.");
      return;
    }
    if (totalCents <= 0) {
      setError("Invoice total must be greater than zero.");
      return;
    }
    setSaving(true);
    const payload = {
      clientId,
      requestId: requestId || null,
      description: description || null,
      lineItems: items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        rateCents: Math.round(Number(it.rateCents)),
      })),
      adjustmentCents,
      dueAt: dueAt || null,
      paymentTerms,
      notes: notes || null,
      paymentInstructions: paymentInstructions || null,
    };
    const res =
      mode === "create"
        ? await fetch("/api/admin/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/invoices/${invoiceId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || `Save failed (${res.status}).`);
      return;
    }
    router.push("/admin/invoices/");
  }

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-gray">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/invoices"
          className="inline-flex size-10 items-center justify-center rounded-md border border-border text-charcoal"
          aria-label="Back to invoices"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-heading text-3xl font-semibold text-charcoal">
            {mode === "create" ? "New Invoice" : `Edit ${invoiceNumber}`}
          </h1>
          <p className="text-sm text-muted-gray">
            {mode === "create"
              ? "Create a draft, then preview and send."
              : "Draft invoices can be edited until sent."}
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-900">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Client & engagement */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold text-charcoal">Client & Engagement</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="inv-client" className="text-sm font-medium text-charcoal">
                  Client <span aria-hidden>*</span>
                </label>
                <select
                  id="inv-client"
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setRequestId("");
                  }}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 text-charcoal"
                  required
                >
                  <option value="">— Select client —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="inv-request" className="text-sm font-medium text-charcoal">
                  Engagement / service request
                </label>
                <select
                  id="inv-request"
                  value={requestId}
                  onChange={(e) => setRequestId(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 text-charcoal"
                  disabled={!clientId}
                >
                  <option value="">— None / general —</option>
                  {clientRequests.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.requestType}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-gray">
                  Linking the invoice to the correct engagement keeps Client → Engagement → Invoice association accurate.
                </p>
              </div>
            </div>
          </section>

          {/* Line items */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-charcoal">Line Items</h2>
              <button
                type="button"
                onClick={() =>
                  setItems((p) => [...p, { description: "", quantity: 1, rateCents: 0 }])
                }
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-charcoal hover:bg-secondary"
              >
                <Plus className="size-4" aria-hidden />
                Add Line
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {items.map((item, i) => (
                <div key={i} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-12">
                  <div className="sm:col-span-6">
                    <label htmlFor={`desc-${i}`} className="text-sm font-medium text-charcoal">
                      Description
                    </label>
                    <input
                      id={`desc-${i}`}
                      value={item.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      placeholder="e.g. QuickBooks cleanup — reconciliation"
                      className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`qty-${i}`} className="text-sm font-medium text-charcoal">
                      Hours / Qty
                    </label>
                    <input
                      id={`qty-${i}`}
                      type="number"
                      min="0"
                      step="0.25"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                      className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor={`rate-${i}`} className="text-sm font-medium text-charcoal">
                      Rate ($)
                    </label>
                    <input
                      id={`rate-${i}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rateCents / 100 || ""}
                      onChange={(e) =>
                        updateItem(i, { rateCents: Math.round(Number(e.target.value) * 100) })
                      }
                      className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2 sm:col-span-2">
                    <div>
                      <span className="text-sm font-medium text-muted-gray">Amount</span>
                      <p className="min-h-11 font-semibold text-charcoal">
                        {fmtCents(Math.round((Number(item.quantity) || 0) * (Number(item.rateCents) || 0)))}
                      </p>
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                        className="inline-flex size-11 items-center justify-center rounded-md border border-red-200 text-red-700 hover:bg-red-50"
                        aria-label={`Remove line ${i + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="inv-adjust" className="text-sm font-medium text-charcoal">
                  Adjustment / discount ($, negative for discount)
                </label>
                <input
                  id="inv-adjust"
                  type="number"
                  step="0.01"
                  value={adjustDollars}
                  onChange={(e) => setAdjustDollars(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
                />
              </div>
              <div>
                <label htmlFor="inv-due" className="text-sm font-medium text-charcoal">
                  Due date
                </label>
                <input
                  id="inv-due"
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
                />
              </div>
            </div>
          </section>

          {/* Terms & notes */}
          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold text-charcoal">Payment Terms & Notes</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="inv-terms" className="text-sm font-medium text-charcoal">
                  Payment terms
                </label>
                <select
                  id="inv-terms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 text-charcoal"
                >
                  {TERMS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="inv-notes" className="text-sm font-medium text-charcoal">
                  Notes to client (visible on invoice)
                </label>
                <textarea
                  id="inv-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  placeholder="e.g. Scope covers the TY2025 Amex account cleanup as agreed."
                />
              </div>
              <div>
                <label htmlFor="inv-payinstructions" className="text-sm font-medium text-charcoal">
                  Payment instructions (visible on invoice)
                </label>
                <textarea
                  id="inv-payinstructions"
                  rows={2}
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
                  placeholder="e.g. Card via Stripe, Zelle, or Cash App — see payment page."
                />
              </div>
            </div>
          </section>
        </div>

        {/* Totals sidebar */}
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-card p-6 lg:sticky lg:top-20">
            <h2 className="font-heading text-lg font-semibold text-charcoal">Totals</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-gray">Subtotal</dt>
                <dd className="font-medium text-charcoal">{fmtCents(subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-gray">Adjustment</dt>
                <dd className="font-medium text-charcoal">
                  {adjustmentCents === 0 ? "—" : fmtCents(adjustmentCents)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base">
                <dt className="font-semibold text-charcoal">Total</dt>
                <dd className="font-heading text-xl font-semibold text-charcoal">
                  {fmtCents(totalCents)}
                </dd>
              </div>
            </dl>
            {totalCents > 0 && totalCents < 50000 && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Under $500 — per PK policy, invoices under $500 are generally paid in full upfront (consider “Due upon receipt”).
              </p>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={saving || !clientId}
                onClick={save}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-charcoal/90 disabled:opacity-50"
              >
                <Eye className="size-4" aria-hidden />
                {saving ? "Saving…" : mode === "create" ? "Save & Preview" : "Save & Preview"}
              </button>
              <button
                type="button"
                disabled={saving || !clientId}
                onClick={save}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-secondary disabled:opacity-50"
              >
                Save Draft
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-gray">
              Preview shows exactly what the client will receive. Sending happens from the preview screen.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
