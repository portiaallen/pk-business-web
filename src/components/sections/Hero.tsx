import Link from "next/link";
import { siteConfig } from "@/content/site";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-charcoal text-ivory">
      <div
        className="absolute inset-0 opacity-30"
        aria-hidden="true"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 20% 50%, rgba(184, 149, 106, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(184, 149, 106, 0.1) 0%, transparent 40%),
            linear-gradient(180deg, rgba(28, 28, 28, 0) 0%, rgba(28, 28, 28, 1) 100%)
          `,
        }}
      />
      <div className="container-wide relative section-padding">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {siteConfig.tagline}
          </p>
          <h1 className="text-balance font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Organize Your Records. Strengthen Your Business. Stay Ready.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ivory/75 sm:text-xl">
            {siteConfig.description}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              render={<Link href={siteConfig.cta.href} />}
              className="h-12 w-full bg-gold px-8 text-base text-charcoal hover:bg-gold-light sm:w-auto"
            >
              {siteConfig.cta.label}
            </Button>
            <Button
              render={<Link href="/services" />}
              variant="outline"
              className="h-12 w-full border-ivory/30 bg-transparent px-8 text-base text-ivory hover:bg-ivory/10 sm:w-auto"
            >
              Explore Services
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
