import Link from "next/link";
import { pkPrinciples } from "@/content/principles";
import { Section } from "@/components/layout/Section";

export function WhyPKSection() {
  return (
    <Section variant="charcoal" className="pk-trust">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="pk-eyebrow">People | Knowledge | Results</p>
          <h2 className="pk-heading mt-4 text-3xl sm:text-4xl">
            Professional standards.
            <br />
            <span className="pk-serif text-gold-light">A human approach.</span>
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-ivory/80">
            PK Business Services is founder-led. Portia Allen brings a
            background in accounting, bookkeeping, financial services, and
            business operations to the work—along with straightforward
            communication and attention to your situation.
          </p>
          <Link href="/about" className="pk-text-link pk-text-link-light mt-7">
            Meet the person behind PK <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="space-y-7">
          {pkPrinciples.map((principle, index) => (
            <div
              key={principle.title}
              className="flex gap-5 border-t border-ivory/20 pt-6"
            >
              <span className="text-sm text-gold-light">0{index + 1}</span>
              <div>
                <h3 className="pk-heading text-xl">{principle.title}</h3>
                <p className="mt-2 leading-relaxed text-ivory/75">
                  {principle.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
