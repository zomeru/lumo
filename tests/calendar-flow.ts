import { expect, type Page } from "@playwright/test";

async function openNav(page: Page) {
  await expect(page.locator("[data-app-sidebar]")).toBeAttached();
  const button = page.getByRole("button", { name: /navigation/i });
  if (await button.isVisible()) {
    await expect(button).toBeEnabled();
    if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
    await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toBeVisible();
  }
}
async function select(page: Page, name: string, value: string) {
  await page.getByRole("combobox", { name, exact: true }).click();
  if (name === "Scheduling timezone (IANA)" && value === "UTC") {
    // UTC is the last sorted timezone. Exercise keyboard selection without scrolling hundreds of options.
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();
    await listbox.press("End");
    await expect(page.getByRole("option", { name: "UTC", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
  } else await page.getByRole("option", { name: value, exact: true }).click();
  await expect(page.getByRole("combobox", { name, exact: true })).toHaveText(value);
}
/** The same flow runs against real API records in browser, mobile and packaged Electron. */
export async function verifyCalendar(page: Page, screenshot: string) {
  await openNav(page);
  await page.getByRole("link", { name: "Meetings", exact: true }).click();
  await page.getByRole("link", { name: "Schedule meeting", exact: true }).click();
  await expect(page).toHaveURL(/\/calendar\?compose=true/);
  const composer = page.getByRole("dialog", { name: "Schedule meeting", exact: true });
  await expect(composer).toBeVisible();
  await composer.getByLabel("Meeting title").fill("Calendar integration review");
  await composer.getByLabel("Description / agenda").fill("One schedule shared with Meetings");
  await select(page, "Scheduling timezone (IANA)", "UTC");
  const start = new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  await composer.getByLabel("Start date and time").fill(start);
  await composer.getByRole("button", { name: "Schedule meeting", exact: true }).click();
  await expect(
    page.getByText("Meeting saved: Calendar integration review", { exact: true }),
  ).toBeVisible();
  await expect(composer).not.toBeVisible();
  await page.screenshot({ path: screenshot.replace(/\.png$/, "-week.png"), fullPage: true });
  await openNav(page);
  await expect(page.getByRole("link", { name: "Calendar", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "Meetings", exact: true })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
  const menu = page.getByRole("dialog", { name: "Workspace navigation" });
  if (await menu.isVisible())
    await menu.getByRole("link", { name: "Calendar", exact: true }).click();
  await select(page, "Calendar view", "Month");
  await page.getByRole("button", { name: /Calendar integration review/ }).click();
  const details = page.getByRole("dialog", { name: "Calendar integration review", exact: true });
  await expect(details.getByText("One schedule shared with Meetings")).toBeVisible();
  await expect(details.getByLabel("Share meeting link")).toHaveValue(/\/meetings\/[a-f0-9-]+$/);
  await details.getByRole("button", { name: "Edit / reschedule" }).click();
  const edit = page.getByRole("dialog", { name: "Edit scheduled meeting" });
  await edit.getByLabel("Meeting title").fill("Calendar review updated");
  await edit.getByLabel("Duration in minutes").fill("90");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Meeting saved: Calendar review updated", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: screenshot, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole("button", { name: /Calendar review updated/ }).click();
  await page.getByRole("button", { name: "Cancel meeting", exact: true }).click();
  await page.getByRole("button", { name: "Confirm cancel meeting" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Calendar review updated", exact: true })
      .getByText("Canceled", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await select(page, "Calendar view", "Day");
  await select(page, "Calendar view", "Week");
  await openNav(page);
  await page.getByRole("link", { name: "Meetings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Calendar review updated", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Canceled · workspace", { exact: true })).toBeVisible();
}
