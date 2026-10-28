import Link from "next/link";
import type { ClarityProduct } from "@/content/clarity";
import { siteConfig } from "@/content/site";
import { Button } from "@/components/ui/button";

interface ClarityProductDetailProps {
  product: ClarityProduct;
}

export function ClarityProductDetail({ product }: ClarityProductDetailProps) {
  return (
    <article
      id={product.id}
      className="scroll-mt-24 border-b border-border py-14 last:border-b-0 last:pb-0 first:pt-0"
    >
      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="pk-eyebrow mb-4">{product.tagline}</p>
          <p className="mb-2 text-sm font-semibold tracking-wide text-charcoal">
            {product.price} &mdash; final price, one deliverable
          </p>
          <h2 className="pk-heading text-2xl font-semibold text-charcoal sm:text-3xl">
            {product.name}
          </h2>
          <p className="mt-2 font-heading text-xl text-charcoal/90">{product.headline}</p>
          <p className="mt-5 text-base leading-relaxed text-muted-gray">{product.description}</p>
          <div className="mt-10">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-charcoal">
              What PK does in this product
            </h3>
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
          <h3 className="mb-3 pk-heading text-lg font-semibold text-charcoal">Is this for you?</h3>
          <ul className="mb-8 space-y-2">
            {product.bestFor.map((item) => (
              <li key={item} className="text-sm leading-relaxed text-muted-gray">{item}</li>
            ))}
          </ul>
          <Button
            render={<Link href={`/clarity/${product.id}`} />}
            className="h-11 w-full bg-charcoal text-ivory hover:bg-charcoal/90"
          >
            See the full details
          </Button>
        </aside>
      </div>
    </article>
  );
}
