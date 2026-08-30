import { getMainAppUrl } from "@/lib/urls";

export const INVENTORY_NAV = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Products", href: "/products" },
  { label: "Locations", href: "/locations" },
  { label: "Transactions", href: "/transactions" },
  { label: "Alerts", href: "/alerts" },
  { label: "Reports", href: "/reports" },
  { label: "Back to Portal", href: `${getMainAppUrl()}/portal`, external: true },
] as const;
