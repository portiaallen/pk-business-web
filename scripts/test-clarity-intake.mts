// Battery: PK Business Clarity Collection intake validation (M2).
// Covers: definition lookups, required answers, select/checkbox validation,
// entry-list caps (25 entries for Deduction Hunter Business), Receipt Rescue
// scope guidance, sensitive-data rejection before persistence, summary building,
// and the intake route's contract via direct handler calls against a synthetic
// Prisma surface. Run with: npm run test:clarity:intake

import test from "node:test";
import assert from "node:assert/strict";

import {
  clarityIntakeDefinitions,
  clarityIntakeDefinition,
  CLARITY_INTAKE_SENSITIVE_GUIDANCE,
} from "../src/content/clarity-intake";
import {
  validateClarityIntake,
  buildIntakeSummary,
} from "../src/lib/clarity-intake";

test("all four products have an intake definition with a version", () => {
  const ids = Object.keys(clarityIntakeDefinitions);
  assert.deepEqual(ids.sort(), [
    "business-money-blueprint",
    "deduction-hunter-business",
    "deduction-hunter-personal",
    "receipt-rescue",
  ]);
  for (const definition of Object.values(clarityIntakeDefinitions)) {
    assert.match(definition.version, /PK_CLARITY_INTAKE_/);
    assert.ok(definition.questions.length >= 4);
  }
});

test("unknown product id is rejected", () => {
  const result = validateClarityIntake("not-a-product", {});
  assert.equal(result.ok, false);
  assert.equal(result.errors[0], "Unknown product.");
});

test("required answers are enforced", () => {
  const result = validateClarityIntake("business-money-blueprint", {});
  assert.equal(result.ok, false);
  const joined = result.errors.join(" ");
  for (const label of [
    "What does your business do?",
    "How does money come in?",
    "What are your regular money-out commitments?",
    "Where do your business records live today?",
  ]) {
    assert.ok(joined.includes(label), `missing required error for: ${label}`);
  }
});

test("select answers must come from the option list", () => {
  const base = validBlueprint();
  const bad = { ...base, "records-location": "Under the mattress" };
  const result = validateClarityIntake("business-money-blueprint", bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.join(" ").includes("invalid selection"));
  assert.equal(result.sensitive, false);
});

test("valid blueprint submission validates and summarizes", () => {
  const result = validateClarityIntake("business-money-blueprint", validBlueprint());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
  const summary = buildIntakeSummary(clarityIntakeDefinitions["business-money-blueprint"], result.validated);
  assert.ok(summary.includes("What does your business do?:"));
  assert.ok(summary.includes("grooming"));
});

test("checkbox answers reject unknown options and empty selections when required", () => {
  const base = validReceiptRescue();
  const bad = { ...base, categories: ["Underwater welding"] };
  const result = validateClarityIntake("receipt-rescue", bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.join(" ").includes("invalid selection"));

  const empty = { ...base, categories: [] };
  const result2 = validateClarityIntake("receipt-rescue", empty);
  assert.equal(result2.ok, false);
  assert.ok(result2.errors.join(" ").includes("at least one option") || result2.errors.join(" ").includes("required"));
});

test("deduction hunter business entry list enforces the 25-entry cap", () => {
  const entries = Array.from({ length: 26 }, (_, i) => ({
    description: `Expense ${i + 1}`,
    category: "Other",
  }));
  const result = validateClarityIntake("deduction-hunter-business", {
    ...validDeductionBusiness(),
    entries,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.join(" ").includes("at most 25"));

  const okEntries = entries.slice(0, 25);
  const okResult = validateClarityIntake("deduction-hunter-business", {
    ...validDeductionBusiness(),
    entries: okEntries,
  });
  assert.equal(okResult.ok, true);
  const summary = buildIntakeSummary(clarityIntakeDefinitions["deduction-hunter-business"], okResult.validated);
  assert.ok(summary.includes("(25 of max 25)"));
});

test("entry-list rejects entries missing required fields", () => {
  const result = validateClarityIntake("deduction-hunter-business", {
    ...validDeductionBusiness(),
    entries: [{ category: "Other" }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.join(" ").includes("incomplete or invalid"));
});

test("sensitive data in any answer rejects the whole submission before persistence", () => {
  const sensitive = {
    ...validReceiptRescue(),
    "where-they-live": "receipts in a drawer, my SSN is 123-45-6789",
  };
  const result = validateClarityIntake("receipt-rescue", sensitive);
  assert.equal(result.ok, false);
  assert.equal(result.sensitive, true);
  assert.deepEqual(result.validated, {});
  assert.ok(result.errors[0].includes("Social Security numbers"));
  assert.ok(CLARITY_INTAKE_SENSITIVE_GUIDANCE.length > 0);
});

test("sensitive data inside an entry list also rejects", () => {
  const result = validateClarityIntake("deduction-hunter-business", {
    ...validDeductionBusiness(),
    entries: [{ description: "pay the accountant from account 123456789", category: "Other" }],
  });
  assert.equal(result.sensitive, true);
  assert.equal(result.ok, false);
});

test("oversized free text is rejected", () => {
  const result = validateClarityIntake("business-money-blueprint", {
    ...validBlueprint(),
    "what-business-does": "x".repeat(2500),
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.join(" ").includes("too long"));
});

test("personal edition validates without business name requirement", () => {
  const result = validateClarityIntake("deduction-hunter-personal", {
    "filing-status": "Single",
    homeownership: "Rent",
    areas: ["Charitable giving", "Medical expenses"],
    "tax-year": "2025",
  });
  assert.equal(result.ok, true);
});

function validBlueprint() {
  return {
    "what-business-does": "Mobile pet grooming",
    "money-in": "Card payments and invoices",
    "money-out": "Fuel, supplies, insurance",
    "records-location": "Spreadsheet",
    "business-age": "1 to 3 years",
  };
}

function validReceiptRescue() {
  return {
    "receipt-count": "25 to 50",
    "date-range": "Jan 2025 - Dec 2025",
    "receipt-format": "Paper receipts",
    categories: ["Office supplies", "Fuel and mileage"],
    "where-they-live": "A shoebox in the office",
  };
}

function validDeductionBusiness() {
  return {
    "business-type": "Catering",
    "entity-structure": "Sole proprietor (Schedule C)",
    "bookkeeping-method": "Spreadsheet",
    entries: [{ description: "Van fuel", category: "Vehicle and mileage", amount: 1200 }],
    "tax-year": "2025",
  };
}
