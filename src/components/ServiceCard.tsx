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
        "group flex h-full flex-col rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-md sm:p-8",
        className
      )}
    >
      <h3 className="font-heading text-xl font-semibold text-charcoal sm:text-2xl">
        {service.shortName}
      </h3>
      <p className="mt-2 text-sm font-medium text-gold">{service.price}</p>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-gray sm:text-base">
        {service.shortDescription}
      </p>
      <Link
        href={service.href}
        className="mt-6 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-charcoal transition-colors group-hover:text-gold"
      >
        Learn More
        <span
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </Link>
    </article>
  );
}
