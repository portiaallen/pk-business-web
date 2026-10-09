import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
const origin = process.env.READINESS_TEST_ORIGIN || "http://localhost:4333";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(origin + "/readiness");
  const results = [];
  for (const state of ["landing", "preliminary-modal"]) {
    if (state === "preliminary-modal") {
      await page.locator("[data-open-start]").first().click();
      await page.locator("#pk-name").waitFor({ state: "visible" });
    }
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({
      state,
      violations: result.violations,
      incomplete: result.incomplete.map((x) => ({
        id: x.id,
        impact: x.impact,
      })),
      passes: result.passes.map((x) => x.id),
    });
  }
  writeFileSync(
    "docs/readiness/evidence/accessibility.json",
    JSON.stringify(results, null, 2),
  );
  for (const result of results) {
    assert.deepEqual(
      result.violations,
      [],
      result.state + " accessibility violations",
    );
    console.log(
      "PASS " +
        result.state +
        ": zero automated WCAG A/AA violations; manual keyboard/focus checks covered in landing suite.",
    );
  }
} finally {
  await browser.close();
}
