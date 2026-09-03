import "dotenv/config";
import { createClient } from "@libsql/client";

// Non-destructive service catalog sync for production.
// UPSERTs only the five catalog rows below by slug — never drops or deletes
// any row, never touches unrelated tables (Bra*/Inventory/etc.).
// Inventory Support is intentionally INACTIVE.

type ServiceRow = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  shortDescription: string;
  priceDisplay: string;
  priceCents: number | null;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
};

const SERVICES: ServiceRow[] = [
  {
    slug: "quickbooks-cleanup",
    name: "QuickBooks Cleanup",
    shortName: "QuickBooks Cleanup",
    description:
      "Organize existing QuickBooks records and create a cleaner starting point.",
    shortDescription: "Behind on your books? PK helps organize existing QuickBooks records.",
    priceDisplay: "Starting at $250",
    priceCents: 25000,
    status: "ACTIVE",
    sortOrder: 1,
  },
  {
    slug: "tax-ready-bookkeeping",
    name: "Tax-Ready Bookkeeping",
    shortName: "Tax-Ready Bookkeeping",
    description: "Get your business records organized before providing them to your tax professional.",
    shortDescription: "Get your records organized before tax time.",
    priceDisplay: "Starting at $400",
    priceCents: 40000,
    status: "ACTIVE",
    sortOrder: 2,
  },
  {
    slug: "monthly-bookkeeping",
    name: "Monthly Bookkeeping Support",
    shortName: "Monthly Bookkeeping",
    description: "Ongoing bookkeeping support for small businesses.",
    shortDescription: "Stay organized throughout the year.",
    priceDisplay: "Starting at $300/month",
    priceCents: 30000,
    status: "ACTIVE",
    sortOrder: 3,
  },
  {
    slug: "income-verification",
    name: "Income Verification & Documentation",
    shortName: "Income Verification",
    description: "Professional organization of authentic income records.",
    shortDescription: "Organize the income information you already have.",
    priceDisplay: "Consultation-based pricing",
    priceCents: null,
    status: "ACTIVE",
    sortOrder: 4,
  },
  {
    slug: "inventory-support",
    name: "Inventory Support",
    shortName: "Inventory Support",
    description: "Inventory tracking support for businesses (not yet available).",
    shortDescription: "Not yet available.",
    priceDisplay: "Not yet available",
    priceCents: null,
    status: "INACTIVE",
    sortOrder: 5,
  },
];

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  const token = process.env.DATABASE_AUTH_TOKEN?.trim();
  if (!url || !token) {
    console.error("DATABASE_URL / DATABASE_AUTH_TOKEN missing");
    process.exit(1);
  }
  const c = createClient({ url, authToken: token });

  for (const s of SERVICES) {
    await c.execute({
      sql: `INSERT INTO Service (id, slug, name, shortName, description, shortDescription,
             priceDisplay, priceCents, requiredDocuments, status, sortOrder, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           ON CONFLICT(slug) DO UPDATE SET
             name = excluded.name,
             shortName = excluded.shortName,
             description = excluded.description,
             shortDescription = excluded.shortDescription,
             priceDisplay = excluded.priceDisplay,
             priceCents = excluded.priceCents,
             status = excluded.status,
             sortOrder = excluded.sortOrder,
             updatedAt = CURRENT_TIMESTAMP`,
      args: [
        "svc_" + s.slug.replace(/-/g, "_") + "_" + Math.random().toString(36).slice(2, 8),
        s.slug,
        s.name,
        s.shortName,
        s.description,
        s.shortDescription,
        s.priceDisplay,
        s.priceCents,
        s.status,
        s.sortOrder,
      ],
    });
  }

  const check = await c.execute(
    `SELECT slug, status, sortOrder FROM Service WHERE slug IN (?,?,?,?,?) ORDER BY sortOrder`,
    [...SERVICES.map((s) => s.slug)]
  );
  console.log("CATALOG_NOW:", JSON.stringify(check.rows));
  await c.close();
}

main().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
