import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { verifyCalendar } from "../../calendar-flow";
import { verifyDrive } from "../../drive-flow";
import { verifyFileModules } from "../../file-modules-flow";
import { verifyProfile } from "../../profile-flow";
import { apiBudgetCheckpoint } from "../../rate-limits";
import { acknowledgeRegistration } from "../../registration-flow";

async function selectOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  const control =
    label === "Workspace"
      ? page
          .locator("[data-app-sidebar]")
          .getByRole("combobox", { name: label, exact: true, includeHidden: true })
      : page.getByRole("combobox", { name: label, exact: true });
  await expect(control).toHaveText(option);
  await expect(control).toBeEnabled();
}

import { verifyDesignSystem } from "./design-system";

const password = "Strong-browser-password-2026!";

async function register(page: Page, name: string, email: string) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await acknowledgeRegistration(page, password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/w\/[a-f0-9-]+\/?$/);
}
async function openNav(page: Page) {
  const menu = page.getByRole("button", { name: /navigation/i });
  if (await menu.isVisible()) {
    await expect(menu).toBeEnabled();
    if ((await menu.getAttribute("aria-expanded")) !== "true") await menu.click();
    await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toBeVisible();
  }
}
async function verifyEmail(page: Page, email: string) {
  const dir = resolve(".local/e2e-mail");
  let link = "";
  await expect
    .poll(async () => {
      for (const file of await readdir(dir)) {
        const mail = JSON.parse(await readFile(resolve(dir, file), "utf8")) as {
          to: string;
          url: string;
        };
        if (mail.to === email) link = mail.url;
      }
      return Boolean(link);
    })
    .toBe(true);
  await page.goto(link);
  await expect(page).toHaveURL(/\/workspaces$/);
}

test("account, setup, Drive, invitations, switching and revocation work with the real API", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(240000);
  const checkpoint = apiBudgetCheckpoint(page.context());
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const ownerEmail = `owner-${suffix}@example.com`;
  const colleagueEmail = `colleague-${suffix}@example.com`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/workspaces");
  await expect(page).toHaveURL(/\/login/);
  await register(page, "Alice Chen", ownerEmail);
  const personalHome = page.url();
  await verifyProfile(page, testInfo.outputPath("profile-crop.png"));
  await verifyCalendar(page, testInfo.outputPath("calendar.png"));
  await page.goto(personalHome);
  await verifyDrive(page, testInfo.outputPath("drive.png"));
  await page.goto(personalHome);
  await expect(page.getByRole("heading", { name: "Make yourself at home, Alice" })).toBeVisible();
  await verifyDesignSystem(page, testInfo);
  await checkpoint();
  await page.getByRole("link", { name: "New workspace" }).click();
  await page.getByLabel("Company or team name").fill("Acme Studio");
  await page.getByLabel("Description").fill("Our browser-tested team");
  await selectOption(page, "Industry", "Technology");
  await selectOption(page, "Company size", "11–50 people");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Job title").fill("Engineer");
  await page.getByLabel("Department").fill("Product");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Ready to create Acme Studio" })).toBeVisible();
  await page.getByRole("button", { name: "Create workspace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Make yourself at home, Alice" })).toBeVisible();
  const teamUrl = page.url();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Make yourself at home, Alice" })).toBeVisible();
  await openNav(page);
  await page.getByRole("link", { name: "Members", exact: false }).click();
  await page.getByLabel("Colleague’s email").fill(colleagueEmail);
  await page.getByRole("button", { name: "Create invitation" }).click();
  const link = await page.getByLabel("Invitation link").inputValue();
  expect(link).toContain("/invite?token=");

  const colleagueContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const colleague = await colleagueContext.newPage();
  await register(colleague, "Bob Rivera", colleagueEmail);
  // Exercise module navigation with a separate user so the combined flow remains
  // within the real per-user API limit and four signups per IP per minute.
  if (testInfo.project.name === "mobile-chromium")
    await colleague.setViewportSize(page.viewportSize()!);
  await verifyFileModules(colleague);
  await colleague.setViewportSize({ width: 1280, height: 900 });
  await verifyEmail(colleague, colleagueEmail);
  await colleague.goto(link);
  await expect(colleague.getByText("Acme Studio", { exact: true })).toBeVisible();
  await colleague.getByRole("button", { name: "Accept invitation" }).click();
  await expect(
    colleague.getByRole("heading", { name: "Make yourself at home, Bob" }),
  ).toBeVisible();
  await colleague.getByRole("link", { name: "People", exact: true }).click();
  await expect(colleague.getByRole("heading", { name: "Alice Chen" })).toBeVisible();
  await expect(colleague.getByRole("link", { name: /Settings/ })).toHaveCount(0);

  await checkpoint();
  await page.reload();
  await expect(page.getByText("Bob Rivera", { exact: true })).toBeVisible();
  await selectOption(page, "Role for Bob Rivera", "moderator");
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByRole("status")).toContainText("membership updated");
  await page.getByRole("button", { name: "Remove member", exact: true }).click();
  await page.getByRole("button", { name: "Confirm remove member" }).click();
  await expect(page.getByText("Bob Rivera", { exact: true })).toHaveCount(0);
  await colleague.reload();
  await expect(
    colleague.getByRole("heading", { name: /Unable to load this page|Workspace unavailable/ }),
  ).toBeVisible();
  await expect(colleague.getByRole("heading", { name: "Alice Chen" })).toHaveCount(0);
  await colleagueContext.close();

  await openNav(page);
  await selectOption(page, "Workspace", "Alice's Workspace");
  await expect(page.getByRole("heading", { name: "Make yourself at home, Alice" })).toBeVisible();
  await expect(page.getByText("Our browser-tested team")).toHaveCount(0);
  await openNav(page);
  await selectOption(page, "Workspace", "Acme Studio");
  await expect(page).toHaveURL(teamUrl);
  await openNav(page);
  await page.getByRole("link", { name: /Settings/ }).click();
  await page.getByLabel("Company or team name").fill("Acme Updated");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByRole("status")).toContainText("settings saved");
  await expect(page.getByRole("combobox", { name: "Company size" })).toHaveText("11–50 people");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("settings.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await openNav(page);
  await page.getByRole("button", { name: /Your profile & account/ }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email address").fill(ownerEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(teamUrl);
  expect(errors).toEqual([]);
});
