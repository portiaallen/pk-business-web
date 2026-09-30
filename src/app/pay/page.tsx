import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { CreditCard, Building, DollarSign, ArrowLeft } from "lucide-react";
import { siteConfig } from "@/content/site";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: `Pay an Invoice — ${siteConfig.name}`,
  description:
    "Payment options for PK Business Services invoices: credit/debit card via Stripe, Zelle, and Cash App.",
};

const ZELLE_EMAIL =
  process.env.PAYMENT_ZELLE_EMAIL || "portiaallen40@gmail.com";
const CASH_APP_TAG = process.env.PAYMENT_CASHAPP_TAG || "$portiaallen40";

export default async function PublicPayPage() {
  await connection();
  const stripeEnabled = Boolean(
    process.env.STRIPE_SECRET_KEY?.trim() &&
    process.env.STRIPE_WEBHOOK_SECRET?.trim()
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-background">
        <div className="container-wide flex h-16 items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-gray transition-colors hover:text-charcoal"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to {siteConfig.name}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container-wide section-padding">
          <div className="mx-auto max-w-2xl space-y-8">
            <div>
              <h1 className="font-heading text-4xl font-semibold text-charcoal">
                Pay an Invoice
              </h1>
              <p className="mt-2 text-muted-gray">
                Three convenient ways to pay your PK Business Services invoice.
                Choose whichever works best for you.
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Before you pay</p>
              <p className="mt-1">
                Include your <strong>invoice number</strong> (e.g.
                PK-2026-0910-001) in the payment note or memo so we can apply
                your payment correctly. Amounts due are stated on your invoice.
              </p>
            </div>

            <div className="space-y-6">
              {/* Stripe */}
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <CreditCard className="mt-1 size-6 text-charcoal" aria-hidden />
                  <div className="flex-1">
                    <h2 className="font-heading text-xl font-semibold text-charcoal">
                      Credit / Debit Card
                    </h2>
                    <p className="mt-1 text-sm text-muted-gray">
                      Secure exact-balance checkout hosted by Stripe. Sign-in is required to pay by card.
                    </p>
                    {stripeEnabled ? (
                      <Link
                        href="/portal/invoices"
                        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-5 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-charcoal/90"
                      >
                        <CreditCard className="size-4" aria-hidden />
                        Sign in to pay by card
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
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <Building className="mt-1 size-6 text-charcoal" aria-hidden />
                  <div className="flex-1">
                    <h2 className="font-heading text-xl font-semibold text-charcoal">
                      Zelle
                    </h2>
                    <p className="mt-1 text-sm text-muted-gray">
                      Send from your banking app. Typically instant, no fee.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <code className="rounded-md border border-border bg-cream px-3 py-2 text-sm font-semibold text-charcoal">
                        {ZELLE_EMAIL}
                      </code>
                    </div>
                    <p className="mt-3 text-xs text-muted-gray">
                      In your banking app: Zelle → Send → enter this email →
                      the invoice amount → invoice number in the memo.
                    </p>
                  </div>
                </div>
              </section>

              {/* Cash App */}
              <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <DollarSign className="mt-1 size-6 text-charcoal" aria-hidden />
                  <div className="flex-1">
                    <h2 className="font-heading text-xl font-semibold text-charcoal">
                      Cash App
                    </h2>
                    <p className="mt-1 text-sm text-muted-gray">
                      Send to our Cash App cashtag.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <code className="rounded-md border border-border bg-cream px-3 py-2 text-sm font-semibold text-charcoal">
                        {CASH_APP_TAG}
                      </code>
                      <a
                        href="https://cash.app/$portiaallen40"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-secondary"
                      >
                        Open Cash App
                      </a>
                    </div>
                    <p className="mt-3 text-xs text-muted-gray">
                      Include the invoice number in the note (e.g. “Deposit
                      PK-2026-0910-001”).
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="rounded-lg border border-border bg-cream/50 p-4 text-sm text-muted-gray">
              <p>
                Questions about an invoice? Reach out through our{" "}
                <Link
                  href="/contact"
                  className="font-medium text-charcoal underline underline-offset-2"
                >
                  contact page
                </Link>{" "}
                and we&apos;ll confirm receipt once your payment lands.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
