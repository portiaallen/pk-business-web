import Stripe from "stripe";
import { createHash, randomBytes } from "node:crypto";

export const PRODUCT_CODE = "aunt-penny-roast-report-v1";
export const PRICE_CENTS = 999;
export const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

export function sandboxStripe(): Stripe {
  const key = process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("Aunt Penny sandbox-only checkout is not configured");
  return new Stripe(key);
}
export function requireSandbox() {
  if (process.env.AUNT_PENNY_PAID_SANDBOX_ENABLED !== "true") throw new Error("Aunt Penny paid sandbox is disabled");
}
export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function issueToken() {
  return randomBytes(32).toString("base64url");
}
export function publicOrigin() {
  const raw = process.env.AUNT_PENNY_TEST_ORIGIN;
  if (!raw) throw new Error("AUNT_PENNY_TEST_ORIGIN is required");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Checkout origin must be HTTPS");
  return url.origin;
}
