import { expect, test, type Page } from "@playwright/test";

// Playwright normally hides scrollbar painting in headless Chromium. Exercise real thumbs.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

async function scrollFixture(page: Page) {
  await page.goto("/about");
  await page.evaluate(() => {
    const pane = document.createElement("section");
    pane.setAttribute("aria-label", "Scroll fixture");
    pane.tabIndex = 0;
    pane.className = "scrollbar-stable";
    pane.style.cssText =
      "position:fixed;left:24px;top:140px;width:240px;height:160px;overflow:auto;z-index:100;background:var(--surface)";
    const content = document.createElement("div");
    content.style.cssText = "width:600px;height:600px";
    content.textContent = "Wide and tall content";
    pane.append(content);
    document.body.append(pane);
  });
  return page.getByRole("region", { name: "Scroll fixture", exact: true });
}

test("native scrollbars follow the theme and retain wheel and keyboard scrolling on both axes", async ({
  page,
}, info) => {
  const pane = await scrollFixture(page);
  await expect(pane).toHaveCSS("scrollbar-width", "thin");
  await expect(page.locator("html")).toHaveCSS("scrollbar-gutter", "stable");
  const colors: string[] = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await pane.hover();
    colors.push(await pane.evaluate((node) => getComputedStyle(node).scrollbarColor));
    await page.mouse.wheel(0, 100);
    await expect.poll(() => pane.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await pane.focus();
    await page.keyboard.press("Control+Home");
    await expect.poll(() => pane.evaluate((node) => node.scrollTop)).toBe(0);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => pane.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
    await page.keyboard.press("PageDown");
    await expect.poll(() => pane.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath(`scrollbars-${theme}.png`) });
  }
  expect(colors[0]).not.toBe(colors[1]);
  expect(colors.every((color) => color !== "auto")).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("stable gutters prevent shifts between short and long content and nested scrolling stays local", async ({
  page,
}) => {
  const pane = await scrollFixture(page);
  const before = await pane.evaluate((node) => node.clientWidth);
  await pane.evaluate((node) => {
    (node.firstElementChild as HTMLElement).style.height = "20px";
  });
  expect(await pane.evaluate((node) => node.clientWidth)).toBe(before);
  await pane.evaluate((node) => {
    const child = node.firstElementChild as HTMLElement;
    child.style.cssText = "width:180px;height:80px;overflow:auto";
    child.setAttribute("aria-label", "Nested scroll fixture");
    child.setAttribute("role", "region");
    child.tabIndex = 0;
    const content = document.createElement("div");
    content.style.height = "600px";
    content.textContent = "Nested content";
    child.replaceChildren(content);
    const spacer = document.createElement("div");
    spacer.style.height = "500px";
    node.append(spacer);
  });
  const nested = page.getByRole("region", { name: "Nested scroll fixture" });
  await expect(nested).toHaveCSS("scrollbar-width", "thin");
  await nested.hover();
  await page.mouse.wheel(0, 80);
  await expect.poll(() => nested.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  expect(await pane.evaluate((node) => node.scrollTop)).toBe(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test("high contrast uses native scrollbars and reduced motion leaves scrolling immediate", async ({
  page,
}) => {
  const pane = await scrollFixture(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(pane).toHaveCSS("scroll-behavior", "auto");
  await page.emulateMedia({ contrast: "more", reducedMotion: "reduce" });
  await expect(pane).toHaveCSS("scrollbar-width", "auto");
  await expect(pane).toHaveCSS("scrollbar-color", "auto");
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await expect(pane).toHaveCSS("scrollbar-width", "auto");
  await expect(pane).toHaveCSS("scrollbar-color", "auto");
  await pane.focus();
  await page.keyboard.press("PageDown");
  await expect.poll(() => pane.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
});

test("classic native scrollbar thumbs remain draggable", async ({ page, isMobile }) => {
  test.skip(isMobile, "Touch platforms manage scrollbar interaction natively.");
  const pane = await scrollFixture(page);
  const gutter = await pane.evaluate(
    (node) => (node as HTMLElement).offsetWidth - node.clientWidth,
  );
  test.skip(gutter === 0, "The platform uses overlay scrollbars with no fixed thumb hit target.");
  const bounds = (await pane.boundingBox())!;
  const x = bounds.x + bounds.width - gutter / 2;
  await page.mouse.move(x, bounds.y + 25);
  await page.mouse.down();
  await page.mouse.move(x, bounds.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => pane.evaluate((node) => node.scrollTop)).toBeGreaterThan(30);
});
