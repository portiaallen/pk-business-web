/** Return fixed diagnostic categories only. Never return provider messages or metadata. */
export function authenticationDatabaseFailureEvent(error: unknown): string {
  try {
    let current: unknown = error;
    const seen = new Set<unknown>();
    for (let depth = 0; depth < 4 && current && typeof current === "object"; depth++) {
      if (seen.has(current)) break;
      seen.add(current);
      const item = current as { code?: unknown; message?: unknown; cause?: unknown };
      const code = typeof item.code === "string" ? item.code : "";
      if (["P1000", "UNAUTHORIZED", "AUTH_TOKEN_EXPIRED", "AUTH_TOKEN_INVALID"].includes(code))
        return "AUTH_DATABASE_AUTHORIZATION_FAILURE";
      if (["P2021", "P2022"].includes(code))
        return "AUTH_DATABASE_SCHEMA_FAILURE";
      if (["P1001", "P1002", "P1008", "P1017", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "FETCH_FAILED", "SERVER_ERROR"].includes(code))
        return "AUTH_DATABASE_TRANSPORT_FAILURE";
      if (typeof item.message === "string" && [
        "DATABASE_URL is not configured. Configure the approved remote database for this hosting environment.",
        "DATABASE_AUTH_TOKEN is required when using a libsql:// DATABASE_URL.",
        "Unsupported database provider", "Production database must be remote",
        "Resource security environment is not approved", "Ambiguous hosting environment",
        "Unknown hosting environment", "Invalid security environment",
        "Security environment does not match hosting environment", "Explicit security environment is required",
      ].includes(item.message)) return "AUTH_DATABASE_CONFIGURATION_FAILURE";
      current = item.cause;
    }
  } catch { /* Even hostile error objects cannot break the generic failure response. */ }
  return "AUTH_DATABASE_FAILURE";
}
