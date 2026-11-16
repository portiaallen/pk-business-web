import assert from "node:assert/strict";
import { test } from "node:test";
import {
  founderPromotionId,
  isRealMoneySale,
  isVerifiedFounderZeroCheckout,
} from "../src/lib/checkout/founder-acceptance";

const base = {
  object: "checkout.session",
  id: "cs_test_founder123",
  mode: "payment",
  status: "complete",
  payment_status: "no_payment_required",
  payment_intent: null,
  amount_total: 0,
  currency: "usd",
  client_reference_id: "assessment-123",
  metadata: {
    readinessAssessmentId: "assessment-123",
    pkFounderAcceptance: "v1",
  },
};
const expected = {
  assessmentId: "assessment-123",
  sessionId: "cs_test_founder123",
};
test("Founder zero-dollar acceptance requires all provider-verified fields", () => {
  assert.equal(isVerifiedFounderZeroCheckout(base, expected), true);
  assert.equal(isVerifiedFounderZeroCheckout({ ...base, payment_status: "paid" }, expected), true);
  for (const patch of [
    { status: "open" },
    { payment_status: "unpaid" },
    { payment_status: "paid", payment_intent: "pi_test_other" },
    { payment_status: "paid", amount_total: 9900 },
    { payment_intent: undefined },
    { amount_total: 9900 },
    { id: "cs_test_other" },
    { client_reference_id: "someone-else" },
    { metadata: { ...base.metadata, pkFounderAcceptance: "true" } },
    { metadata: { readinessAssessmentId: "assessment-123" } },
    { metadata: { ...base.metadata, readinessAssessmentId: "someone-else" } },
  ]) {
    assert.equal(isVerifiedFounderZeroCheckout({ ...base, ...patch }, expected), false);
  }
});
test("Founder promotion allowlist fails closed", () => {
  assert.equal(founderPromotionId("promo_ABC123"), "promo_ABC123");
  for (const bad of [undefined, "", "FREE100", "promo_bad-value", "promo_A,promo_B"]) {
    assert.equal(founderPromotionId(bad), null);
  }
});
test("Founder test orders cannot count as real-money sales", () => {
  assert.equal(isRealMoneySale(0, true), false);
  assert.equal(isRealMoneySale(9900, true), false);
  assert.equal(isRealMoneySale(9900, false), true);
});
