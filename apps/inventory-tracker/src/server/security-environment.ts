export type SecurityEnvironment = "production" | "preview" | "development" | "test";
export function securityEnvironment(): SecurityEnvironment {
  const declared = process.env.PK_ENVIRONMENT?.trim();
  const hosted = process.env.VERCEL_ENV?.trim();
  const allowed = ["production", "preview", "development", "test"];
  if (declared && !allowed.includes(declared)) throw new Error("Invalid security environment");
  if (hosted && declared !== hosted) throw new Error("Security environment does not match hosting environment");
  if (!declared && (process.env.VERCEL || process.env.NODE_ENV === "production")) {
    throw new Error("Explicit security environment is required");
  }
  return (declared || "development") as SecurityEnvironment;
}
/** A matching declaration is a runtime guard, not proof of provider resource isolation. */
export function assertResourceEnvironment(resource: "DATABASE" | "STORAGE" | "AUTH" | "EMAIL"): void {
  const environment = securityEnvironment();
  if (process.env[`PK_INVENTORY_${resource}_ENVIRONMENT`]?.trim() !== environment) {
    throw new Error("Resource security environment is not approved");
  }
}
export function localSyntheticSetupAllowed(): boolean {
  return !process.env.VERCEL && process.env.NODE_ENV !== "production" &&
    ["development", "test"].includes(securityEnvironment()) &&
    process.env.PK_ALLOW_SYNTHETIC_SETUP === "true" &&
    (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim().startsWith("file:"));
}
