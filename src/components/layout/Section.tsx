import { cn } from "@/lib/utils";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
  id?: string;
  variant?: "default" | "cream" | "charcoal";
}

export function Section({
  children,
  className,
  id,
  variant = "default",
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "section-padding",
        variant === "cream" && "bg-cream",
        variant === "charcoal" && "bg-charcoal text-ivory",
        variant === "default" && "bg-background",
        className
      )}
    >
      <div className="container-narrow">{children}</div>
    </section>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  light?: boolean;
}

export function SectionHeader({
  title,
  subtitle,
  align = "center",
  light = false,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-12 max-w-2xl",
        align === "center" && "mx-auto text-center",
        align === "left" && "text-left"
      )}
    >
      <div
        className={cn(
          "gold-accent-line mb-6",
          align === "center" && "mx-auto"
        )}
      />
      <h2
        className={cn(
          "text-balance text-3xl font-semibold tracking-tight sm:text-4xl",
          light ? "text-ivory" : "text-charcoal"
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "mt-4 text-lg leading-relaxed",
            light ? "text-ivory/75" : "text-muted-gray"
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
