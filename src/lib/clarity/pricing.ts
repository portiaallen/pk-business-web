// PK Business Clarity Collection — checkout price configuration.
// Prices are the founder-approved FINAL direct prices (2026-10-23):
//   Business Money Blueprint $149 | Receipt Rescue $149
//   Deduction Hunter Business Edition $129 | Deduction Hunter Personal Edition $119
// They are exact approved prices, not comparison prices and not Groupon discounts.
// The proposed Groupon tier prices are a separate, unapproved workstream and must
// never be wired to this config.
//
// Staging gate: checkout stays closed until PK_CLARITY_ENABLED === "true" AND the
// founder's go-live approval. No real charge can be created from this config in
// any environment where the gate is off.

import type { ClarityProductId } from "@/content/clarity";

export const CLARITY_POLICY_VERSION = "PK_CLARITY_PRICING_V1_2026_10_23";

export interface ClarityCheckoutItem {
  id: ClarityProductId;
  name: string;
  unitAmount: number; // cents
  currency: "USD";
}

export const CLARITY_CHECKOUT_CONFIG: Record<ClarityProductId, ClarityCheckoutItem> = {
  "business-money-blueprint": {
    id: "business-money-blueprint",
    name: "Business Money Blueprint",
    unitAmount: 14900,
    currency: "USD",
  },
  "receipt-rescue": {
    id: "receipt-rescue",
    name: "Receipt Rescue",
    unitAmount: 14900,
    currency: "USD",
  },
  "deduction-hunter-business": {
    id: "deduction-hunter-business",
    name: "Deduction Hunter — Business Edition",
    unitAmount: 12900,
    currency: "USD",
  },
  "deduction-hunter-personal": {
    id: "deduction-hunter-personal",
    name: "Deduction Hunter — Personal Edition",
    unitAmount: 11900,
    currency: "USD",
  },
} as const;

export function clarityCheckoutEnabled(): boolean {
  return process.env.PK_CLARITY_ENABLED === "true";
}

export function clarityAvailability() {
  return {
    enabled: clarityCheckoutEnabled(),
    currency: "USD",
    items: Object.values(CLARITY_CHECKOUT_CONFIG).map((item) => ({
      id: item.id,
      name: item.name,
      priceCents: item.unitAmount,
    })),
  };
}
