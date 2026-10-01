"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/layout/Brand";
import { Menu, X } from "lucide-react";
import { siteConfig } from "@/content/site";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="pk-header sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="container-wide flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex flex-col gap-0.5"
          onClick={() => setMobileOpen(false)}
        >
          <Brand />
        </Link>

        <nav
          className="hidden items-center gap-6 lg:flex"
          aria-label="Main navigation"
        >
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn(
                "pk-nav-link text-sm font-semibold transition-colors",
                pathname === item.href ? "text-charcoal" : "text-muted-gray",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <Link
            href="/portal/login"
            className="text-sm font-medium text-muted-gray transition-colors hover:text-gold"
          >
            Client Portal
          </Link>
          <Button
            render={<Link href={siteConfig.cta.href} />}
            className="h-11 bg-charcoal px-5 text-ivory hover:bg-charcoal/90"
          >
            {siteConfig.cta.label}
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-md border border-border text-charcoal lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onKeyDown={(event) => {
            if (event.key === "Escape") setMobileOpen(false);
          }}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mobileOpen && (
        <nav
          id="mobile-nav"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMobileOpen(false);
              document
                .querySelector<HTMLButtonElement>(
                  '[aria-controls="mobile-nav"]',
                )
                ?.focus();
            }
          }}
          className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-border bg-background px-4 py-4 lg:hidden"
          aria-label="Mobile navigation"
        >
          <ul className="flex flex-col gap-1">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block rounded-md px-3 py-2.5 text-base font-medium transition-colors",
                    pathname === item.href
                      ? "bg-secondary text-charcoal"
                      : "text-muted-gray hover:bg-secondary/60",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/portal/login"
                onClick={() => setMobileOpen(false)}
                className="block rounded-md px-3 py-2.5 text-base font-medium text-muted-gray transition-colors hover:bg-secondary/60"
              >
                Client Sign In
              </Link>
            </li>
            <li className="pt-2">
              <Button
                render={<Link href={siteConfig.cta.href} />}
                className="h-11 w-full bg-charcoal text-ivory hover:bg-charcoal/90"
                onClick={() => setMobileOpen(false)}
              >
                {siteConfig.cta.label}
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
