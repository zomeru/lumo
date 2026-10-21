import { expect, type Page } from "@playwright/test";

export async function verifyFileModules(page: Page) {
  await expect(
    page.getByRole("heading", { level: 1, name: /Make yourself at home/ }),
  ).toBeVisible();
  const workspacePath = new URL(page.url()).pathname.match(/^\/w\/[^/]+/)![0];
  const modules = [
    ["Docs", "docs", "New document", ".docx"],
    ["Sheets", "sheets", "New spreadsheet", ".xlsx"],
    ["Slides", "slides", "New presentation", ".pptx"],
    ["Wiki", "wiki", "New Wiki page", ""],
    ["Drive (All Files)", "drive", "New file", ""],
  ] as const;
  for (const [title, route, action, extension] of modules) {
    const menu = page.getByRole("button", { name: /navigation/i });
    if (await menu.isVisible()) {
      if ((await menu.getAttribute("aria-expanded")) !== "true") await menu.click();
    }
    const navigation = page.getByRole("navigation", {
      name: "Workspace navigation",
      includeHidden: true,
    });
    await expect(navigation.getByRole("link", { name: "Docs", exact: true })).toBeVisible();
    const labels = await navigation.getByRole("link").allTextContents();
    const start = labels.indexOf("Docs");
    expect(labels.slice(start, start + 5)).toEqual(modules.map(([name]) => name));
    await navigation.getByRole("link", { name: title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${workspacePath}/${route}(?:\\?|$)`));
    await expect(page.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
    await expect(navigation.locator('a[aria-current="page"]')).toHaveText(title);
    await expect(page.getByRole("button", { name: "Shared with Me", exact: false })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "File type", exact: true })).toHaveCount(
      title === "Drive (All Files)" ? 1 : 0,
    );
    if (extension) {
      await expect(page.getByLabel("Upload files", { exact: true })).toHaveAttribute(
        "accept",
        new RegExp(`\\${extension}`),
      );
    }
    await page.getByRole("button", { name: action, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Type", exact: true })).toHaveCount(
      title === "Drive (All Files)" ? 1 : 0,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
    await expect(navigation.locator('a[aria-current="page"]')).toHaveText(title);
  }
  await page.goto(new URL(`${workspacePath}/files?type=pdf&q=report`, page.url()).href);
  await expect(page).toHaveURL(/\/drive\?.*q=report/);
  await expect(page.getByRole("heading", { name: "Drive (All Files)", exact: true })).toBeVisible();
  for (const [type, title, route] of [
    ["document", "Docs", "docs"],
    ["sheet", "Sheets", "sheets"],
    ["slide", "Slides", "slides"],
    ["wiki", "Wiki", "wiki"],
  ]) {
    await page.goto(new URL(`${workspacePath}/documents?type=${type}`, page.url()).href);
    await expect(page).toHaveURL(new RegExp(`/${route}(?:\\?|$)`));
    await expect(page.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
  }
  await page.goto(new URL(workspacePath, page.url()).href);
  await expect(
    page.getByRole("heading", { level: 1, name: /Make yourself at home/ }),
  ).toBeVisible();
}
