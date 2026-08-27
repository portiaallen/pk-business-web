const steps = [
  "We receive your inquiry.",
  "We review the information you've provided.",
  "We determine whether PK can assist.",
  "We contact you regarding the appropriate next step.",
];

export function WhatHappensNext() {
  return (
    <aside
      className="rounded-xl border border-border bg-cream p-6 sm:p-8"
      aria-labelledby="what-happens-next-heading"
    >
      <h2
        id="what-happens-next-heading"
        className="font-heading text-xl font-semibold text-charcoal"
      >
        What Happens Next?
      </h2>
      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <li
            key={step}
            className="flex gap-3 text-sm leading-relaxed text-muted-gray sm:text-base"
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-charcoal text-xs font-medium text-ivory"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </aside>
  );
}
