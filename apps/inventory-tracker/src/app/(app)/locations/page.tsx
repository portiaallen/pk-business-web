import Link from "next/link";
import { requireInventorySession } from "@/lib/auth-server";
import { listLocations } from "@/server/inventory/locations";
import { LocationForm } from "@/components/LocationForm";

export const metadata = { title: "Locations" };

export default async function LocationsPage() {
  const ctx = await requireInventorySession();
  const locations = await listLocations(ctx, false);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Locations
        </h1>
        <p className="mt-1 text-muted-gray">
          Manage storage locations for your inventory.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-background p-6">
          <h2 className="font-heading text-xl font-semibold text-charcoal">
            Your Locations
          </h2>
          {locations.length === 0 ? (
            <p className="mt-4 text-muted-gray">No locations yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {locations.map((location) => (
                <li key={location.id} className="py-3">
                  <Link
                    href={`/locations/${location.id}`}
                    className="block hover:text-gold"
                  >
                    <p className="font-medium text-charcoal">{location.name}</p>
                    {location.description && (
                      <p className="text-sm text-muted-gray">
                        {location.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-gray">
                      {location._count.products} product
                      {location._count.products === 1 ? "" : "s"}
                      {!location.isActive && " · Inactive"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {(ctx.role === "STAFF" || ctx.role === "OWNER") && (
          <section className="rounded-lg border border-border bg-background p-6">
            <h2 className="font-heading text-xl font-semibold text-charcoal">
              Add Location
            </h2>
            <div className="mt-4">
              <LocationForm />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
