// Server-side screen for sensitive taxpayer information in public free text.
// PK public forms must never collect or persist tax-identity data: SSNs,
// ITINs, IP PINs, EFINs, bank routing/account numbers, or tax document
// references. The UI warns; this module enforces it server-side so the
// warning is not the only control. Detection is intentionally
// false-positive-resistant for legitimate contact fields: phone numbers and
// plain prose pass, structured tax identifiers do not.

export type SensitiveDataCategory =
  | "SSN_OR_ITIN"
  | "EIN"
  | "ROUTING_OR_ACCOUNT_NUMBER"
  | "IP_PIN"
  | "EFIN"
  | "TAX_DOCUMENT_KEYWORD";

const SSN_OR_ITIN = /\b\d{3}-\d{2}-\d{4}\b|\b9\d{2}-\d{2}-\d{4}\b|\b\d{9}\b/;
const EIN = /\b\d{2}-\d{7}\b/;
const ROUTING_OR_ACCOUNT = /\b(?:routing|account)(?:\s+number)?\s*[:#]?\s*\d{8,17}\b/i;
const IP_PIN = /\b(?:ip\s*pin|identity\s*protection\s*pin)\b[^\n]{0,20}\b\d{6}\b|\b\d{6}\b(?=[^\n]{0,20}\b(?:ip\s*pin|identity\s*protection\s*pin)\b)/i;
const EFIN = /\b(?:efin|electronic\s*filing\s*identification\s*number)\b|\b\d{2}-\d{7}\b/i;
const TAX_DOCUMENT_KEYWORD = /\b(?:w-?2|1099|k-?1|form\s*8879|tax\s*return\s*attached|i\s*(?:have\s*)?attached\s*my\s*tax(?:\s*return|\s*documents)?)\b/i;

const RULES: ReadonlyArray<readonly [SensitiveDataCategory, RegExp]> = [
  ["SSN_OR_ITIN", SSN_OR_ITIN],
  ["EIN", EIN],
  ["ROUTING_OR_ACCOUNT_NUMBER", ROUTING_OR_ACCOUNT],
  ["IP_PIN", IP_PIN],
  ["EFIN", EFIN],
  ["TAX_DOCUMENT_KEYWORD", TAX_DOCUMENT_KEYWORD],
];

export interface SensitiveDataFinding {
  category: SensitiveDataCategory;
}

/**
 * Screen a piece of free text for sensitive taxpayer information.
 * Returns the categories detected (empty array when clean). Never returns or
 * logs the matched content itself.
 */
export function detectSensitiveData(text: string | null | undefined): SensitiveDataFinding[] {
  if (!text) return [];
  const findings: SensitiveDataFinding[] = [];
  for (const [category, pattern] of RULES) {
    if (pattern.test(text)) findings.push({ category });
  }
  return findings;
}

/**
 * Scan the fields a public contact form accepts as free text. Phone and
 * email are expected contact channels and are not scanned; a phone number's
 * digits must never trip the SSN rule.
 */
export function screenContactSubmission(fields: {
  fullName: string;
  businessName?: string | null;
  description: string;
}): SensitiveDataFinding[] {
  const scanned = [fields.fullName, fields.businessName, fields.description];
  const findings: SensitiveDataFinding[] = [];
  for (const value of scanned) {
    for (const finding of detectSensitiveData(value)) {
      if (!findings.some((f) => f.category === finding.category)) {
        findings.push(finding);
      }
    }
  }
  return findings;
}

export const SENSITIVE_DATA_GUIDANCE =
  "Please remove sensitive information such as Social Security numbers, tax forms, or bank details and resubmit, or contact us directly to share it securely.";
