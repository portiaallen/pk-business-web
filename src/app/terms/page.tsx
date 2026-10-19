import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";

export const metadata: Metadata = {
  title: {
    absolute: "Terms of Use | PK Business Services",
  },
  description:
    "The terms that apply to PK Business Services services, the $99 Readiness Assessment and its credit, consultations, and the client portal.",
};

function H2({ children }: { children: string }) {
  return (
    <h2 className="mt-10 mb-4 pk-heading text-2xl font-semibold text-charcoal">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed text-muted-gray">{children}</p>;
}

function LI({ children }: { children: React.ReactNode }) {
  return <li className="mb-2 leading-relaxed text-muted-gray">{children}</li>;
}

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of Use"
        subtitle="The terms that apply when you use pkservices.business and PK services. Last updated October 19, 2026."
      />
      <Section>
        <div className="mx-auto max-w-3xl">
          <H2>1. Who we are</H2>
          <P>
            PK Business Services (&quot;PK&quot;, &quot;we&quot;) is a sole
            proprietorship operated by Portia Allen, serving individuals,
            self-employed professionals, entrepreneurs, and small businesses.
            These terms apply to pkservices.business, the client portal, and
            the services described on the site. Using the site means you agree
            to these terms.
          </P>

          <H2>2. The services</H2>
          <P>
            PK provides bookkeeping and financial documentation services and
            tax preparation services. Current service families and starting
            prices, as published on the site:
          </P>
          <ul className="mb-4 list-disc pl-6">
            <LI>QuickBooks Cleanup, starting at $250.</LI>
            <LI>Tax-Ready Bookkeeping, starting at $400.</LI>
            <LI>Monthly Bookkeeping Support, starting at $300 per month.</LI>
            <LI>Income Verification &amp; Documentation, consultation-based pricing.</LI>
            <LI>
              The PK Books, Business &amp; Tax Season Readiness Assessment,
              $99 one-time (section 4 below).
            </LI>
            <LI>
              The PK Tax Division: individual returns (Essential $199, Family
              $249, Self-Employed from $399) and business returns (Form 1065
              from $749, 1120-S and 1120 from $799, which include up to two
              K-1s), plus the published add-on and prior-year pricing. Full
              current pricing lives on the Tax Division page.
            </LI>
          </ul>
          <P>
            Starting prices are general guidance. Final pricing depends on
            scope, transaction volume, complexity, the number of accounts, and
            the condition of your records, and is confirmed with you before
            work begins. Tax pricing: no PK e-file fees and no hidden markups;
            upfront payment is the default; the optional refund transfer is a
            separate bank product with its own fees set by the bank;
            bookkeeping is billed separately.
          </P>

          <H2>3. Consultations</H2>
          <P>
            Requesting a consultation through the site creates no obligation
            on either side. We review your request, respond through your
            preferred contact method, and agree on scope and price before any
            work starts. A consultation is not a promise of a particular
            result.
          </P>

          <H2>4. The $99 Readiness Assessment and the $99 credit</H2>
          <P>
            The assessment is a one-time professional review of where your
            books, records, and business stand, delivered as a written PK
            Readiness Report with recommended next steps. It is not tax return
            preparation or filing, and no bookkeeping cleanup, correction, or
            reconciliation is performed during the assessment.
          </P>
          <P>The credit terms:</P>
          <ul className="mb-4 list-disc pl-6">
            <LI>
              If your report recommends PK work, your full $99 may be applied
              toward one qualifying PK service related to a need named in your
              Readiness Report.
            </LI>
            <LI>
              Express interest within 14 calendar days of final report delivery
              to claim it. Once timely claimed and PK-approved, redeem it
              against a valid qualifying invoice within six months of final
              report delivery. Both clocks start at final report delivery, not
              at purchase.
            </LI>
            <LI>
              PK approval is required; a claim does not automatically apply
              the credit.
            </LI>
            <LI>
              The credit has no cash value, is nontransferable, cannot be
              divided, and cannot exceed the qualifying invoice amount. It
              cannot be applied to an unrelated PK service or to an outside
              provider.
            </LI>
            <LI>
              The assessment is a complete service on its own, whether or not
              you ever buy anything else.
            </LI>
          </ul>

          <H2>5. Your responsibilities</H2>
          <P>
            You agree to provide accurate information and authentic records.
            PK works only with authentic, client-provided financial
            information and legitimate documentation. We do not create, alter,
            fabricate, backdate, or misrepresent financial records or proof of
            income. You keep your portal account credentials secure and tell
            us promptly about anything you believe is unauthorized.
          </P>

          <H2>6. Information security</H2>
          <P>
            Never send Social Security numbers, ITINs, IP PINs, bank account
            numbers, passwords, account credentials, or other highly sensitive
            financial information through public forms on this site. Public
            forms are screened for exactly that and such submissions are
            rejected and not stored. During an engagement, documents move
            through the secure process PK sets up, and tax return preparation
            and e-filing happen through your personalized TaxSmart Pro client
            portal.
          </P>

          <H2>7. Payment</H2>
          <P>
            Invoices are paid through the payment link on this site. Upfront
            payment is the default for tax services. Prices for services are
            confirmed with you before work begins.
          </P>

          <H2>8. Marketing email</H2>
          <P>
            Marketing email from PK Business Services, Glitter Hits, and
            Glitter Universe is strictly opt-in. The optional checkbox on the
            signup and consultation forms is unchecked by default, your choice
            is recorded with its wording and timestamp, and every marketing
            email carries a working unsubscribe link honored across all three
            brands. There is no SMS or text message marketing. Services,
            bookings, founding member benefits, and the Glitter Hits founding
            member PK coupon never depend on your marketing email choice.
          </P>

          <H2>9. No advice, no guarantees</H2>
          <P>
            Information on this site is general service information and does
            not constitute legal, financial, or tax advice. Client outcomes
            depend on each client&apos;s own facts and records, and we do not
            guarantee specific results.
          </P>

          <H2>10. Intellectual property</H2>
          <P>
            The site, its copy, and its materials belong to PK Business
            Services. Your records, documents, and financial information stay
            yours, and we use them only to serve you.
          </P>

          <H2>11. Limitation of liability</H2>
          <P>
            To the fullest extent permitted by law, PK is not liable for
            indirect or consequential losses. Our liability for any claim is
            limited to the fees you actually paid us for the work giving rise
            to the claim.
          </P>

          <H2>12. Governing law</H2>
          <P>
            These terms are governed by the laws of the State of Texas, with
            venue in Harris County, Texas.
          </P>

          <H2>13. Changes</H2>
          <P>
            We update these terms as services and pricing change and date each
            update. The terms in force when you book work are the ones that
            apply to it.
          </P>

          <H2>14. Contact</H2>
          <P>
            Questions about these terms: info@pkservices.business, or the form
            at pkservices.business/contact.
          </P>
        </div>
      </Section>
    </>
  );
}
