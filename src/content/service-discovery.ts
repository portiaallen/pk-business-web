import type { ServiceId } from "@/content/services";

// Presentation only. Catalog, scopes, prices, and service IDs remain authoritative in services.ts.
export const serviceSituations: Record<ServiceId, string> = {
  "quickbooks-cleanup": "Your books need a fresh starting point.",
  "tax-ready-bookkeeping": "Your tax professional needs organized records.",
  "monthly-bookkeeping": "Your business needs a steady bookkeeping routine.",
  "income-verification":
    "You need to present the income records you already have.",
};
