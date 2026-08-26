import Link from "next/link";
import { siteConfig } from "@/content/site";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CTASectionProps {
  title: string;
  description: string;
  className?: string;
  variant?: "default" | "charcoal";
}

export function CTASection({
  title,
  description,
  className,
  variant = "charcoal",
}: CTASectionProps) {
  const isCharcoal = variant === "charcoal";

  return (
    <section
      className={cn(
        "section-padding",
        isCharcoal ? "bg-charcoal text-ivory" : "bg-cream",
        className
      )}
    >
      <div className="container-narrow text-center">
        <div className="gold-accent-line mx-auto mb-6" />
        <h2 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
        <p
          className={cn(
            "mx-auto mt-4 max-w-2xl text-lg leading-relaxed",
            isCharcoal ? "text-ivory/75" : "text-muted-gray"
          )}
        >
          {description}
        </p>
        <div className="mt-8">
          <Button
            render={<Link href={siteConfig.cta.href} />}
            className={cn(
              "h-12 px-8 text-base",
              isCharcoal
                ? "bg-gold text-charcoal hover:bg-gold-light"
                : "bg-charcoal text-ivory hover:bg-charcoal/90"
            )}
          >
            {siteConfig.cta.label}
          </Button>
        </div>
      </div>
    </section>
  );
}
