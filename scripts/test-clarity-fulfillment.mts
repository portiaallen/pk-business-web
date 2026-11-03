// Synthetic-only battery for the Clarity fulfillment workflow logic (M3).
// No real client data; pure status/category validation checks.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canTransitionFulfillmentStatus,
  isClarityFulfillmentStatus,
  isClarityTimeCategory,
  CLARITY_FULFILLMENT_STATUSES,
  CLARITY_TIME_CATEGORIES,
} from "../src/lib/clarity-fulfillment";

test("status guard accepts exactly the four workflow statuses", () => {
  for (const s of CLARITY_FULFILLMENT_STATUSES) {
    assert.equal(isClarityFulfillmentStatus(s), true);
  }
  assert.equal(isClarityFulfillmentStatus("done"), false);
  assert.equal(isClarityFulfillmentStatus(""), false);
  assert.equal(isClarityFulfillmentStatus(null), false);
  assert.equal(isClarityFulfillmentStatus(undefined), false);
});

test("fulfilled cannot reopen directly to new or awaiting_client", () => {
  assert.equal(canTransitionFulfillmentStatus("fulfilled", "new"), false);
  assert.equal(canTransitionFulfillmentStatus("fulfilled", "awaiting_client"), false);
  assert.equal(canTransitionFulfillmentStatus("fulfilled", "in_review"), true);
  assert.equal(canTransitionFulfillmentStatus("fulfilled", "fulfilled"), true);
});

test("open statuses can move freely among themselves and to fulfilled", () => {
  for (const from of ["new", "in_review", "awaiting_client"] as const) {
    for (const to of CLARITY_FULFILLMENT_STATUSES) {
      assert.equal(canTransitionFulfillmentStatus(from, to), true, `${from} -> ${to}`);
    }
  }
});

test("unknown statuses are rejected as transitions", () => {
  assert.equal(canTransitionFulfillmentStatus("archived", "new"), false);
  assert.equal(canTransitionFulfillmentStatus("new", "archived"), false);
});

test("time categories are exactly the Clarity set and guard rejects others", () => {
  assert.equal(CLARITY_TIME_CATEGORIES.length, 6);
  for (const c of CLARITY_TIME_CATEGORIES) {
    assert.equal(isClarityTimeCategory(c), true);
  }
  assert.equal(isClarityTimeCategory("Initial QuickBooks File Review"), false);
  assert.equal(isClarityTimeCategory(42), false);
});
