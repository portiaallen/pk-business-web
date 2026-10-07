import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const origin = process.env.READINESS_TEST_ORIGIN || "http://localhost:4321";
const evidence = "docs/readiness/evidence";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [375, 768, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
    const response = await page.goto(`${origin}/readiness`, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    assert.match(response.headers()["content-security-policy"], /connect-src 'none'/);
    await page.evaluate(() => document.fonts.ready);
    await page.locator("img").evaluateAll((images) => images.forEach((image) => { image.loading = "eager"; }));
    await page.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
    assert.equal(await page.locator("img").evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), true);
    assert.equal(await page.locator('[data-pk-prototype], input[name="email"], textarea').count(), 0);
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    assert.equal(schema.offers.price, "99");
    assert.equal(schema.offers.priceCurrency, "USD");
    assert.equal(schema.offers.url, "https://pkservices.business/readiness");
    assert.equal(schema.offers.availability, "https://schema.org/OutOfStock");
    const before = requests.length;
    await page.locator('input[name="gut"]').first().check({ force: true });
    assert.equal(await page.locator("#pk-gut-result").getAttribute("data-state"), "answered");
    assert.equal(requests.length, before, "gut check transmitted data");
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    await page.locator('[role="tab"]').first().focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#tab-records").getAttribute("aria-selected"), "true");
    assert.equal(await page.locator("#panel-records").isVisible(), true);
    await page.locator("details summary").first().click();
    assert.equal(await page.locator("details").first().getAttribute("open"), "");
    const buttons = page.locator("[data-open-start]");
    for (let i = 0; i < await buttons.count(); i++) {
      // Includes the mobile sticky button, which is intentionally offscreen at some widths.
      await buttons.nth(i).evaluate((button) => button.click());
      assert.equal(await page.locator("#pk-start-dialog").evaluate((dialog) => dialog.open), true);
      assert.match(await page.locator("#pk-dialog-title").textContent(), /not available yet/);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("#pk-start-dialog").open && document.body.style.overflow === "");
      assert.equal(await page.locator("#pk-start-dialog").evaluate((dialog) => dialog.open), false);
      assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    }
    await page.evaluate(() => {
      document.querySelectorAll(".pk-reveal").forEach((element) => element.classList.add("is-visible"));
      scrollTo(0, 0);
    });
    await page.screenshot({ path: `${evidence}/readiness-${width}.png`, fullPage: true });
    assert.deepEqual(errors, [], `browser errors at ${width}`);
    assert.equal(requests.every((request) => request.method === "GET" && request.url.startsWith(origin)), true);
    console.log(`PASS ${width}px: assets, overflow, private gut check, tabs, FAQ, all CTAs, Escape, metadata, console`);
    await context.close();
  }
} finally {
  await browser.close();
}
