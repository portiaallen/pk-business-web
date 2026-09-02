"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  MessageSquare,
  Briefcase,
  User,
  Users,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/portal/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/services", label: "Services", icon: Briefcase },
  { href: "/portal/requests", label: "Requests", icon: FileText },
  { href: "/portal/documents", label: "Documents", icon: FolderOpen },
  { href: "/portal/messages", label: "Messages", icon: MessageSquare },
  { href: "/portal/team", label: "Team", icon: Users },
  { href: "/portal/profile", label: "Account", icon: User },
];

function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, client, logout, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-sm text-muted-gray">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-md border border-border text-charcoal lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <Link href="/portal/dashboard" className="flex flex-col gap-0.5">
            <span className="font-heading text-lg font-semibold text-charcoal">
              PK Business Services
            </span>
            {client && (
              <span className="text-xs font-medium text-muted-gray">
                {client.name}
              </span>
            )}
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-muted-gray sm:block">
            {user.name}
          </span>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-gray transition-colors hover:bg-secondary hover:text-charcoal"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
          <nav className="flex flex-col gap-1 p-4" aria-label="Portal navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-charcoal text-ivory"
                      : "text-muted-gray hover:bg-secondary hover:text-charcoal"
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/20"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute left-0 top-0 h-full w-72 border-r border-border bg-background shadow-xl">
              <div className="flex h-16 items-center justify-between border-b border-border px-4">
                <span className="font-heading text-lg font-semibold text-charcoal">
                  Navigation
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted-gray hover:text-charcoal"
                >
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1 p-4" aria-label="Portal navigation">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-charcoal text-ivory"
                          : "text-muted-gray hover:bg-secondary hover:text-charcoal"
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <PortalShell>{children}</PortalShell>
    </AuthProvider>
  );
}
