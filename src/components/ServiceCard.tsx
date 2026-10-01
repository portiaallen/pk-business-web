import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Service } from "@/content/services";
import { serviceSituations } from "@/content/service-discovery";
import { cn } from "@/lib/utils";

export function ServiceCard({
  service,
  className,
}: {
  service: Service;
  className?: string;
}) {
  return (
    <article className={cn("pk-service-card group", className)}>
      <p className="pk-service-situation">{serviceSituations[service.id]}</p>
      <h3 className="pk-heading mt-4 text-2xl">{service.shortName}</h3>
      <p className="mt-4 flex-1 leading-relaxed text-muted-gray">
        {service.shortDescription}
      </p>
      <div className="pk-service-card-bottom">
        <p className="text-sm font-semibold text-charcoal">{service.price}</p>
        <Link href={service.href} className="pk-service-link">
          <span className="sr-only">Explore {service.shortName}</span>
          <ArrowUpRight className="size-5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
