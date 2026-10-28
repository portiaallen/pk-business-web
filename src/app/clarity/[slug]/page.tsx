import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { CTASection } from "@/components/CTASection";
import { Button } from "@/components/ui/button";
import {
  clarityProducts,
  type ClarityProductId,
} from "@/content/clarity";

interface Params {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return clarityProducts.map((product) => ({ slug: product.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = clarityProducts.find((p) => p.id === slug);
  if (!product) return {};
  return {
    title: {
      absolute: `${product.name} — ${product.price} | PK Business Clarity Collection`,
    },
    description: product.shortDescription,
  };
}

export default async function ClarityProductPage({ params }: Params) {
  const { slug } = await params;
  const product = clarityProducts.find((p) => p.id === slug);
  if (!product) notFound();

  const others = clarityProducts.filter((p) => p.id !== product.id);

  return (
    <>
      <PageHero
        eyebrow="PK Business Clarity Collection"
        title={product.name}
        subtitle={product.headline}
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="pk-eyebrow mb-4">{product.tagline}</p>
            <p className="mb-2 text-sm font-semibold tracking-wide text-charcoal">
              {product.price} &mdash; final price, one deliverable
            </p>
            <p className="text-base leading-relaxed text-muted-gray">{product.description}</p>
            <div className="mt-10">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-charcoal">
                What PK does in this product
              </h2>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {product.scope.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-gray">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {product.perProductNote && (
              <div className="mt-8 rounded-lg border border-gold/30 bg-cream p-5 sm:p-6">
                <p className="text-sm font-medium leading-relaxed text-charcoal">{product.perProductNote}</p>
              </div>
            )}
          </div>
          <aside className="rounded-lg border border-border bg-card p-6 lg:sticky lg:top-24 lg:self-start">
            <h2 className="mb-3 pk-heading text-lg font-semibold text-charcoal">Is this for you?</h2>
            <ul className="mb-6 space-y-2">
              {product.bestFor.map((item) => (
                <li key={item} className="text-sm leading-relaxed text-muted-gray">{item}</li>
              ))}
            </ul>
            <div className="rounded-md border border-border bg-cream p-4">
              <p className="text-sm font-semibold text-charcoal">Final price: {product.price}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-gray">
                Checkout opens at public launch. Until then, request a consultation and note this product.
              </p>
            </div>
            <Button
              render={<Link href="/contact" />}
              className="mt-4 h-11 w-full bg-charcoal text-ivory hover:bg-charcoal/90"
            >
              Request a Consultation
            </Button>
            <p className="mt-4 text-xs leading-relaxed text-muted-gray">
              Never send Social Security numbers, ITINs, ID photos, or tax documents through this
              website. Sensitive information moves through PK&apos;s secure client process.
            </p>
          </aside>
        </div>
      </Section>
      <Section>
        <div className="mx-auto max-w-3xl">
          <h2 className="pk-heading text-2xl font-semibold text-charcoal">Also in the Clarity Collection</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-3">
            {others.map((other) => (
              <li key={other.id}>
                <Link
                  href={other.href}
                  className="block rounded-lg border border-border bg-card p-4 transition hover:border-gold"
                >
                  <span className="block text-sm font-semibold text-charcoal">{other.shortName}</span>
                  <span className="mt-1 block text-sm text-muted-gray">{other.price}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>
      <CTASection
        title="Ready for a clearer picture?"
        description="Request a consultation and note the Clarity Collection product you are interested in. Checkout opens at public launch."
      />
    </>
  );
}
