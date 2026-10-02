import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { siteConfig } from "@/content/site";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="pk-hero">
      <div className="container-wide pk-hero-grid">
        <div className="pk-hero-copy">
          <p className="pk-eyebrow">
            <span className="pk-dot" /> Professional with personality
          </p>
          <h1>
            Your business is busy.
            <span>Your books shouldn’t be.</span>
          </h1>
          <p className="pk-hero-description">
            Messy books? We can work with that. Practical bookkeeping and
            financial documentation support for small businesses, self-employed
            professionals, and individuals.
          </p>
          <div className="pk-hero-actions">
            <Button
              render={<Link href={siteConfig.cta.href} />}
              className="pk-primary-button"
            >
              {siteConfig.cta.label}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Button>
            <Link href="/services" className="pk-text-link pk-text-link-light">
              Find your service <span aria-hidden="true">→</span>
            </Link>
          </div>
          <p className="pk-hero-note">
            No judgment. Just a practical place to start.
          </p>
        </div>
        <figure className="pk-founder-hero">
          <div className="pk-founder-image">
            <Image
              src="/images/pk-founder-workspace.jpg"
              alt="Portia Allen at the PK Business Services workspace, with organized planners, records, and a laptop"
              fill
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 52vw, 700px"
              preload
              className="object-cover"
            />
          </div>
          <figcaption className="pk-founder-caption">
            <span>
              Portia Allen{" "}
              <span className="pk-caption-role">
                Founder, PK Business Services
              </span>
            </span>
            <span className="pk-margin-note">Real help. Real human.</span>
          </figcaption>
        </figure>
      </div>
      <div className="pk-hero-strip">
        <div className="container-wide">
          <span>Bookkeeping</span>
          <span>QuickBooks support</span>
          <span>Financial documentation</span>
          <span>Real, practical help</span>
        </div>
      </div>
    </section>
  );
}
