import { expect, type Page } from "@playwright/test";

export async function verifyDrive(page: Page, screenshot: string) {
  const home = new URL(page.url()).pathname.replace(/\/$/, "");
  await page.goto(new URL(home + "/drive", page.url()).href);
  await expect(page.getByRole("heading", { name: "Drive", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No files here yet" })).toBeVisible();
  async function create(name: string) {
    await page.getByRole("button", { name: "New folder", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("dialog").getByRole("button", { name: "New folder", exact: true }).click();
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  async function menu(name: string, action: string) {
    await page.getByRole("button", { name: `Actions for ${name}` }).click();
    await page.getByRole("menuitem", { name: action, exact: true }).click();
  }
  await create("Design assets");
  await page.getByRole("button", { name: "Design assets", exact: true }).click();
  await create("Brand kit");
  await page
    .getByRole("navigation", { name: "Folder breadcrumbs" })
    .getByRole("button", { name: "My Files" })
    .click();
  await expect(page.getByRole("button", { name: "Design assets", exact: true })).toBeVisible();
  await menu("Design assets", "Rename");
  await page.getByLabel("Name", { exact: true }).fill("Creative library");
  await page.getByRole("dialog").getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByRole("button", { name: "Creative library", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Star Creative library", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Unstar Creative library", exact: true }),
  ).toBeVisible();
  await menu("Creative library", "Make a copy");
  await page.getByRole("dialog").getByRole("button", { name: "Make a copy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Creative library (copy)", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Grid view" }).click();
  await page.screenshot({ path: screenshot, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await menu("Creative library (copy)", "Move to Trash");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Move to Trash", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Creative library (copy)", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Creative library (copy)", exact: true }),
  ).toBeVisible();
  await menu("Creative library (copy)", "Restore");
  await expect(page.getByRole("heading", { name: "Trash is empty" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Trash is empty" })).toBeVisible();
}
