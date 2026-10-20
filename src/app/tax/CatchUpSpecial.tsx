import Link from "next/link";

const catchUpTerms = [
  "$99 applies to every qualifying simple 1040, even a single year — no bundle required.",
  "Separate $35 federal e-filing fee per eligible return. Illustrative total: $134 for a $99 simple return with federal e-file.",
  "Customers pay PK directly. No refund transfers and no bank products.",
  "Form 1040 individual returns only — no 1065, 1120, or 1120-S.",
  "Tax years 2023, 2024, and 2025. E-file eligibility is confirmed per year before filing; where electronic transmission is not available, PK explains and prepares paper filing.",
  "No refund guarantees.",
];

const catchUpTiers = [
  {
    name: "Simple",
    who: "A W-2 and a straightforward return — the standard filing.",
  },
  {
    name: "Plus",
    who: "Multiple income sources, tax credits, or itemized deductions.",
  },
  {
    name: "Self-Employed",
    who: "1099 income and Schedule C business activity.",
  },
  {
    name: "Advanced",
    who: "Rental properties, investments, or complex schedules.",
  },
];

export function CatchUpSpecial() {
  return (
    <section
      id="catch-up"
      className="section-padding bg-charcoal text-ivory"
    >
      <div className="container-narrow">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-gold px-3 py-1 text-xs font-semibold uppercase tracking-wide text-charcoal">
            Now live · Catch-Up 1040 Special
          </span>
          <span className="text-xs uppercase tracking-wide text-ivory/60">
            Limited-time pricing
          </span>
        </div>

        <h2 className="pk-heading mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
          Behind on Your Taxes?{" "}
          <em className="text-gold-light">Let&apos;s Get You Caught Up!</em>
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ivory/80">
          Catch-Up 1040 Special — Individual tax preparation for 2023, 2024
          and 2025. Qualifying simple returns start at{" "}
          <strong className="text-ivory">$99 per tax year</strong>. Multi-year
          bundle savings available.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Price panel */}
          <div className="rounded-2xl bg-cream p-6 text-charcoal sm:p-8">
            <p className="text-xs uppercase tracking-wide text-muted-gray">
              Qualifying simple returns
            </p>
            <p className="pk-heading mt-2 text-5xl font-semibold text-charcoal">
              $99
              <span className="ml-2 text-base font-medium text-muted-gray">
                per tax year
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-gray">
              Every qualifying simple 1040, even a single year. No bundle
              required.
            </p>
            <div className="mt-5 rounded-xl border border-gold-light/60 bg-ivory p-4">
              <p className="text-sm font-semibold text-charcoal">
                Federal e-file: +$35 per eligible return
              </p>
              <p className="mt-1 text-sm text-muted-gray">
                Illustrative total for an eligible simple return with federal
                e-file: <strong className="text-charcoal">$134</strong> — $99
                preparation + $35 federal e-file.
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-gray">
              Customers pay PK directly — no refund transfers, no bank
              products.
            </p>
            <Link
              href="/tax/catchup-intake"
              className="mt-6 block rounded-lg bg-charcoal px-6 py-4 text-center text-base font-semibold text-ivory transition-colors hover:bg-gold"
            >
              Start My Catch-Up 1040 Intake →
            </Link>
          </div>

          {/* Terms + tiers */}
          <div>
            <ul className="space-y-3">
              {catchUpTerms.map((term) => (
                <li
                  key={term}
                  className="flex items-start gap-3 text-sm leading-relaxed text-ivory/80"
                >
                  <span aria-hidden="true" className="mt-0.5 text-gold">
                    ✓
                  </span>
                  <span>{term}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {catchUpTiers.map((tier) => (
                <div
                  key={tier.name}
                  className="rounded-xl border border-ivory/15 bg-ivory/5 p-4"
                >
                  <p className="text-sm font-semibold text-gold-light">
                    {tier.name}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-ivory/70">
                    {tier.who}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-sm leading-relaxed text-ivory/70">
              Other return types and multi-year bundles: request a quote.
              Final pricing depends on review — filing, amendments,
              missing-record cleanup, and additional complexity are quoted
              separately.
            </p>
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-xs leading-relaxed text-ivory/60">
          The $99 Business &amp; Tax Season Readiness Assessment is a separate
          service and is not included with tax preparation. Official tax-season
          launch messaging for the 2026 filing season arrives in January 2027.
        </p>
      </div>
    </section>
  );
}
