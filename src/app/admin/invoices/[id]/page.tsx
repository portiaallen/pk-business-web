"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, DollarSign, Ban, RefreshCw, Trash2 } from "lucide-react";
import { confirmDelete } from "@/lib/confirm-delete";
import { InvoiceDocument } from "@/components/admin/InvoiceDocument";

type LineItem = { description: string; quantity: number; rateCents: number; amountCents: number };
type Invoice = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  description: string | null;
  lineItems: LineItem[];
  subtotalCents: number;
  adjustmentCents: number;
  amountCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  storedStatus: string;
  paymentTerms: string | null;
  notes: string | null;
  paymentInstructions: string | null;
  dueAt: string | null;
  sentAt: string | null;
  payments: Array<{
    id: string;
    amountCents: number;
    status: string;
    method: string;
    transactionReference: string | null;
    paidAt: string | null;
  }>;
  activities: Array<{ id: string; event: string; detail: string | null; createdAt: string }>;
};

function fmt(c: number) {
  return `$${(c / 100).toFixed(2)}`;
}
function fmtStatus(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Record payment form
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("ZELLE");
  const [payRef, setPayRef] = useState("");
  const [showPayForm, setShowPayForm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/invoices/${id}`);
    if (res.ok) {
      const data = await res.json();
      setInvoice(data.invoice);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action: string) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/invoices/${id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(
      res.ok
        ? { ok: true, text: data.message || "Done." }
        : { ok: false, text: data.error || `Action failed (${res.status}).` }
    );
    await load();
  }

  async function deleteInvoice() {
    if (!invoice) return;
    if (
      !confirmDelete(
        `Permanently delete invoice ${invoice.invoiceNumber}?\n\nOnly draft or void invoices with no payments can be deleted.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/invoices/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      router.push("/admin/invoices");
    } else {
      setMessage({ ok: false, text: data.error || `Delete failed (${res.status}).` });
    }
  }

  async function deletePayment(paymentId: string, amountCents: number) {
    if (
      !confirmDelete(
        `Permanently delete the ${fmt(amountCents)} payment? The invoice balance will be recalculated. Use only if the payment was recorded in error.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/invoices/${id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(
      res.ok
        ? { ok: true, text: "Payment deleted — balance recalculated." }
        : { ok: false, text: data.error || `Delete failed (${res.status}).` }
    );
    await load();
  }

  async function recordPayment() {
    const dollars = Number(payAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setMessage({ ok: false, text: "Enter a valid payment amount." });
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/invoices/${id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record-payment",
        amountCents: Math.round(dollars * 100),
        method: payMethod,
        reference: payRef || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      setMessage({ ok: true, text: data.message });
      setPayAmount("");
      setPayRef("");
      setShowPayForm(false);
    } else {
      setMessage({ ok: false, text: data.error || `Payment failed (${res.status}).` });
    }
    await load();
  }

  if (loading) return <p className="py-16 text-center text-sm text-muted-gray">Loading…</p>;
  if (!invoice)
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-gray">Invoice not found.</p>
        <Link href="/admin/invoices" className="mt-3 inline-block text-sm font-medium text-charcoal underline">
          Back to invoices
        </Link>
      </div>
    );

  const canSend = invoice.status === "DRAFT";
  const canResend = ["SENT", "VIEWED", "OVERDUE", "PARTIALLY_PAID"].includes(invoice.status);
  const canPay = invoice.balanceCents > 0 && invoice.status !== "DRAFT" && invoice.status !== "VOID";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/invoices"
            className="inline-flex size-10 items-center justify-center rounded-md border border-border text-charcoal"
            aria-label="Back to invoices"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div>
            <h1 className="font-heading text-3xl font-semibold text-charcoal">{invoice.invoiceNumber}</h1>
            <p className="text-sm text-muted-gray">
              {invoice.clientName} · {fmtStatus(invoice.status)}
              {invoice.sentAt && ` · sent ${new Date(invoice.sentAt).toLocaleDateString()}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSend && (
            <>
              <Link
                href={`/admin/invoices/${invoice.id}/edit`}
                className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-secondary"
              >
                Edit
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={() => act("send")}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-ivory hover:bg-charcoal/90 disabled:opacity-50"
              >
                <Send className="size-4" aria-hidden /> Send Invoice
              </button>
            </>
          )}
          {canResend && (
            <button
              type="button"
              disabled={busy}
              onClick={() => act("resend")}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-secondary disabled:opacity-50"
            >
              <RefreshCw className="size-4" aria-hidden /> Resend
            </button>
          )}
          {canPay && (
            <button
              type="button"
              onClick={() => setShowPayForm(!showPayForm)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-secondary"
            >
              <DollarSign className="size-4" aria-hidden /> Record Payment
            </button>
          )}
          {invoice.status !== "PAID" && invoice.status !== "VOID" && invoice.paidCents === 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirm(`Void invoice ${invoice.invoiceNumber}? This cannot be undone.`)) act("void");
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              <Ban className="size-4" aria-hidden /> Void
            </button>
          )}
          {(invoice.status === "DRAFT" || invoice.status === "VOID") && (
            <button
              type="button"
              disabled={busy}
              onClick={deleteInvoice}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden /> Delete
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-lg border p-4 text-sm font-medium ${
            message.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      )}

      {showPayForm && (
        <section id="record-payment" className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold text-charcoal">Record Payment</h2>
          <p className="mt-1 text-sm text-muted-gray">
            Balance due: <strong>{fmt(invoice.balanceCents)}</strong>
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="pay-amount" className="text-sm font-medium text-charcoal">
                Amount ($)
              </label>
              <input
                id="pay-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder={fmt(invoice.balanceCents).replace("$", "")}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
              />
            </div>
            <div>
              <label htmlFor="pay-method" className="text-sm font-medium text-charcoal">
                Method
              </label>
              <select
                id="pay-method"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3 text-charcoal"
              >
                <option value="ZELLE">Zelle</option>
                <option value="CASH_APP">Cash App</option>
                <option value="STRIPE">Stripe / Card</option>
                <option value="MANUAL">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="pay-ref" className="text-sm font-medium text-charcoal">
                Reference / note (optional)
              </label>
              <input
                id="pay-ref"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="e.g. Zelle confirmation #"
                className="mt-1 min-h-11 w-full rounded-md border border-border bg-background px-3"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={recordPayment}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-ivory hover:bg-charcoal/90 disabled:opacity-50"
          >
            Record Payment
          </button>
        </section>
      )}

      {/* Invoice document preview (what the client sees) */}
      <InvoiceDocument
        invoiceNumber={invoice.invoiceNumber}
        clientName={invoice.clientName}
        lineItems={invoice.lineItems}
        subtotalCents={invoice.subtotalCents}
        adjustmentCents={invoice.adjustmentCents}
        amountCents={invoice.amountCents}
        paidCents={invoice.paidCents}
        status={invoice.status}
        paymentTerms={invoice.paymentTerms}
        notes={invoice.notes}
        paymentInstructions={invoice.paymentInstructions}
        dueAt={invoice.dueAt}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payments */}
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold text-charcoal">Payments</h2>
          {invoice.payments.length === 0 ? (
            <p className="mt-3 text-sm text-muted-gray">No payments recorded yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-charcoal">{fmt(p.amountCents)}</p>
                    <p className="text-xs text-muted-gray">
                      {p.method.replace(/_/g, " ")}
                      {p.transactionReference ? ` · ${p.transactionReference}` : ""}
                      {p.paidAt ? ` · ${new Date(p.paidAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-green-300 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      {fmtStatus(p.status)}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => deletePayment(p.id, p.amountCents)}
                      aria-label={`Delete payment of ${fmt(p.amountCents)}`}
                      className="inline-flex size-8 items-center justify-center rounded-md border border-red-200 text-red-800 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Activity history */}
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-semibold text-charcoal">Activity History</h2>
          {invoice.activities.length === 0 ? (
            <p className="mt-3 text-sm text-muted-gray">No activity recorded.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {invoice.activities.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="font-medium text-charcoal">
                    {fmtStatus(a.event)}{" "}
                    <span className="text-xs font-normal text-muted-gray">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </p>
                  {a.detail && <p className="text-muted-gray">{a.detail}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
