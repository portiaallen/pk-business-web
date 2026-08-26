import Link from "next/link";
import type { Service } from "@/content/services";
import { cn } from "@/lib/utils";

interface ServiceCardProps {
  service: Service;
  className?: string;
}

export function ServiceCard({ service, className }: ServiceCardProps) {
  return (
    <article
      className={cn(
        "group flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:p-8",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <h3 className="font-heading text-xl font-semibold text-charcoal sm:text-2xl">
          {service.shortName}
        </h3>
      </div>
      <p className="mb-2 text-sm font-medium text-gold">{service.price}</p>
      <p className="mb-6 flex-1 text-sm leading-relaxed text-muted-gray sm:text-base">
        {service.shortDescription}
      </p>
      <Link
        href={service.href}
        className="inline-flex items-center gap-1 text-sm font-semibold text-charcoal transition-colors group-hover:text-gold"
      >
        Learn More
        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </article>
  );
}
