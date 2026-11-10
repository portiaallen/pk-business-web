import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const checkoutPath = fileURLToPath(new URL("../src/app/api/auntpenny/checkout/route.ts", import.meta.url));
const checkout = readFileSync(checkoutPath, "utf8");

test("Aunt Penny checkout remains fail-closed before payment verification", () => {
  assert.match(checkout, /export async function POST\(\)/);
  assert.match(checkout, /status:\s*503/);
  assert.match(checkout, /AUNT_PENNY_CHECKOUT_NOT_READY/);
  assert.match(checkout, /Cache-Control["']:\s*["']no-store/);
  assert.doesNotMatch(checkout, /process\.env\.|stripe\.checkout|payment_intent|checkout\.sessions\.create/);
  assert.doesNotMatch(checkout, /request\.json\(|request\.formData\(/);
});

test("No public paid delivery route is implemented by this placeholder", () => {
  assert.doesNotMatch(checkout, /NextResponse\.redirect|Response\.redirect|sendMail|nodemailer/);
});
