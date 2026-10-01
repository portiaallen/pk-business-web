import { Brand } from "@/components/layout/Brand";
import Link from "next/link";
import { siteConfig } from "@/content/site";

export function Footer() {
  return (
    <footer className="pk-footer border-t border-border bg-charcoal text-ivory">
      <div className="container-wide section-padding !py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-4">
            <Link href="/" className="inline-flex">
              <Brand light />
            </Link>
            <p className="text-sm leading-relaxed text-ivory/75">
              {siteConfig.tagline}
            </p>
          </div>

          <nav aria-label="Footer navigation">
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-gold-light">
              Navigation
            </p>
            <ul className="space-y-2">
              {siteConfig.nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-ivory/80 transition-colors hover:text-gold-light"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/pay"
                  className="text-sm text-ivory/80 transition-colors hover:text-gold-light"
                >
                  Pay an Invoice
                </Link>
              </li>
              <li>
                <Link
                  href="/portal/login"
                  className="text-sm text-ivory/80 transition-colors hover:text-gold-light"
                >
                  Client Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/portal/login?admin=1"
                  className="text-sm text-ivory/80 transition-colors hover:text-gold-light focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  Admin Sign In
                </Link>
              </li>
            </ul>
          </nav>

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-light">
              Get Started
            </p>
            <p className="text-sm leading-relaxed text-ivory/75">
              Ready to organize your records? Request a consultation to discuss
              your needs.
            </p>
            <Link
              href={siteConfig.cta.href}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 px-5 text-sm font-medium text-gold-light transition-colors hover:bg-gold/20"
            >
              {siteConfig.cta.label}
            </Link>
          </div>
        </div>

        <div className="mt-12 space-y-4 border-t border-ivory/10 pt-8">
          <p className="text-xs leading-relaxed text-ivory/60">
            {siteConfig.disclaimer}
          </p>
          <p className="text-xs text-ivory/50">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
