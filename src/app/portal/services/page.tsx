"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, ArrowRight } from "lucide-react";

type Service = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  priceDisplay: string;
};

export default function PortalServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchServices() {
      try {
        const res = await fetch("/api/portal/services");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-gray">Loading services...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          Our Services
        </h1>
        <p className="mt-2 text-muted-gray">
          Select a service to get started, or contact us for a consultation.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {services.map((service) => (
          <div
            key={service.id}
            className="group rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <Briefcase className="size-5 text-gold" />
              <span className="text-sm font-medium text-gold">
                {service.priceDisplay}
              </span>
            </div>
            <h3 className="mt-4 font-heading text-xl font-semibold text-charcoal">
              {service.name}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-gray">
              {service.shortDescription}
            </p>
            <Link
              href={`/portal/requests/new?service=${service.slug}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-charcoal transition-colors group-hover:text-gold"
            >
              Request this service
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
