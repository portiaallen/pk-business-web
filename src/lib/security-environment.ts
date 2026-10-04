export type SecurityEnvironment = "production" | "preview" | "development" | "test";
/** Provider markers are never authorization; they prevent hosted local fallbacks. */
export function isHostedRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV ||
    process.env.NETLIFY || process.env.CONTEXT);
}
export function securityEnvironment(): SecurityEnvironment {
  const declared = process.env.PK_ENVIRONMENT?.trim();
  const vercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const netlify = Boolean(process.env.NETLIFY || process.env.CONTEXT);
  const contexts: Record<string, SecurityEnvironment> = {
    production: "production", "deploy-preview": "preview",
    "branch-deploy": "preview", dev: "development",
  };
  if (vercel && netlify) throw new Error("Ambiguous hosting environment");
  const providerContext = vercel ? process.env.VERCEL_ENV?.trim() : process.env.CONTEXT?.trim();
  const hosted = vercel
    ? (["production", "preview", "development"].includes(providerContext || "") ? providerContext : undefined)
    : netlify ? contexts[providerContext || ""] : undefined;
  if (isHostedRuntime() && !hosted) throw new Error("Unknown hosting environment");
  const allowed = ["production", "preview", "development", "test"];
  if (declared && !allowed.includes(declared)) throw new Error("Invalid security environment");
  if (hosted && declared !== hosted) throw new Error("Security environment does not match hosting environment");
  if (!declared && (isHostedRuntime() || process.env.NODE_ENV === "production")) {
    throw new Error("Explicit security environment is required");
  }
  return (declared || "development") as SecurityEnvironment;
}
/** A matching declaration is a runtime guard, not proof of provider resource isolation. */
export function assertResourceEnvironment(resource: "DATABASE" | "STORAGE" | "AUTH" | "EMAIL" | "STRIPE"): void {
  const environment = securityEnvironment();
  if (process.env[`PK_${resource}_ENVIRONMENT`]?.trim() !== environment) {
    throw new Error("Resource security environment is not approved");
  }
}
export function localSyntheticSetupAllowed(): boolean {
  return !isHostedRuntime() && process.env.NODE_ENV !== "production" &&
    ["development", "test"].includes(securityEnvironment()) &&
    process.env.PK_ALLOW_SYNTHETIC_SETUP === "true" &&
    (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim().startsWith("file:"));
}
