import Link from "next/link";
import {
  ArrowUpRight,
  FolderOpen,
  Files,
  CalendarCheck,
  FileCheck2,
} from "lucide-react";
import type { Service } from "@/content/services";
import { serviceSituations } from "@/content/service-discovery";
import { cn } from "@/lib/utils";

const serviceVisuals = {
  "quickbooks-cleanup": { icon: FolderOpen, label: "SORT / REVIEW / RESET" },
  "tax-ready-bookkeeping": {
    icon: Files,
    label: "ORGANIZE / PREPARE / HAND OFF",
  },
  "monthly-bookkeeping": {
    icon: CalendarCheck,
    label: "CATEGORIZE / MAINTAIN / REPEAT",
  },
  "income-verification": {
    icon: FileCheck2,
    label: "GATHER / REVIEW / DOCUMENT",
  },
};

export function ServiceCard({
  service,
  className,
}: {
  service: Service;
  className?: string;
}) {
  const visual = serviceVisuals[service.id];
  const Icon = visual.icon;
  return (
    <article className={cn("pk-service-card group", className)}>
      <div className="pk-service-folder" aria-hidden="true">
        <span className="pk-folder-label">{visual.label}</span>
        <Icon strokeWidth={1.25} />
        <span className="pk-service-paper-lines" />
      </div>
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
