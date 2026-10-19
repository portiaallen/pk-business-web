import type { Metadata } from "next";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { MARKETING_CONSENT_COPY } from "@/lib/marketing-consent";

export const metadata: Metadata = {
  title: {
    absolute: "Privacy Policy | PK Business Services",
  },
  description:
    "How PK Business Services collects, uses, protects, and shares information, including the marketing email opt-in policy.",
};

function H2({ children }: { children: string }) {
  return (
    <h2 className="mt-10 mb-4 pk-heading text-2xl font-semibold text-charcoal">
      {children}
    </h2>
  );
}

function P({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("mb-4 leading-relaxed text-muted-gray", className)}>
      {children}
    </p>
  );
}

function LI({ children }: { children: React.ReactNode }) {
  return <li className="mb-2 leading-relaxed text-muted-gray">{children}</li>;
}

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="How PK Business Services handles your information. Last updated October 19, 2026."
      />
      <Section>
        <div className="mx-auto max-w-3xl">
          <p className="mb-8 rounded-lg border border-gold/30 bg-cream px-4 py-3 text-sm leading-relaxed text-muted-gray">
            Draft prepared for founder and counsel review on October 19, 2026.
            This page is not published yet. Remove this note before launch.
          </p>

          <H2>1. Who we are</H2>
          <P>
            PK Business Services (&quot;PK&quot;, &quot;we&quot;) is a sole
            proprietorship operated by Portia Allen, providing bookkeeping,
            QuickBooks support, financial record organization, income
            documentation packages, business and tax-season readiness
            assessments, and tax preparation services. This policy covers
            pkservices.business and the services described on it, including the
            client portal. Contact: info@pkservices.business or the form at
            pkservices.business/contact.
          </P>

          <H2>2. Information we collect</H2>
          <P>What we collect depends on how you use the site.</P>
          <ul className="mb-4 list-disc pl-6">
            <LI>
              Consultation requests: your name, email address, optional phone
              number, optional business name, the service you asked about, your
              description of your needs, your preferred contact method, and,
              optionally, your marketing email choice.
            </LI>
            <LI>
              Readiness assessment: after purchase, intake information PK
              requests through the secure process. The quick gut check on the
              assessment page runs entirely in your browser; those answers stay
              on your device and are never sent to us.
            </LI>
            <LI>
              Client portal accounts: your name, email address, and the
              passkey (WebAuthn authenticator) you register. Passkeys are
              stored so that only a public key leaves your device.
            </LI>
            <LI>
              Payments: payments are processed by Stripe. Card numbers are
              entered on Stripe&apos;s page and never touch or stay on PK
              systems. We receive billing records such as the invoice amount,
              status, and the email address on the invoice.
            </LI>
            <LI>
              Email you send us, and the replies we send you.
            </LI>
          </ul>

          <H2>3. Sensitive information: what never to send here</H2>
          <P>
            Please never send Social Security numbers, ITINs, IP PINs, bank
            account numbers, passwords, account credentials, or other highly
            sensitive financial information through public forms on this site.
            The forms are screened for exactly that, and a submission carrying
            it is rejected and not stored. During an actual engagement,
            documents move through the secure process PK sets up for you, and
            tax return preparation and e-filing happen through your own
            personalized TaxSmart Pro client portal, not through public forms.
          </P>

          <H2>4. How we use information</H2>
          <ul className="mb-4 list-disc pl-6">
            <LI>To respond to consultation requests and provide the services you asked about.</LI>
            <LI>To deliver booked work, share documents and deliverables, and invoice for completed work.</LI>
            <LI>To send service communications about your work with us, such as appointment or document requests.</LI>
            <LI>To keep accounts and the site secure, and to meet legal and tax recordkeeping obligations.</LI>
          </ul>

          <H2>5. Marketing email: opt-in only</H2>
          <P>
            PK Business Services, Glitter Hits, and Glitter Universe send
            marketing email only to people who chose to receive it. The
            signup and consultation forms carry an optional checkbox, unchecked
            by default, with this wording, which is recorded word for word with
            every consent:
          </P>
          <P className="italic">
            &ldquo;{MARKETING_CONSENT_COPY}&rdquo;
          </P>
          <ul className="mb-4 list-disc pl-6">
            <LI>
              Every consent record stores the choice, the exact UTC timestamp,
              the wording version shown when the choice was made, and where the
              choice was made.
            </LI>
            <LI>
              No backfill: people who contacted us before this policy took
              effect receive marketing email only if they opt in themselves.
              Leaving the box unchecked never affects your service, a booking,
              or a founding member benefit.
            </LI>
            <LI>
              Every marketing email carries a working unsubscribe link, and one
              click opts you out across the PK Business Services, Glitter Hits,
              and Glitter Universe lists. You can also turn marketing email off
              or on in your account settings where one exists.
            </LI>
            <LI>
              No SMS or text message marketing. We do not sell personal
              information, and we do not share it for cross-context behavioral
              advertising.
            </LI>
          </ul>

          <H2>6. Service providers</H2>
          <P>
            We use a small set of providers to operate: Stripe for payment
            processing, Vercel for hosting, Turso for the database, Gmail for
            transactional notifications such as consultation request alerts,
            Resend for marketing email delivery, and TaxSmart Pro for tax
            return preparation and e-filing. Each provider receives only what
            it needs to do its job.
          </P>

          <H2>7. Cookies and local storage</H2>
          <P>
            This site keeps cookies and browser storage to a minimum. The
            assessment gut check uses your device only. The client portal uses
            the session and security storage it needs to keep your account
            safe.
          </P>

          <H2>8. How we protect information</H2>
          <P>
            Connections are encrypted in transit. The client portal uses
            passkey authentication, encrypted persistent session storage, and
            least-privilege administrative access. Backups are kept for
            recovery. No method of transmission or storage is perfectly secure,
            but PK treats protecting your information as part of the work, not
            an afterthought.
          </P>

          <H2>9. How long we keep information</H2>
          <P>
            We keep consultation and engagement records as long as needed to
            provide the services, resolve disputes, and meet tax and legal
            recordkeeping obligations, and then remove or de-identify them.
            Marketing consent records are kept as an audit trail of the choice
            you made, including opt-outs.
          </P>

          <H2>10. Your choices and rights</H2>
          <P>
            You can ask what information we hold about you, ask for a
            correction, or ask us to delete what we are not required to keep.
            Email info@pkservices.business or use the contact form. Unsubscribe
            from marketing email at any time with the link in any email.
          </P>

          <H2>11. Children</H2>
          <P>
            PK services are directed at business owners and adults. We do not
            knowingly collect information from children.
          </P>

          <H2>12. Changes to this policy</H2>
          <P>
            We update this page when practices change and date each update.
            Material changes to how we use your information, including any new
            brand added to the marketing email choice, are announced on this
            page before they take effect.
          </P>

          <H2>13. Contact</H2>
          <P>
            Questions about this policy: info@pkservices.business, or the form
            at pkservices.business/contact.
          </P>
        </div>
      </Section>
    </>
  );
}
