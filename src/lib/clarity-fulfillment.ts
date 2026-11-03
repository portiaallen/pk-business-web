// Clarity Collection fulfillment workflow (M3) — server-side status logic.
// Staging-only build; founder go-live gates any production use.

export const CLARITY_FULFILLMENT_STATUSES = [
  "new",
  "in_review",
  "awaiting_client",
  "fulfilled",
] as const;

export type ClarityFulfillmentStatus = (typeof CLARITY_FULFILLMENT_STATUSES)[number];

export function isClarityFulfillmentStatus(
  value: unknown
): value is ClarityFulfillmentStatus {
  return (
    typeof value === "string" &&
    (CLARITY_FULFILLMENT_STATUSES as readonly string[]).includes(value)
  );
}

/** Allowed forward transitions. Backward moves (reopen) go through "in_review". */
const ALLOWED_TRANSITIONS: Record<ClarityFulfillmentStatus, ClarityFulfillmentStatus[]> = {
  new: ["new", "in_review", "awaiting_client", "fulfilled"],
  in_review: ["new", "in_review", "awaiting_client", "fulfilled"],
  awaiting_client: ["new", "in_review", "awaiting_client", "fulfilled"],
  fulfilled: ["in_review", "fulfilled"], // reopen for a fix, or stay done
};

export function canTransitionFulfillmentStatus(
  from: string,
  to: string
): boolean {
  if (!isClarityFulfillmentStatus(from) || !isClarityFulfillmentStatus(to)) {
    return false;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const CLARITY_TIME_CATEGORIES = [
  "Intake review",
  "Report preparation",
  "Spreadsheet work",
  "Client communication",
  "Final quality review",
  "Administrative/Engagement management",
] as const;

export function isClarityTimeCategory(value: unknown): value is string {
  return typeof value === "string" && (CLARITY_TIME_CATEGORIES as readonly string[]).includes(value);
}
