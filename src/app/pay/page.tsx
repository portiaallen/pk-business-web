import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { CreditCard, Building, DollarSign } from "lucide-react";
import { isStripeConfigured } from "@/lib/invoices";
import { siteConfig } from "@/content/site";
import { PageHero } from "@/components/layout/PageHero";

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
  // Use the same runtime readiness check as portal options and secure checkout.
  const stripeEnabled = isStripeConfigured();

  return (
    <>
      <PageHero
        eyebrow="Invoice payments"
        title="A clear way to settle up."
        subtitle="Pay for the work on your PK Business Services invoice. Your invoice is the source for the amount due and your payment terms."
      />
      <div className="container-wide section-padding">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="rounded-lg border border-gold/40 bg-cream p-5 text-sm text-charcoal">
            <p className="font-semibold">Before you pay</p>
            <p className="mt-1">
              Include your <strong>invoice number</strong> (e.g.
              PK-2026-0910-001) in the payment note or memo so we can apply your
              payment correctly. Amounts due are stated on your invoice.
            </p>
          </div>

          <div className="space-y-6">
            {/* Stripe */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <CreditCard className="mt-1 size-6 text-charcoal" aria-hidden />
                <div className="min-w-0 flex-1">
                  <h2 className="pk-heading text-xl font-semibold text-charcoal">
                    Credit / Debit Card
                  </h2>
                  <p className="mt-1 text-sm text-muted-gray">
                    Secure exact-balance checkout hosted by Stripe. Sign-in is
                    required to pay by card.
                  </p>
                  {stripeEnabled ? (
                    <>
                      <p className="mt-4 text-sm font-semibold text-charcoal">
                        Card payments are available. Pay the exact balance on
                        your invoice through secure Stripe checkout.
                      </p>
                      <Link
                        href="/portal/invoices"
                        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-charcoal px-5 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-charcoal/90"
                      >
                        <CreditCard className="size-4" aria-hidden />
                        Sign in to pay by card
                      </Link>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-muted-gray">
                      Card checkout is not configured in this environment.
                      Please{" "}
                      <Link
                        href="/contact"
                        className="font-medium text-charcoal underline underline-offset-2"
                      >
                        contact PK
                      </Link>{" "}
                      for help with your invoice.
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Zelle */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <Building className="mt-1 size-6 text-charcoal" aria-hidden />
                <div className="min-w-0 flex-1">
                  <h2 className="pk-heading text-xl font-semibold text-charcoal">
                    Zelle
                  </h2>
                  <p className="mt-1 text-sm text-muted-gray">
                    Send from your banking app. Typically instant, no fee.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <code className="break-all rounded-md border border-border bg-cream px-3 py-2 text-sm font-semibold text-charcoal">
                      {ZELLE_EMAIL}
                    </code>
                  </div>
                  <p className="mt-3 text-xs text-muted-gray">
                    In your banking app: Zelle → Send → enter this email → the
                    invoice amount → invoice number in the memo.
                  </p>
                </div>
              </div>
            </section>

            {/* Cash App */}
            <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <DollarSign className="mt-1 size-6 text-charcoal" aria-hidden />
                <div className="min-w-0 flex-1">
                  <h2 className="pk-heading text-xl font-semibold text-charcoal">
                    Cash App
                  </h2>
                  <p className="mt-1 text-sm text-muted-gray">
                    Send to our Cash App cashtag.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <code className="break-all rounded-md border border-border bg-cream px-3 py-2 text-sm font-semibold text-charcoal">
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
    </>
  );
}
