import { expect, test } from "@playwright/test";

import { acknowledgeRegistration } from "../../registration-flow";

const password = "Strong-public-flow-password-2026!";
test("public pages, legal review and registration work at desktop and mobile sizes", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  for (const [name, path] of [
    ["About Us", "/about"],
    ["Contact Us", "/contact"],
    ["Terms of Use", "/terms"],
    ["Privacy Policy", "/privacy"],
    ["Cookie Policy", "/cookies"],
    ["Security", "/security"],
  ]) {
    await page
      .getByRole("navigation", { name: "Footer navigation" })
      .getByRole("link", { name, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("main")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto("/does-not-exist/nested");
  await expect(page.getByRole("heading", { name: "404 | Page Not Found" })).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to LumoLynk" })).toBeVisible();
  await page.goto("/login");
  const footer = page.getByRole("navigation", { name: "Footer navigation" });
  await expect(footer.getByRole("link", { name: "Privacy Policy", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await footer.getByRole("link", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(footer.getByRole("link", { name: "Contact Us", exact: true })).toBeVisible();
  const submit = page.getByRole("button", { name: "Create account", exact: true });
  await expect(submit).toBeDisabled();
  await page.getByLabel("Full name").fill("Public Flow");
  await page
    .getByLabel("Email address")
    .fill(`public-${info.project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password", { exact: true }).fill("Wrong-password-2026!");
  await page.getByLabel("Confirm Password", { exact: true }).blur();
  await expect(page.getByRole("alert")).toContainText("Passwords do not match");
  await expect(submit).toBeDisabled();
  await page.getByRole("main").getByRole("link", { name: "Terms of Use", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Acknowledge document" })).toBeDisabled();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(bounds!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.screenshot({ path: info.outputPath("legal-review.png") });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("main").getByRole("link", { name: "Terms of Use", exact: true }),
  ).toBeFocused();
  await expect(page.getByRole("checkbox")).toBeDisabled();
  await acknowledgeRegistration(page, password);
  await expect(submit).toBeEnabled();
  await page.getByRole("main").getByRole("link", { name: "Privacy Policy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.screenshot({ path: info.outputPath("registration.png"), fullPage: true });
  await submit.click();
  await expect(page).toHaveURL(/\/w\/[a-f0-9-]+\/?$/);
  await page.goto("/missing-authenticated");
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  expect(errors).toEqual([]);
});
