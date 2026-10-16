// Server-side reject-before-persistence screening for the tax intake routes.
// Reuses the vetted detector in @/lib/sensitive-data (the same control that
// guards /api/contact) for value-level detection, and adds field-name-level
// detection so a sensitive KEY is rejected even when its value looks benign.
// Screen BEFORE any persistence; never log matched content.
"use strict";

import { detectSensitiveData } from "@/lib/sensitive-data";

export interface ScreeningFinding {
  source: "key" | "value";
  key: string;
  label: string;
}

const SENSITIVE_KEY_PATTERNS: ReadonlyArray<RegExp> = [
  /(^|[^a-z])ssn([^a-z]|$)/i,
  /social.?security/i,
  /(^|[^a-z])itin([^a-z]|$)/i,
  /ip.?pin/i,
  /identity.?protection.?pin/i,
  /efin/i,
  /routing/i,
  /account.?number/i,
  /bank(?!ruptcy)/i,
  /drivers.?licen[cs]e/i,
  /passport/i,
  /date.?of.?birth|(^|[^a-z])dob([^a-z]|$)/i,
];

function keyNameFindings(key: string): ScreeningFinding[] {
  const hit = SENSITIVE_KEY_PATTERNS.find((re) => re.test(key));
  return hit ? [{ source: "key", key, label: `sensitive field name: ${key}` }] : [];
}

function valueFindings(key: string, value: string): ScreeningFinding[] {
  return detectSensitiveData(value).map((f) => ({
    source: "value" as const,
    key,
    label: f.category,
  }));
}

function walk(payload: unknown, path: string, out: ScreeningFinding[]): void {
  if (payload === null || payload === undefined) return;
  if (typeof payload === "string") {
    out.push(...keyNameFindings(path));
    out.push(...valueFindings(path, payload));
    return;
  }
  if (Array.isArray(payload)) {
    payload.forEach((v, i) => walk(v, `${path}[${i}]`, out));
    return;
  }
  if (typeof payload === "object") {
    for (const k of Object.keys(payload as Record<string, unknown>)) {
      walk((payload as Record<string, unknown>)[k], `${path}.${k}`, out);
    }
  }
}

// Returns { allowed, findings }. Call BEFORE any persistence, on every write.
export function rejectIfSensitive(payload: unknown): { allowed: boolean; findings: ScreeningFinding[] } {
  const findings: ScreeningFinding[] = [];
  walk(payload, "$", findings);
  return { allowed: findings.length === 0, findings };
}
