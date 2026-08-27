import Link from "next/link";
import type { Service } from "@/content/services";
import { siteConfig } from "@/content/site";
import { Button } from "@/components/ui/button";

interface ServiceDetailProps {
  service: Service;
}

export function ServiceDetail({ service }: ServiceDetailProps) {
  const isIncomeVerification = service.id === "income-verification";

  return (
    <article
      id={service.id}
      className="scroll-mt-24 border-b border-border py-14 last:border-b-0 last:pb-0 first:pt-0"
    >
      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="mb-2 text-sm font-medium tracking-wide text-gold">
            {service.price}
          </p>
          <h2 className="font-heading text-2xl font-semibold text-charcoal sm:text-3xl">
            {service.name}
          </h2>
          <p className="mt-2 font-heading text-xl text-charcoal/90">
            {service.headline}
          </p>
          <p className="mt-5 text-base leading-relaxed text-muted-gray">
            {service.description}
          </p>

          <div className="mt-10">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-charcoal">
              What May Be Included
            </h3>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {service.scope.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-gray"
                >
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-gold"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
            {service.scopeNote && (
              <p className="mt-5 text-sm leading-relaxed text-muted-gray italic">
                {service.scopeNote}
              </p>
            )}
          </div>

          {isIncomeVerification && (
            <div className="mt-8 rounded-lg border border-gold/30 bg-cream p-5 sm:p-6">
              <p className="text-sm font-medium leading-relaxed text-charcoal">
                {siteConfig.incomeVerificationDisclosure}
              </p>
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-border bg-card p-6 lg:sticky lg:top-24 lg:self-start">
          <h3 className="mb-3 font-heading text-lg font-semibold text-charcoal">
            Best For
          </h3>
          <ul className="mb-8 space-y-2">
            {service.bestFor.map((item) => (
              <li
                key={item}
                className="text-sm leading-relaxed text-muted-gray"
              >
                {item}
              </li>
            ))}
          </ul>
          <Button
            render={<Link href="/contact" />}
            className="h-11 w-full bg-charcoal text-ivory hover:bg-charcoal/90"
          >
            {siteConfig.cta.label}
          </Button>
        </aside>
      </div>
    </article>
  );
}
