import { expect, type Page, type TestInfo } from "@playwright/test";

export async function verifyDesignSystem(page: Page, testInfo: TestInfo) {
  const workspace = new URL(page.url()).pathname.split("/")[2]!;
  const main = page.locator("#main-content");
  await page.screenshot({ path: testInfo.outputPath("home-light.png"), fullPage: true });
  const light = await page
    .locator("body")
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  await page.getByRole("button", { name: "Change appearance" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page.locator("body").evaluate((node) => getComputedStyle(node).backgroundColor),
  ).not.toBe(light);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: "Make yourself at home, Alice" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("home-dark.png"), fullPage: true });
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) {
    await menu.click();
    const dialog = page.getByRole("dialog", { name: "Workspace navigation" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(menu).toBeFocused();
    await menu.click();
    await dialog.getByRole("link", { name: "Messenger", exact: true }).click();
  } else {
    await page
      .getByRole("navigation", { name: "Workspace navigation" })
      .getByRole("link", { name: "Messenger", exact: true })
      .click();
  }
  await expect(main.getByRole("heading", { name: "Messenger", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New conversation" }).click();
  const dialog = page.getByRole("dialog", { name: "New conversation" });
  await dialog.getByRole("combobox", { name: "Type" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("option", { name: "Private group" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("combobox", { name: "Type" })).toHaveText("Private group");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "New conversation" })).toBeFocused();
  await page.goto(`/w/${workspace}/meetings`);
  await page.getByRole("button", { name: "Invite workspace members (optional)" }).click();
  await page.getByRole("searchbox").fill("Alice");
  await page.getByRole("checkbox", { name: "Alice Chen" }).check();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Invite workspace members (optional)" }),
  ).toHaveText("1 selected");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("meetings-dark.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Change appearance" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Light" }).click();
  await page.goto(`/w/${workspace}`);
}
