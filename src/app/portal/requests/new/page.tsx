"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Loader2 } from "lucide-react";

type Service = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  priceDisplay: string;
};

export default function NewRequestPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/portal/services");
        if (!res.ok) return;
        const catalog: Service[] = await res.json();
        if (cancelled) return;
        setServices(catalog);

        // Respect a preselected service (e.g. from the services page), but only
        // if it exists in the active catalog.
        const preselect = new URLSearchParams(window.location.search).get("service");
        const preset =
          catalog.find((s) => s.slug === preselect) || catalog[0];
        if (preset) setSelectedSlug(preset.slug);
      } catch {
        // empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlug) {
      setError("Please select a service.");
      return;
    }
    if (!description.trim()) {
      setError("Please describe what you need help with.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/portal/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceSlug: selectedSlug, description: description.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      router.push(`/portal/requests/${data.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold text-charcoal">
          New Service Request
        </h1>
        <p className="mt-2 text-muted-gray">
          Select a service from our catalog and tell us what you need.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-gray">Loading services...</p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-lg border border-border bg-card p-6"
        >
          <div className="space-y-2">
            <label
              htmlFor="service"
              className="flex items-center gap-2 text-sm font-medium text-charcoal"
            >
              <Briefcase className="size-4 text-gold" />
              Service
            </label>
            <select
              id="service"
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-charcoal outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {services.map((service) => (
                <option key={service.id} value={service.slug}>
                  {service.name} — {service.priceDisplay}
                </option>
              ))}
            </select>
            {selectedSlug && (
              <p className="text-xs text-muted-gray">
                {
                  services.find((s) => s.slug === selectedSlug)?.shortDescription
                }
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-charcoal"
            >
              What do you need help with?
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Describe your engagement — e.g. the accounts or period to clean up, what you need organized, and any relevant details."
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-charcoal outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-charcoal px-4 py-2.5 text-sm font-medium text-ivory transition-colors hover:bg-charcoal/90 disabled:opacity-50"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Submit Request
            </button>
            <button
              type="button"
              onClick={() => router.push("/portal/services")}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-gray transition-colors hover:text-charcoal"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}