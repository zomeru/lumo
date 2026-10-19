import { expect, type ElectronApplication, type Page, type TestInfo } from "@playwright/test";

export async function verifyDesktopScrolling(app: ElectronApplication, page: Page, info: TestInfo) {
  const desktopWindow = await app.browserWindow(page);
  await desktopWindow.evaluate((win) => win.setSize(1100, 600));
  const header = page.locator("[data-app-header]");
  const navigation = page.getByRole("navigation", { name: "Workspace navigation" });
  await expect(navigation).toBeVisible();
  await expect(navigation).toHaveCSS("scrollbar-width", "thin");
  await expect(navigation).toHaveCSS("scrollbar-gutter", "auto");
  await expect(page.locator("html")).toHaveCSS("scrollbar-width", "thin");
  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("button", { name: "Change appearance" }).click();
    await page.getByRole("menuitemcheckbox", { name: theme, exact: true }).click();
    await page.locator("#main-content").hover();
    await page.mouse.wheel(0, 400);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect((await header.boundingBox())!.y).toBe(0);
    const controls = page.getByRole("group", { name: "Window controls" });
    if (await controls.count()) expect((await controls.boundingBox())!.y).toBe(0);
    await page.screenshot({
      path: info.outputPath(`desktop-scrollbars-${theme.toLowerCase()}.png`),
    });
  }
  await navigation.locator("summary").click();
  const pageOffset = await page.evaluate(() => window.scrollY);
  await navigation.hover();
  await page.mouse.wheel(0, 100);
  await expect.poll(() => navigation.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(pageOffset);
  await navigation.locator("summary").click();
  const workspaceUrl = page.url();
  await desktopWindow.evaluate((win) => win.setSize(1280, 850));
  await page.goto(new URL("/about", page.url()).href);
  await expect(page.getByRole("heading", { name: "About Lumo" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight))
    .toBe(true);
  expect(
    await page.evaluate(() => document.documentElement.clientWidth === window.innerWidth),
  ).toBe(true);
  await page.goto(workspaceUrl);
  await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
}
