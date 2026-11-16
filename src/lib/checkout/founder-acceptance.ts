/**
 * Founder $0 acceptance contract shared by future PK product checkout adapters.
 * This module never grants payment/fulfillment access on its own.
 * Fulfillment verifies the session through Stripe's signed webhook or authenticated API.
 */
export const FOUNDER_ACCEPTANCE_METADATA_KEY = "pkFounderAcceptance" as const;
export const FOUNDER_ACCEPTANCE_VERSION = "v1" as const;

export type VerifiedCheckout = {
  id: unknown;
  object: unknown;
  mode: unknown;
  status: unknown;
  payment_status: unknown;
  payment_intent?: unknown;
  amount_total: unknown;
  currency: unknown;
  client_reference_id: unknown;
  metadata: unknown;
  total_details?: unknown;
};

/** No client-controlled flag, redirect or coupon string can authorize fulfillment. */
export function isVerifiedFounderZeroCheckout(
  session: VerifiedCheckout,
  expected: { assessmentId: string; sessionId: string },
): boolean {
  const metadata = session.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return false;
  const fields = metadata as Record<string, unknown>;
  return (
    session.object === "checkout.session" &&
    session.id === expected.sessionId &&
    /^cs_(test_)?[A-Za-z0-9_]+$/.test(expected.sessionId) &&
    session.mode === "payment" &&
    session.status === "complete" &&
    (session.payment_status === "no_payment_required" ||
      session.payment_status === "paid") &&
    session.payment_intent === null &&
    session.amount_total === 0 &&
    session.currency === "usd" &&
    session.client_reference_id === expected.assessmentId &&
    fields.readinessAssessmentId === expected.assessmentId &&
    fields[FOUNDER_ACCEPTANCE_METADATA_KEY] === FOUNDER_ACCEPTANCE_VERSION
  );
}

/**
 * Only server-side approved promotion-code IDs may enter checkout.
 * The public coupon text is never a trusted authorization token.
 * Fail closed when the allowlist is absent or ambiguous.
 */
export function founderPromotionId(configured: string | undefined): string | null {
  const value = configured?.trim();
  return value && /^promo_[A-Za-z0-9]+$/.test(value) ? value : null;
}

/** Keep Founder test orders out of real-money sales metrics. */
export function isRealMoneySale(amountCents: number, founderAcceptance: boolean): boolean {
  return Number.isSafeInteger(amountCents) && amountCents > 0 && !founderAcceptance;
}
