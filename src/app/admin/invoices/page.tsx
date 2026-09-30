"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Send,
  Plus,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  Trash2,
} from "lucide-react";
import { confirmDelete } from "@/lib/confirm-delete";
import { formatCalendarDate } from "@/lib/calendar-date";

type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  amountCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  dueAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

type Summary = {
  counts: Record<string, number>;
  totalOutstandingCents: number;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border border-gray-300",
  SENT: "bg-blue-50 text-blue-800 border border-blue-300",
  VIEWED: "bg-purple-50 text-purple-800 border border-purple-300",
  PARTIALLY_PAID: "bg-amber-50 text-amber-900 border border-amber-300",
  PAID: "bg-green-50 text-green-800 border border-green-300",
  OVERDUE: "bg-red-50 text-red-800 border border-red-300",
  VOID: "bg-gray-100 text-gray-500 border border-gray-300 line-through",
};

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function fmtStatus(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/invoices");
    if (res.ok) {
      const data = await res.json();
      setInvoices(data.invoices);
      setSummary(data.summary);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: string) {
    setMessage(null);
    const res = await fetch(`/api/admin/invoices/${id}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.message) {
      setMessage({ ok: true, text: data.message });
    } else {
      setMessage({ ok: false, text: data.error || `Action failed (${res.status}).` });
    }
    await load();
  }

  async function deleteInvoice(inv: Invoice) {
    if (
      !confirmDelete(
        `Permanently delete invoice ${inv.invoiceNumber}?\n\nOnly draft or void invoices with no payments can be deleted.`
      )
    ) {
      return;
    }
    setMessage(null);
    const res = await fetch(`/api/admin/invoices/${inv.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage({ ok: true, text: `Invoice ${inv.invoiceNumber} deleted.` });
    } else {
      setMessage({ ok: false, text: data.error || `Delete failed (${res.status}).` });
    }
    await load();
  }

  const filtered = filter === "ALL" ? invoices : invoices.filter((i) => i.status === filter);

  const counters = [
    { key: "DRAFT", label: "Draft", icon: FileText },
    { key: "SENT", label: "Sent", icon: Send },
    { key: "VIEWED", label: "Viewed", icon: Clock },
    { key: "PARTIALLY_PAID", label: "Partial", icon: DollarSign },
    { key: "OVERDUE", label: "Overdue", icon: AlertCircle },
    { key: "PAID", label: "Paid", icon: CheckCircle2 },
    { key: "VOID", label: "Void", icon: Ban },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold text-charcoal">Invoices</h1>
          <p className="mt-1 text-sm text-muted-gray">
            {summary
              ? `Outstanding balance across all clients: ${fmt(summary.totalOutstandingCents)}`
              : "Loading…"}
          </p>
        </div>
        <Link
          href="/admin/invoices/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-charcoal/90"
        >
          <Plus className="size-4" aria-hidden />
          New Invoice
        </Link>
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-lg border p-4 text-sm font-medium ${
            message.ok
              ? "border-green-300 bg-green-50 text-green-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {counters.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(filter === key ? "ALL" : key)}
            aria-pressed={filter === key}
            className={`flex min-h-11 flex-col items-start rounded-lg border p-3 text-left transition-colors ${
              filter === key
                ? "border-charcoal bg-cream"
                : "border-border bg-card hover:border-charcoal/30"
            }`}
          >
            <span className="flex w-full items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-gray">
                {label}
              </span>
              <Icon className="size-4 text-charcoal" aria-hidden />
            </span>
            <span className="mt-1 font-heading text-2xl font-semibold text-charcoal">
              {summary?.counts[key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Invoice list */}
      <div className="rounded-lg border border-border bg-card">
        {loading ? (
          <p className="p-8 text-center text-sm text-muted-gray">Loading invoices…</p>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="mx-auto size-10 text-muted-gray/40" />
            <p className="mt-3 text-sm text-muted-gray">
              {filter === "ALL"
                ? "No invoices yet. Create your first invoice to get started."
                : `No ${fmtStatus(filter).toLowerCase()} invoices.`}
            </p>
            {filter === "ALL" && (
              <Link
                href="/admin/invoices/new"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-ivory"
              >
                <Plus className="size-4" aria-hidden />
                New Invoice
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/invoices/${inv.id}`}
                      className="font-semibold text-charcoal hover:text-gold"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[inv.status] || "bg-muted text-muted-foreground"}`}
                    >
                      {fmtStatus(inv.status)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-gray">
                    {inv.clientName} · {fmt(inv.amountCents)}
                    {inv.paidCents > 0 && inv.status !== "PAID" && (
                      <> · paid {fmt(inv.paidCents)} · balance {fmt(inv.balanceCents)}</>
                    )}
                    {inv.dueAt && inv.status !== "PAID" && (
                      <> · due {formatCalendarDate(inv.dueAt)}</>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/admin/invoices/${inv.id}`}
                    className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-charcoal hover:bg-secondary"
                  >
                    View
                  </Link>
                  {inv.status === "DRAFT" && (
                    <>
                      <Link
                        href={`/admin/invoices/${inv.id}/edit`}
                        className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-charcoal hover:bg-secondary"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => act(inv.id, "send")}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-charcoal px-3 py-2 text-sm font-medium text-ivory hover:bg-charcoal/90"
                      >
                        <Send className="size-4" aria-hidden />
                        Send Invoice
                      </button>
                    </>
                  )}
                  {(inv.status === "SENT" || inv.status === "VIEWED" || inv.status === "OVERDUE" || inv.status === "PARTIALLY_PAID") && (
                    <>
                      <button
                        type="button"
                        onClick={() => act(inv.id, "resend")}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-charcoal hover:bg-secondary"
                      >
                        <Send className="size-4" aria-hidden />
                        Resend
                      </button>
                      <Link
                        href={`/admin/invoices/${inv.id}#record-payment`}
                        className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 py-2 text-sm font-medium text-charcoal hover:bg-secondary"
                      >
                        Record Payment
                      </Link>
                    </>
                  )}
                  {inv.status !== "PAID" && inv.status !== "VOID" && inv.paidCents === 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Void invoice ${inv.invoiceNumber}? This cannot be undone.`)) {
                          act(inv.id, "void");
                        }
                      }}
                      className="inline-flex min-h-11 items-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
                    >
                      Void
                    </button>
                  )}
                  {(inv.status === "DRAFT" || inv.status === "VOID") && (
                    <button
                      type="button"
                      onClick={() => deleteInvoice(inv)}
                      aria-label={`Delete invoice ${inv.invoiceNumber}`}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-50"
                    >
                      <Trash2 className="size-4" aria-hidden />
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
