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
            Behind on your books? Records all over the place? Let’s make sense
            of it. Practical bookkeeping and financial documentation support for
            small businesses, self-employed professionals, and individuals.
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
            You don’t need to have it all figured out to start.
          </p>
        </div>
        <div
          className="pk-desk"
          role="img"
          aria-label="A little order. A lot more clarity. Bookkeeping, QuickBooks, and financial documentation."
        >
          <div className="pk-desk-top" aria-hidden="true">
            <span>THE PK APPROACH</span>
            <span>01 / GET ORGANIZED</span>
          </div>
          <div className="pk-folder" aria-hidden="true">
            <span className="pk-folder-tab">A CLEARER STARTING POINT</span>
            <div className="pk-paper">
              <span className="pk-paper-label">
                People. Knowledge. Results.
              </span>
              <p>
                A little order.
                <br />
                <em>
                  A lot more
                  <br />
                  clarity.
                </em>
              </p>
              <div className="pk-paper-rule" />
              <div className="pk-paper-list">
                <span>01</span> Books that need attention
              </div>
              <div className="pk-paper-list">
                <span>02</span> Records that need structure
              </div>
              <div className="pk-paper-list">
                <span>03</span> A practical next step
              </div>
              <span className="pk-paper-signature">PK Business Services</span>
            </div>
          </div>
          <div className="pk-desk-bottom" aria-hidden="true">
            <span>LET’S PUT THINGS IN ORDER.</span>
            <span className="pk-desk-mark">
              PK<span>.</span>
            </span>
          </div>
        </div>
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
