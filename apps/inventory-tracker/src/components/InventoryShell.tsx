"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@pk/lib/utils";
import { Button } from "@pk/components/ui/button";
import { getMainAppUrl } from "@/lib/urls";
import type { SessionUser } from "@pk/server/auth/session";

type NavItem = { label: string; href: string; external?: boolean };

export function InventoryShell({
  user,
  nav,
  children,
}: {
  user: SessionUser;
  nav: readonly NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  async function handleLogout() {
    const mainAppUrl = getMainAppUrl();
    await fetch(`${mainAppUrl}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = `${mainAppUrl}/portal/login`;
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/dashboard"
              className="font-heading text-lg font-semibold text-charcoal"
            >
              PK Inventory
            </Link>
            <span className="hidden text-sm text-muted-gray sm:inline">
              Inventory Tracker
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-gray sm:inline">
              {user.name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="min-h-11"
              aria-label="Sign out"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl min-w-0 gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[220px_1fr] lg:gap-8">
        <nav
          className="flex flex-row gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
          aria-label="Inventory navigation"
        >
          {nav.map((item) => {
            const isExternal =
              item.external ||
              item.href.startsWith("http://") ||
              item.href.startsWith("https://");
            const isActive =
              !isExternal &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));

            const className = cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-charcoal text-ivory"
                : "text-muted-gray hover:bg-secondary hover:text-charcoal"
            );

            if (isExternal) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={className}
                >
                  {item.label}
                </a>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={className}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
