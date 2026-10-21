import { test, expect } from "@playwright/test";

import { verifyHr } from "../../hr-flow";
import { acknowledgeRegistration } from "../../registration-flow";
test("People and HR primary workflows persist through the real API", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180000);
  const context = await browser.newContext();
  try {
    const colleague = await context.newPage();
    await page.goto("/register");
    await page.getByLabel("Full name").fill("HR Owner");
    await page
      .getByLabel("Email address")
      .fill(`hr-owner-${info.project.name}-${Date.now()}@example.com`);
    await page.getByLabel("Password", { exact: true }).fill("Strong-hr-owner-password-2026!");
    await acknowledgeRegistration(page, "Strong-hr-owner-password-2026!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/w\/[a-f0-9-]+/);
    await verifyHr(page, colleague, (name) => info.outputPath(`hr-${name}.png`));
  } finally {
    await context.close();
  }
});
