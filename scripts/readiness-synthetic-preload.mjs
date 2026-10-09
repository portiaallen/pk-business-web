// Test process only. Never shipped as an application provider or enabled on hosting.
import { createHash } from "node:crypto";
if (
  process.env.PK_READINESS_BROWSER_TEST !== "true" ||
  process.env.PK_ENVIRONMENT !== "test" ||
  process.env.NODE_ENV === "production" ||
  process.env.NETLIFY ||
  process.env.VERCEL ||
  !process.env.DATABASE_URL?.startsWith("file:")
)
  throw Error("LOCAL_SYNTHETIC_TEST_ONLY");
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url === "https://api.stripe.com/v1/checkout/sessions") {
    const form = new URLSearchParams(String(options.body));
    const id = form.get("client_reference_id");
    if (!id || form.get("line_items[0][price_data][unit_amount]") !== "9900")
      throw Error("SYNTHETIC_PRICE_ASSERTION");
    const sessionId =
      "cs_test_" + createHash("sha256").update(id).digest("hex").slice(0, 24);
    return Response.json({
      id: sessionId,
      object: "checkout.session",
      mode: "payment",
      status: "open",
      payment_status: "unpaid",
      livemode: false,
      amount_total: 9900,
      currency: "usd",
      client_reference_id: id,
      metadata: { readinessAssessmentId: id },
      url: "https://checkout.stripe.com/c/pay/" + sessionId,
    });
  }
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url))
    return originalFetch(input, options);
  throw Error("SYNTHETIC_EXTERNAL_TRANSPORT_DENIED");
};
