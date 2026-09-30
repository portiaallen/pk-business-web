"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Check, CreditCard, Building, DollarSign, Mail } from "lucide-react";

type PaymentConfig = {
  stripeEnabled: boolean;
  zelleEmail: string;
  cashAppTag: string;
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // clipboard unavailable
        }
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-secondary"
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <Check className="size-4 text-green-600" aria-hidden />
      ) : (
        <Copy className="size-4" aria-hidden />
      )}
      {copied ? "Copied" : `Copy ${label}`}
    </button>
  );
}

export default function PortalPaymentsPage() {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/portal/payments")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setConfig(data))
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-gray">Loading payment options...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Payments
        </h1>
        <p className="mt-1 text-muted-gray">
          Payment options for PK Business Services invoices.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">Before you pay</p>
        <p className="mt-1">
          Include your <strong>invoice number</strong> (e.g. PK-2026-0910-001) in
          the payment note or memo so we can apply your payment correctly. Amounts
          due are stated on your invoice.
        </p>
      </div>

      <div className="space-y-6">
        {/* Stripe */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 size-5 text-charcoal" aria-hidden />
            <div className="flex-1">
              <h2 className="font-heading text-lg font-semibold text-charcoal">
                Credit / Debit Card — Stripe
              </h2>
              <p className="mt-1 text-sm text-muted-gray">
                Secure card checkout is available from your invoice for its exact remaining balance.
              </p>
              {config?.stripeEnabled ? (
                <Link
                  href="/portal/invoices"
                  className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-charcoal px-4 py-2 text-sm font-medium text-ivory transition-colors hover:bg-charcoal/90"
                >
                  <CreditCard className="size-4" aria-hidden />
                  Choose an invoice to pay by card
                </Link>
              ) : (
                <p className="mt-4 text-sm text-muted-gray">
                  Card payments are currently unavailable.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Zelle */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <Building className="mt-0.5 size-5 text-charcoal" aria-hidden />
            <div className="flex-1">
              <h2 className="font-heading text-lg font-semibold text-charcoal">
                Zelle
              </h2>
              <p className="mt-1 text-sm text-muted-gray">
                Send from your banking app to the email below. Zelle payments
                typically arrive instantly with no fee.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <code className="rounded-md border border-border bg-cream px-3 py-2 text-sm font-semibold text-charcoal">
                  {config?.zelleEmail ?? "portiaallen40@gmail.com"}
                </code>
                <CopyButton
                  value={config?.zelleEmail ?? "portiaallen40@gmail.com"}
                  label="Zelle email"
                />
              </div>
              <p className="mt-3 text-xs text-muted-gray">
                In your banking app: choose Zelle → Send → enter this email →
                enter the invoice amount → put the invoice number in the memo.
              </p>
            </div>
          </div>
        </section>

        {/* Cash App */}
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <DollarSign className="mt-0.5 size-5 text-charcoal" aria-hidden />
            <div className="flex-1">
              <h2 className="font-heading text-lg font-semibold text-charcoal">
                Cash App
              </h2>
              <p className="mt-1 text-sm text-muted-gray">
                Send to our Cash App cashtag below.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <code className="rounded-md border border-border bg-cream px-3 py-2 text-sm font-semibold text-charcoal">
                  {config?.cashAppTag ?? "$portiaallen40"}
                </code>
                <CopyButton
                  value={config?.cashAppTag ?? "$portiaallen40"}
                  label="Cash App cashtag"
                />
                <a
                  href={`https://cash.app/${(config?.cashAppTag ?? "$portiaallen40").replace("$", "$")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-secondary"
                >
                  Open Cash App
                </a>
              </div>
              <p className="mt-3 text-xs text-muted-gray">
                When sending, enter the invoice amount and include the invoice
                number in the note (e.g. “Deposit PK-2026-0910-001”).
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="rounded-lg border border-border bg-cream/50 p-4 text-sm text-muted-gray">
        <p>
          Questions about an invoice or payment? Send us a message through the{" "}
          <a href="/portal/messages" className="font-medium text-charcoal underline underline-offset-2">
            portal messages
          </a>{" "}
          and we&apos;ll confirm receipt once your payment lands.
        </p>
      </div>
    </div>
  );
}
