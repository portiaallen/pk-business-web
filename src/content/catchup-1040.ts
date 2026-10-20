// Catch-Up 1040 Special — shared option lists and screening logic.
// Founder-confirmed terms (2026-10-19): $99 preparation for every qualifying
// Simple 1040, per year, no bundle required; separate $35 FEDERAL e-filing
// fee per eligible return only; no refund transfers, no bank products; Form
// 1040 individual returns only, tax years 2023-2025; e-file eligibility is
// confirmed by year at review (paper filing where needed); no refund
// guarantees. Other tiers and bundles: quote after review (pending approval).
export const CATCHUP_TAX_YEARS = ["2023", "2024", "2025"] as const;
export type CatchupTaxYear = (typeof CATCHUP_TAX_YEARS)[number];

export const FILING_STATUS_OPTIONS = [
  { value: "single", label: "Single" },
  { value: "married_jointly", label: "Married filing jointly" },
  { value: "married_separately", label: "Married filing separately" },
  { value: "head_of_household", label: "Head of household" },
  { value: "qualifying_surviving_spouse", label: "Qualifying surviving spouse" },
  { value: "unknown", label: "Not sure yet" },
] as const;
export type FilingStatus = (typeof FILING_STATUS_OPTIONS)[number]["value"];

export const ALREADY_FILED_OPTIONS = [
  { value: "no", label: "Not yet filed" },
  { value: "yes", label: "Already filed" },
  { value: "not_sure", label: "Not sure" },
] as const;
export type AlreadyFiled = (typeof ALREADY_FILED_OPTIONS)[number]["value"];

export const COMPLEXITY_OPTIONS = [
  { value: "w2", label: "W-2 wages", simple: true },
  { value: "unemployment", label: "Unemployment (1099-G)" },
  { value: "retirement", label: "Retirement or pension income (1099-R)" },
  { value: "self_employed", label: "Self-employment, 1099, or Schedule C income" },
  { value: "rental", label: "Rental property income" },
  { value: "investments", label: "Investment income (stocks, crypto, 1099-B)" },
  { value: "other", label: "Other income types" },
] as const;
export type ComplexityItem = (typeof COMPLEXITY_OPTIONS)[number]["value"];

export const CONTACT_TIME_OPTIONS = [
  { value: "anytime", label: "Anytime is fine" },
  { value: "weekday_morning", label: "Weekday mornings" },
  { value: "weekday_afternoon", label: "Weekday afternoons" },
  { value: "weekday_evening", label: "Weekday evenings" },
  { value: "weekend", label: "Weekends" },
] as const;

export const RECORDS_STATUS_OPTIONS = [
  { value: "ready", label: "Records are ready" },
  { value: "some_missing", label: "Some records are missing" },
  { value: "mostly_missing", label: "Most records are missing" },
  { value: "not_sure", label: "Not sure yet" },
] as const;

export const US_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
] as const;

// Filing statuses that can screen as a Simple 1040. Separated and unknown
// statuses are reviewed first before any price is shown as final.
export const SIMPLE_QUALIFYING_STATUSES: ReadonlySet<string> = new Set([
  "single",
  "married_jointly",
  "head_of_household",
  "qualifying_surviving_spouse",
]);

export const CATCHUP_SIMPLE_PRICE = "$99";
export const CATCHUP_EFILE_FEE = "$35";

export interface CatchupYearScreening {
  year: string;
  simpleEligible: boolean;
  reason: string;
}

/**
 * Conservative screening for the $99 Simple 1040 rate. A year qualifies only
 * when the return is W-2 wages only (no other income types anywhere in the
 * intake), the filing status is one of the simple statuses, the year has not
 * already been filed (amendments are reviewed first), and no IRS or state
 * notices or deadlines are involved. Anything else is "quote after review";
 * the screen never finalizes a price — PK confirms it during review.
 */
export function screenCatchupYears(input: {
  complexity: readonly string[];
  hasNotices: boolean;
  years: ReadonlyArray<{ year: string; filingStatus: string; alreadyFiled: string }>;
}): CatchupYearScreening[] {
  const onlyW2 =
    input.complexity.length === 1 && input.complexity[0] === "w2";
  return input.years.map(({ year, filingStatus, alreadyFiled }) => {
    if (!onlyW2) {
      return {
        year,
        simpleEligible: false,
        reason: "Other income types apply, so PK reviews this return before quoting.",
      };
    }
    if (input.hasNotices) {
      return {
        year,
        simpleEligible: false,
        reason: "IRS or state notices are involved, so PK reviews this return first.",
      };
    }
    if (alreadyFiled === "yes") {
      return {
        year,
        simpleEligible: false,
        reason: "Already filed, so PK reviews this as an amendment first.",
      };
    }
    if (alreadyFiled === "not_sure") {
      return {
        year,
        simpleEligible: false,
        reason: "PK confirms whether this year was already filed before quoting.",
      };
    }
    if (!SIMPLE_QUALIFYING_STATUSES.has(filingStatus)) {
      return {
        year,
        simpleEligible: false,
        reason: "Filing status needs review before PK quotes this year.",
      };
    }
    return {
      year,
      simpleEligible: true,
      reason: "Qualifying Simple 1040 at the Catch-Up rate, pending PK's review.",
    };
  });
}
