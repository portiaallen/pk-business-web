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
      className="scroll-mt-24 border-b border-border py-12 last:border-b-0 last:pb-0 first:pt-0"
    >
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="mb-2 text-sm font-medium text-gold">{service.price}</p>
          <h2 className="font-heading text-2xl font-semibold text-charcoal sm:text-3xl">
            {service.name}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-gray">
            {service.description}
          </p>

          {isIncomeVerification && (
            <blockquote className="mt-6 border-l-2 border-gold pl-4 font-heading text-lg italic text-charcoal">
              We organize and document the income information you already have.
            </blockquote>
          )}

          <div className="mt-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-charcoal">
              What This May Include
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {service.scope.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-muted-gray"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {isIncomeVerification && (
            <div className="mt-8 rounded-lg border border-border bg-cream p-5">
              <p className="text-sm leading-relaxed text-muted-gray">
                {siteConfig.incomeVerificationDisclosure}
              </p>
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-border bg-card p-6 lg:sticky lg:top-24 lg:self-start">
          <h3 className="mb-3 font-heading text-lg font-semibold text-charcoal">
            Best Suited For
          </h3>
          <ul className="mb-6 space-y-2">
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
