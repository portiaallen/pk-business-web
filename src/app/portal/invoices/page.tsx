"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, Building, DollarSign, FileText } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

type LineItem = { description: string; quantity: number; rateCents: number; amountCents: number };
type Invoice = {
  id: string;
  invoiceNumber: string;
  description: string | null;
  lineItems: LineItem[];
  subtotalCents: number;
  adjustmentCents: number;
  amountCents: number;
  paidCents: number;
  balanceCents: number;
  status: string;
  paymentTerms: string | null;
  paymentInstructions: string | null;
  dueAt: string | null;
};
type PaymentOptions = { stripeUrl: string; zelleEmail: string; cashAppTag: string };

function fmt(c: number) {
  return `$${(c / 100).toFixed(2)}`;
}
function fmtStatus(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_STYLES: Record<string, string> = {
  SENT: "bg-blue-50 text-blue-800 border border-blue-300",
  VIEWED: "bg-purple-50 text-purple-800 border border-purple-300",
  PARTIALLY_PAID: "bg-amber-50 text-amber-900 border border-amber-300",
  PAID: "bg-green-50 text-green-800 border border-green-300",
  OVERDUE: "bg-red-50 text-red-800 border border-red-300",
};

export default function PortalInvoicesPage() {
  const { loading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [options, setOptions] = useState<PaymentOptions | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    fetch("/api/portal/invoices")
      .then(async (r) => {
        if (!r.ok) {
          setError("Unable to load invoices.");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setInvoices(data.invoices);
          setOptions(data.paymentOptions);
        }
      })
      .catch(() => setError("Unable to load invoices."));
  }, [authLoading]);

  if (invoices === null && !error) {
    return <p className="py-16 text-center text-sm text-muted-gray">Loading…</p>;
  }
  if (error) {
    return <p className="py-16 text-center text-sm text-red-800">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">Invoices</h1>
        <p className="mt-1 text-sm text-muted-gray">
          Your invoices and payment options. Please include the invoice number in your payment note.
        </p>
      </div>

      {(invoices?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center">
          <FileText className="mx-auto size-10 text-muted-gray/40" />
          <p className="mt-3 text-sm text-muted-gray">No invoices yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {invoices!.map((inv) => (
            <article key={inv.id} className="rounded-xl border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
                <div>
                  <h2 className="font-heading text-xl font-semibold text-charcoal">
                    Invoice {inv.invoiceNumber}
                  </h2>
                  <p className="text-sm text-muted-gray">
                    Due {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "upon receipt"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[inv.status] || "border border-border bg-cream text-charcoal"}`}
                >
                  {fmtStatus(inv.status)}
                </span>
              </div>

              <table className="mt-4 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 font-semibold text-charcoal">Description</th>
                    <th className="py-2 text-right font-semibold text-charcoal">Hours/Qty</th>
                    <th className="py-2 text-right font-semibold text-charcoal">Rate</th>
                    <th className="py-2 text-right font-semibold text-charcoal">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lineItems.map((it, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="py-2.5 pr-3 text-charcoal">{it.description}</td>
                      <td className="py-2.5 text-right text-charcoal">{it.quantity}</td>
                      <td className="py-2.5 text-right text-charcoal">{fmt(it.rateCents)}</td>
                      <td className="py-2.5 text-right font-medium text-charcoal">{fmt(it.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 ml-auto max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-gray">Subtotal</span>
                  <span className="text-charcoal">{fmt(inv.subtotalCents)}</span>
                </div>
                {inv.adjustmentCents !== 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Adjustment</span>
                    <span className="text-charcoal">{fmt(inv.adjustmentCents)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-1.5">
                  <span className="font-semibold text-charcoal">Total</span>
                  <span className="font-heading text-lg font-semibold text-charcoal">{fmt(inv.amountCents)}</span>
                </div>
                {inv.paidCents > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-gray">Paid</span>
                      <span className="text-green-800">−{fmt(inv.paidCents)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1.5">
                      <span className="font-semibold text-charcoal">Balance Due</span>
                      <span className="font-semibold text-charcoal">{fmt(inv.balanceCents)}</span>
                    </div>
                  </>
                )}
              </div>

              {inv.paymentTerms && (
                <p className="mt-4 border-t border-border pt-4 text-sm text-charcoal">
                  <span className="font-semibold">Payment Terms:</span> {inv.paymentTerms}
                </p>
              )}
              {inv.paymentInstructions && (
                <p className="mt-2 text-sm text-muted-gray">{inv.paymentInstructions}</p>
              )}

              {inv.balanceCents > 0 && options && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={options.stripeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-ivory hover:bg-charcoal/90"
                  >
                    <CreditCard className="size-4" aria-hidden /> Pay by Card
                  </a>
                  <div className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-charcoal">
                    <Building className="size-4" aria-hidden /> Zelle: {options.zelleEmail}
                  </div>
                  <div className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-charcoal">
                    <DollarSign className="size-4" aria-hidden /> Cash App: {options.cashAppTag}
                  </div>
                </div>
              )}
              {inv.status === "PAID" && (
                <p className="mt-4 rounded-md border border-green-300 bg-green-50 p-3 text-sm font-medium text-green-900">
                  This invoice has been paid in full — thank you.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
