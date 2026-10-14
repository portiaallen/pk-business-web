"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const gutCheckItems = [
  "Money came in — from clients, platforms, apps, cash, 1099s.",
  "Expenses went out — some tracked, some… not.",
  "Receipts and documents are somewhere. Probably three somewheres.",
  "The bank feed hasn't been looked at in a while.",
  "Business and personal spending have been mingling.",
  "I have income outside a W-2 and I'm not sure what counts.",
  "I missed a year — or I'm afraid I did.",
  "Tax season is coming either way, and I'm hoping I'm ready.",
];

export function TaxGutCheck() {
  const [picked, setPicked] = useState<Set<number>>(new Set());

  function toggle(index: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div>
      <p
        id="gut-check-summary"
        aria-live="polite"
        className="pk-heading text-xl font-semibold"
      >
        Your gut check: {picked.size} / {gutCheckItems.length}
      </p>
      <p className="mt-2 text-sm text-muted-gray">
        Tap anything that sounds familiar. No wrong answers. Nothing is sent
        anywhere — this runs right here, in your browser.
      </p>
      <div
        className="mt-6 grid gap-3 sm:grid-cols-2"
        role="group"
        aria-labelledby="gut-check-summary"
      >
        {gutCheckItems.map((item, index) => {
          const selected = picked.has(index);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(index)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                selected
                  ? "border-charcoal bg-charcoal text-ivory"
                  : "border-border bg-cream text-charcoal hover:border-gold",
              )}
            >
              {item}
            </button>
          );
        })}
      </div>
      {picked.size > 0 ? (
        <p className="mt-5 text-sm text-muted-gray">
          Sound like your desk?{" "}
          <Link
            href="#start"
            className="font-semibold text-gold underline underline-offset-4"
          >
            Tell PK what&apos;s going on below
          </Link>{" "}
          — no judgment.
        </p>
      ) : null}
    </div>
  );
}
