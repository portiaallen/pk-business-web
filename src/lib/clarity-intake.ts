// Server-side validation for PK Business Clarity Collection intake (M2).
// The questionnaire definitions in src/content/clarity-intake.ts are the single
// source of truth: this module validates submitted answers against them, enforces
// the per-product caps (Receipt Rescue 50-receipt scope; Deduction Hunter
// Business 25 Schedule C entries), and screens every string answer for sensitive
// taxpayer information before anything is persisted. Rejection happens here,
// before persistence, per the Oct 16 storage directive (no SSN/ITIN/IP
// PIN/bank details stored).

import { detectSensitiveData } from "@/lib/sensitive-data";
import {
  CLARITY_INTAKE_SENSITIVE_GUIDANCE,
  CLARITY_INTAKE_TEXT_MAX_LENGTH,
  clarityIntakeDefinition,
  type ClarityIntakeDefinition,
  type ClarityIntakeEntryField,
  type ClarityIntakeQuestion,
} from "@/content/clarity-intake";

export interface ClarityIntakeEntry {
  [fieldId: string]: string | number;
}

export type ClarityIntakeAnswer = string | string[] | ClarityIntakeEntry[];

export interface ClarityIntakeValidationResult {
  ok: boolean;
  errors: string[];
  sensitive: boolean;
  validated: Record<string, ClarityIntakeAnswer>;
  sourceChannel: "direct" | "groupon";
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function screenStrings(values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === "string" && detectSensitiveData(value).length > 0) {
      return true;
    }
  }
  return false;
}

function collectStrings(answer: ClarityIntakeAnswer): unknown[] {
  if (typeof answer === "string") return [answer];
  if (Array.isArray(answer)) return answer.flatMap((item) => (typeof item === "object" && item !== null ? Object.values(item) : [item]));
  return [];
}

function validateQuestion(
  question: ClarityIntakeQuestion,
  raw: unknown,
  errors: string[]
): ClarityIntakeAnswer | null {
  switch (question.type) {
    case "text":
    case "longtext":
    case "select": {
      const value = asTrimmedString(raw);
      if (!value) {
        if (question.required) errors.push(`"${question.label}" is required.`);
        return null;
      }
      if (value.length > CLARITY_INTAKE_TEXT_MAX_LENGTH) {
        errors.push(`"${question.label}" is too long.`);
        return null;
      }
      if (question.type === "select" && question.options && !question.options.includes(value)) {
        errors.push(`"${question.label}" has an invalid selection.`);
        return null;
      }
      return value;
    }
    case "checkbox": {
      if (!Array.isArray(raw)) {
        if (question.required) errors.push(`"${question.label}" is required.`);
        return null;
      }
      const values = raw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
      if (question.required && values.length === 0) {
        errors.push(`"${question.label}" is required.`);
        return null;
      }
      if (question.options && values.some((value) => !question.options!.includes(value))) {
        errors.push(`"${question.label}" has an invalid selection.`);
        return null;
      }
      if (values.length === 0) return null;
      return values;
    }
    case "entry-list": {
      if (!Array.isArray(raw)) {
        if (question.required) errors.push(`"${question.label}" is required.`);
        return null;
      }
      const cap = question.maxEntries ?? 25;
      if (raw.length > cap) {
        errors.push(`"${question.label}" accepts at most ${cap} entries.`);
        return null;
      }
      const fields = question.entryFields ?? [];
      const entries: ClarityIntakeEntry[] = [];
      let entryInvalid = false;
      for (const item of raw) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          entryInvalid = true;
          continue;
        }
        const record = item as Record<string, unknown>;
        const entry: ClarityIntakeEntry = {};
        for (const field of fields as ClarityIntakeEntryField[]) {
          const value = record[field.id];
          if (field.type === "number") {
            if (value === undefined || value === null || value === "") {
              if (field.required) entryInvalid = true;
              continue;
            }
            const num = typeof value === "number" ? value : Number(String(value).trim());
            if (!Number.isFinite(num) || num < 0) {
              entryInvalid = true;
              continue;
            }
            entry[field.id] = num;
          } else {
            const text = asTrimmedString(value);
            if (!text) {
              if (field.required) entryInvalid = true;
              continue;
            }
            if (text.length > 300) {
              entryInvalid = true;
              continue;
            }
            if (field.options && !field.options.includes(text)) {
              entryInvalid = true;
              continue;
            }
            entry[field.id] = text;
          }
        }
        if (Object.keys(entry).length > 0) entries.push(entry);
      }
      if (entryInvalid) {
        errors.push(`"${question.label}" has entries that are incomplete or invalid.`);
        return null;
      }
      if (question.required && entries.length === 0) {
        errors.push(`"${question.label}" is required.`);
        return null;
      }
      if (entries.length === 0) return null;
      return entries;
    }
  }
}

/**
 * Validate a submitted Clarity intake against its product questionnaire.
 * Never throws: returns an ok/errors result. Sensitive findings reject the
 * whole submission before persistence.
 */
export function validateClarityIntake(
  productId: string,
  answers: unknown
): ClarityIntakeValidationResult {
  const definition = clarityIntakeDefinition(productId);
  if (!definition) {
    return { ok: false, errors: ["Unknown product."], sensitive: false, validated: {}, sourceChannel: "direct" };
  }
  return validateAgainstDefinition(definition, answers);
}

export function validateAgainstDefinition(
  definition: ClarityIntakeDefinition,
  answers: unknown
): ClarityIntakeValidationResult {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return { ok: false, errors: ["Answers are missing or invalid."], sensitive: false, validated: {}, sourceChannel: "direct" };
  }

  const record = answers as Record<string, unknown>;
  const errors: string[] = [];
  const validated: Record<string, ClarityIntakeAnswer> = {};
  const allStrings: unknown[] = [];

  for (const question of definition.questions) {
    const answer = validateQuestion(question, record[question.id], errors);
    if (answer !== null) {
      validated[question.id] = answer;
      allStrings.push(...collectStrings(answer));
    }
  }

  const sensitive = screenStrings(allStrings);
  if (sensitive) {
    return {
      ok: false,
      errors: [CLARITY_INTAKE_SENSITIVE_GUIDANCE],
      sensitive: true,
      validated: {},
      sourceChannel: "direct",
    };
  }

  return {
    ok: errors.length === 0,
    errors,
    sensitive: false,
    validated,
    sourceChannel: "direct",
  };
}

/** Short plain-language summary stored in IntakeSubmission.description. */
export function buildIntakeSummary(
  definition: ClarityIntakeDefinition,
  validated: Record<string, ClarityIntakeAnswer>
): string {
  const parts: string[] = [];
  for (const question of definition.questions) {
    const answer = validated[question.id];
    if (answer === undefined) continue;
    if (typeof answer === "string") {
      parts.push(`${question.label}: ${answer}`);
    } else if (Array.isArray(answer)) {
      if (typeof answer[0] === "string") {
        parts.push(`${question.label}: ${(answer as string[]).join(", ")}`);
      } else {
        const entries = answer as ClarityIntakeEntry[];
        parts.push(
          `${question.label} (${entries.length} of max ${question.maxEntries ?? "n/a"}): ` +
            entries
              .map((entry) => Object.values(entry).join(" / "))
              .join(" | ")
        );
      }
    }
  }
  return parts.join("\n");
}
