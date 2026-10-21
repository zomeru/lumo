import { expect, type Page } from "@playwright/test";

/** Complete the same legal review required of a person registering on web or desktop. */
export async function acknowledgeRegistration(page: Page, password: string) {
  await page.getByLabel("Confirm Password", { exact: true }).fill(password);
  for (const title of ["Terms of Use", "Privacy Policy"]) {
    await page.getByRole("link", { name: title, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    const document = dialog.getByRole("region");
    await document.focus();
    await document.press("End");
    await dialog.getByRole("button", { name: "Acknowledge document" }).click();
    await expect(dialog).not.toBeVisible();
  }
  await page.getByRole("checkbox").check();
}
