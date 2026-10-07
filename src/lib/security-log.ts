/** Content-free logging: never accept exception messages, bodies, URLs, or identifiers. */
const EVENTS = new Set([
  "API_FAILURE", "CONTACT_EMAIL_FAILURE", "CONTACT_SUBMISSION_FAILURE",
  "DOCUMENT_STORAGE_FAILURE", "DELIVERABLE_STORAGE_FAILURE",
  "TRANSFER_FAILURE", "CHECKOUT_NETWORK_FAILURE", "CHECKOUT_PROVIDER_FAILURE", "RESET_EMAIL_FAILURE",
  "AUTH_DATABASE_CONFIGURATION_FAILURE", "AUTH_DATABASE_AUTHORIZATION_FAILURE",
  "AUTH_DATABASE_SCHEMA_FAILURE", "AUTH_DATABASE_TRANSPORT_FAILURE", "AUTH_DATABASE_FAILURE",
]);
export function safeRuntimeEvent(event: unknown): string {
  return typeof event === "string" && EVENTS.has(event) ? event : "PK_RUNTIME_EVENT";
}
export function logSecurityEvent(event: string): void {
  console.error(JSON.stringify({ event: EVENTS.has(event) ? event : "SECURITY_FAILURE" }));
}
/** Audit metadata is an allowlist. Free text, names, email, notes, and bodies are dropped. */
export function safeAuditMetadata(input: Record<string, unknown>): string {
  const output: Record<string, string | number | boolean | string[]> = {};
  const codes = new Set(["action", "type", "role", "from", "to", "newStatus", "roleChange", "reason"]);
  const ids = new Set(["requestId", "assignedStaffId", "removedUserId", "invoiceId", "documentId"]);
  const numbers = new Set(["size", "durationSeconds", "count"]);
  for (const [key, value] of Object.entries(input)) {
    if (codes.has(key) && typeof value === "string" && /^[a-zA-Z_]{1,64}$/.test(value)) output[key] = value;
    if (ids.has(key) && typeof value === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(value)) output[key] = value;
    if (numbers.has(key) && typeof value === "number" && Number.isSafeInteger(value) && value >= 0) output[key] = value;
    if (key === "isManual" && typeof value === "boolean") output[key] = value;
  }
  if (Array.isArray(input.fieldsChanged)) output.fieldsChanged = input.fieldsChanged.filter((field): field is string => typeof field === "string" && ["status", "notes"].includes(field));
  return JSON.stringify(output);
}
