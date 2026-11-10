import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const PRODUCT_CODE = "aunt-penny-roast-report-v1";
export const PRICE_CENTS = 999;
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
type CheckoutSession = { id: string; url?: string | null; payment_status?: string; mode?: string; currency?: string; amount_total?: number; metadata?: Record<string,string>; client_reference_id?: string; customer_details?: { email?: string | null } };
type CheckoutInput = { mode: string; customer_email: string; line_items: { price_data: { currency: string; unit_amount: number; product_data: { name: string; description: string } }; quantity: number }[]; success_url: string; cancel_url: string; client_reference_id: string; metadata: Record<string,string>; payment_method_types: string[] };
export function sandboxStripe() {
  const key = process.env.AUNT_PENNY_STRIPE_TEST_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) throw new Error("Aunt Penny sandbox-only checkout is not configured");
  async function api(path: string, init?: RequestInit): Promise<CheckoutSession> {
    const response = await fetch("https://api.stripe.com/v1/" + path, { ...init, headers: { Authorization: "Bearer " + key, ...(init?.headers || {}) }, cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error("Stripe sandbox request failed: " + response.status);
    return await response.json() as CheckoutSession;
  }
  return {
    checkout: { sessions: {
      create: async (data: CheckoutInput, options: { idempotencyKey: string }) => {
        const form = new URLSearchParams();
        form.set("mode", data.mode);
        form.set("customer_email", data.customer_email);
        form.set("success_url", data.success_url);
        form.set("cancel_url", data.cancel_url);
        form.set("client_reference_id", data.client_reference_id);
        data.payment_method_types.forEach((method,i) => form.set("payment_method_types[" + i + "]", method));
        data.line_items.forEach((line,i) => {
          const prefix = "line_items[" + i + "]";
          form.set(prefix + "[quantity]", String(line.quantity));
          form.set(prefix + "[price_data][currency]", line.price_data.currency);
          form.set(prefix + "[price_data][unit_amount]", String(line.price_data.unit_amount));
          form.set(prefix + "[price_data][product_data][name]", line.price_data.product_data.name);
          form.set(prefix + "[price_data][product_data][description]", line.price_data.product_data.description);
        });
        Object.entries(data.metadata).forEach(([k,v]) => form.set("metadata[" + k + "]", v));
        return api("checkout/sessions", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": options.idempotencyKey }, body: form.toString() });
      },
      retrieve: async (id: string) => {
        if (!/^cs_test_[a-zA-Z0-9_]+$/.test(id) || id.length > 255) throw new Error("Invalid test session ID");
        return api("checkout/sessions/" + encodeURIComponent(id));
      },
    } },
    webhooks: { constructEvent: (payload: string, header: string, secret: string): { type: string; data: { object: CheckoutSession } } => {
      if (!secret.startsWith("whsec_") || payload.length > 1000000) throw new Error("Invalid webhook");
      const fields = header.split(",").map(part => part.trim().split("="));
      const timestamp = fields.find(pair => pair[0] === "t")?.[1];
      const signatures = fields.filter(pair => pair[0] === "v1").map(pair => pair[1]);
      if (!timestamp || !/^\\d{10,}$/.test(timestamp) || Math.abs(Date.now()/1000 - Number(timestamp)) > 300 || !signatures.length) throw new Error("Invalid signature timestamp");
      const expected = createHmac("sha256", secret).update(timestamp + "." + payload).digest();
      const valid = signatures.some(signature => {
        if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
        return timingSafeEqual(expected, Buffer.from(signature, "hex"));
      });
      if (!valid) throw new Error("Invalid webhook signature");
      const event = JSON.parse(payload) as { type: string; data: { object: CheckoutSession } };
      if (!event || typeof event.type !== "string" || !event.data?.object?.id) throw new Error("Malformed webhook");
      return event;
    } },
  };
}
export function requireSandbox() {
  if (process.env.AUNT_PENNY_PAID_SANDBOX_ENABLED !== "true") throw new Error("Aunt Penny paid sandbox is disabled");
}
export function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function issueToken() { return randomBytes(32).toString("base64url"); }
export function publicOrigin() {
  const raw = process.env.AUNT_PENNY_TEST_ORIGIN;
  if (!raw) throw new Error("AUNT_PENNY_TEST_ORIGIN is required");
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Checkout origin must be HTTPS");
  return url.origin;
}
