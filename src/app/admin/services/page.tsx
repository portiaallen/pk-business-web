"use client";

import { useEffect, useState } from "react";
import { Briefcase } from "lucide-react";

type Service = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  priceDisplay: string;
  status: string;
  requestCount: number;
};

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch("/api/admin/services");
        if (res.ok) {
          setServices(await res.json());
        }
      } catch {
        // empty
      } finally {
        setLoading(false);
      }
    }
    fetchServices();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Service Catalog
        </h1>
        <p className="mt-2 text-muted-gray">
          Manage the services offered by PK Business Services.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-gray">Loading services...</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {services.map((service) => (
            <div
              key={service.id}
              className="rounded-lg border border-border bg-card p-6"
            >
              <div className="flex items-start justify-between">
                <Briefcase className="size-5 text-gold" />
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    service.status === "ACTIVE"
                      ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {service.status}
                </span>
              </div>
              <h3 className="mt-4 font-heading text-xl font-semibold text-charcoal">
                {service.name}
              </h3>
              <p className="mt-1 text-sm text-muted-gray">
                {service.shortDescription}
              </p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-gray">
                <span>{service.priceDisplay}</span>
                <span>{service.requestCount} requests</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
