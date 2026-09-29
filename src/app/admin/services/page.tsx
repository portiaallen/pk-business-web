"use client";

import { useEffect, useState } from "react";
import { Briefcase, Trash2 } from "lucide-react";
import { confirmDelete } from "@/lib/confirm-delete";

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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

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

  useEffect(() => {
    fetchServices();
  }, []);

  async function handleDelete(service: Service) {
    if (!confirmDelete(`Permanently delete the "${service.name}" service? This cannot be undone.`)) return;
    setDeletingId(service.id);
    setError("");
    try {
      const res = await fetch("/api/admin/services", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: service.id }),
      });
      if (res.ok) {
        await fetchServices();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Delete failed (${res.status})`);
      }
    } catch {
      setError("Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

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

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

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
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleDelete(service)}
                  disabled={deletingId === service.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
