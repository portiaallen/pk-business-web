"use client";

import { CreditCard, Building, DollarSign } from "lucide-react";

type LineItem = { description: string; quantity: number; rateCents: number; amountCents: number };

function fmt(c: number) {
  return `$${(c / 100).toFixed(2)}`;
}

export function InvoiceDocument({
  invoiceNumber,
  clientName,
  lineItems,
  subtotalCents,
  adjustmentCents,
  amountCents,
  paidCents,
  status,
  paymentTerms,
  notes,
  paymentInstructions,
  dueAt,
  paymentOptions,
}: {
  invoiceNumber: string;
  clientName: string;
  lineItems: LineItem[];
  subtotalCents: number;
  adjustmentCents: number;
  amountCents: number;
  paidCents?: number;
  status?: string;
  paymentTerms: string | null;
  notes: string | null;
  paymentInstructions: string | null;
  dueAt: string | null;
  paymentOptions?: { stripeUrl: string; zelleEmail: string; cashAppTag: string };
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-charcoal">
            PK BUSINESS SERVICES
          </h2>
          <p className="text-sm text-muted-gray">INVOICE</p>
        </div>
        {status && (
          <span className="rounded-full border border-border bg-cream px-3 py-1 text-xs font-semibold uppercase tracking-wide text-charcoal">
            {status.replace(/_/g, " ")}
          </span>
        )}
      </div>

      <div className="grid gap-4 border-b border-border py-6 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-gray">Invoice #</p>
          <p className="font-semibold text-charcoal">{invoiceNumber}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-gray">Bill To</p>
          <p className="font-semibold text-charcoal">{clientName}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-gray">Due</p>
          <p className="font-semibold text-charcoal">
            {dueAt ? new Date(dueAt).toLocaleDateString() : "Upon receipt"}
          </p>
        </div>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="py-2 font-semibold text-charcoal">Description</th>
            <th className="py-2 text-right font-semibold text-charcoal">Hours/Qty</th>
            <th className="py-2 text-right font-semibold text-charcoal">Rate</th>
            <th className="py-2 text-right font-semibold text-charcoal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((it, i) => (
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
          <span className="text-charcoal">{fmt(subtotalCents)}</span>
        </div>
        {adjustmentCents !== 0 && (
          <div className="flex justify-between">
            <span className="text-muted-gray">Adjustment</span>
            <span className="text-charcoal">{fmt(adjustmentCents)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-1.5">
          <span className="font-semibold text-charcoal">Total</span>
          <span className="font-heading text-lg font-semibold text-charcoal">{fmt(amountCents)}</span>
        </div>
        {typeof paidCents === "number" && paidCents > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-gray">Paid</span>
              <span className="text-green-800">−{fmt(paidCents)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-1.5">
              <span className="font-semibold text-charcoal">Balance Due</span>
              <span className="font-semibold text-charcoal">{fmt(amountCents - paidCents)}</span>
            </div>
          </>
        )}
      </div>

      {(paymentTerms || notes) && (
        <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
          {paymentTerms && (
            <p className="text-charcoal">
              <span className="font-semibold">Payment Terms:</span> {paymentTerms}
            </p>
          )}
          {notes && <p className="text-muted-gray">{notes}</p>}
        </div>
      )}

      <div className="mt-6 border-t border-border pt-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-gray">
          Payment Options
        </p>
        {paymentInstructions && <p className="mt-1 text-sm text-charcoal">{paymentInstructions}</p>}
        {paymentOptions ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <a
              href={paymentOptions.stripeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-ivory hover:bg-charcoal/90"
            >
              <CreditCard className="size-4" aria-hidden /> Pay by Card
            </a>
            <div className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-charcoal">
              <Building className="size-4" aria-hidden /> Zelle: {paymentOptions.zelleEmail}
            </div>
            <div className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-charcoal">
              <DollarSign className="size-4" aria-hidden /> Cash App: {paymentOptions.cashAppTag}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-gray">
            Card (Stripe), Zelle, or Cash App — payment links and details are provided in the client portal and at pkservices.business/pay. No card-payment service fee is charged.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-gray">
          Please include the invoice number ({invoiceNumber}) in your payment note.
        </p>
      </div>
    </div>
  );
}
