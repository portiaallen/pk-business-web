interface PageHeroProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
}

export function PageHero({
  title,
  subtitle,
  eyebrow = "PK Business Services",
}: PageHeroProps) {
  return (
    <section className="pk-page-hero">
      <div className="container-narrow">
        <p className="pk-eyebrow">{eyebrow}</p>
        <h1 className="pk-heading mt-5 max-w-3xl text-balance text-4xl sm:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ivory/80">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
