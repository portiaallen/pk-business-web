interface PageHeroProps {
  title: string;
  subtitle?: string;
}

export function PageHero({ title, subtitle }: PageHeroProps) {
  return (
    <section className="border-b border-border bg-charcoal text-ivory">
      <div className="container-wide section-padding !py-14 sm:!py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="gold-accent-line mx-auto mb-6" />
          <h1 className="text-balance font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 text-lg leading-relaxed text-ivory/75">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
