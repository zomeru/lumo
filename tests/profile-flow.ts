import { resolve } from "node:path";

import { expect, type Page } from "@playwright/test";

/** Dialog and crop interaction run on both browser sizes and the Electron renderer. */
export async function verifyProfile(page: Page, screenshot: string) {
  await expect(page.locator("[data-app-sidebar]")).toBeAttached();
  const location = page.url();
  const menu = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: /Your profile & account/ }).click();
  const dialog = page.getByRole("dialog", { name: "Your profile", exact: true });
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Choose profile photo", { exact: true })
    .setInputFiles(resolve("packages/ui/src/assets/lumo-logo.png"));
  await expect(dialog.getByRole("img", { name: "Circular crop preview" })).toBeVisible();
  await dialog.getByLabel("Photo zoom", { exact: true }).press("ArrowRight");
  await dialog.getByLabel("Horizontal position", { exact: true }).press("ArrowLeft");
  await dialog.getByLabel("Vertical position", { exact: true }).press("ArrowRight");
  await dialog.getByRole("img", { name: "Circular crop preview" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshot, fullPage: true });
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Cancel photo", exact: true }).click();
  await expect(dialog.getByRole("img", { name: "Circular crop preview" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(page.url()).toBe(location);
}

/** Live private storage acceptance; called for web and Electron with an isolated test account. */
export async function verifyAvatarPersistence(page: Page) {
  const open = async () => {
    const nav = page.getByRole("button", { name: "Open navigation", exact: true });
    if (await nav.isVisible()) await nav.click();
    await page.getByRole("button", { name: /Your profile & account/ }).click();
    return page.getByRole("dialog", { name: "Your profile", exact: true });
  };
  let dialog = await open();
  for (let revision = 0; revision < 2; revision++) {
    await dialog
      .getByLabel("Choose profile photo", { exact: true })
      .setInputFiles(resolve("packages/ui/src/assets/lumo-logo.png"));
    await expect(dialog.getByRole("img", { name: "Circular crop preview" })).toBeVisible();
    if (revision) await dialog.getByLabel("Photo zoom", { exact: true }).press("ArrowRight");
    await dialog.getByRole("button", { name: "Save photo", exact: true }).click();
    await expect(dialog.getByText("Profile photo updated.", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(dialog.getByRole("button", { name: "Remove photo", exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("region", { name: "Profile photo", exact: true }).locator("img"),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.reload();
    dialog = await open();
    await expect(
      dialog.getByRole("region", { name: "Profile photo", exact: true }).locator("img"),
    ).toBeVisible();
  }
  await dialog.getByRole("button", { name: "Remove photo", exact: true }).click();
  await expect(dialog.getByText("Profile photo updated.", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  dialog = await open();
  await expect(dialog.getByRole("button", { name: "Remove photo", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
}
