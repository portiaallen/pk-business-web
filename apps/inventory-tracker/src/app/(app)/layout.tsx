import { InventoryShell } from "@/components/InventoryShell";
import { requireInventorySession } from "@/lib/auth-server";
import { INVENTORY_NAV } from "@/lib/inventory-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireInventorySession();

  return (
    <InventoryShell user={ctx.user} nav={INVENTORY_NAV}>
      {children}
    </InventoryShell>
  );
}
