import { prisma } from "@/lib/prisma";

/**
 * Marketing email consent for PK Business Services surfaces.
 * Strict opt-in: absence of a record means the person was never asked,
 * and no marketing email is ever sent. Nothing is backfilled.
 * The stored record names the exact wording shown when consent was given.
 * Any wording change bumps the version so old consents stay auditable.
 */
export const MARKETING_CONSENT_VERSION = "2026-10-19-v1";

export const MARKETING_CONSENT_COPY =
  "I'd like occasional promotions, special offers, and updates from PK Business Services, Glitter Hits, and Glitter Universe, all operated by Portia Allen. Any brand added later would be covered only after this notice is updated. Unsubscribe anytime with the link in any email.";

const MAX_ENTRIES = 50;

export type ConsentSource = "consultation-form" | "settings" | "unsubscribe-link" | "admin";

export interface ConsentEntry {
  status: "opted-in" | "opted-out";
  at: string; // UTC ISO timestamp
  version: string;
  source: ConsentSource;
}

export async function recordMarketingConsent(
  email: string,
  optIn: boolean,
  source: ConsentSource,
): Promise<void> {
  const entry: ConsentEntry = {
    status: optIn ? "opted-in" : "opted-out",
    at: new Date().toISOString(),
    version: MARKETING_CONSENT_VERSION,
    source,
  };
  const existing = await prisma.marketingConsent.findUnique({
    where: { email },
  });
  const prior: ConsentEntry[] = existing?.entries
    ? JSON.parse(existing.entries)
    : [];
  const entries = [...prior, entry].slice(-MAX_ENTRIES);

  await prisma.marketingConsent.upsert({
    where: { email },
    create: {
      email,
      current: optIn,
      version: MARKETING_CONSENT_VERSION,
      entries: JSON.stringify(entries),
    },
    update: {
      current: optIn,
      version: MARKETING_CONSENT_VERSION,
      entries: JSON.stringify(entries),
    },
  });
}

export async function getMarketingConsent(email: string): Promise<{
  current: boolean;
  version: string;
  lastChangedAt: string | null;
} | null> {
  const record = await prisma.marketingConsent.findUnique({ where: { email } });
  if (!record) return null; // never asked: no consent exists
  const entries: ConsentEntry[] = JSON.parse(record.entries);
  const last = entries.length > 0 ? entries[entries.length - 1] : null;
  return {
    current: record.current,
    version: record.version,
    lastChangedAt: last?.at ?? null,
  };
}
