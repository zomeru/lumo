import { randomUUID } from "node:crypto";

import { legalVersions } from "@lumolynk/contracts/legal";
import { expect, test, type BrowserContext } from "@playwright/test";

import { verifyMedia } from "../../media-flow";
import { verifyMessenger } from "../../messenger-flow";
import { verifyAvatarPersistence } from "../../profile-flow";
import { reserveRegistration } from "../../rate-limits";

const apiOrigin = process.env.LUMOLYNK_E2E_API_ORIGIN ?? "http://localhost:3011";
const webOrigin = process.env.LUMOLYNK_E2E_WEB_ORIGIN ?? "http://localhost:3010";
async function signup(context: BrowserContext, name: string) {
  await reserveRegistration();
  const email = `${randomUUID()}@example.com`;
  const response = await context.request.post(`${apiOrigin}/api/auth/sign-up/email`, {
    headers: { origin: webOrigin },
    data: {
      name,
      email,
      password: "Messenger-e2e-password!2026",
      confirmPassword: "Messenger-e2e-password!2026",
      consent: {
        accepted: true,
        termsVersion: legalVersions.terms,
        privacyVersion: legalVersions.privacy,
      },
    },
  });
  expect(response.ok()).toBe(true);
  return email;
}
test("workspace channels, private membership, realtime, threads, search and DMs work through the real API", async ({
  page,
  context,
  browser,
}, testInfo) => {
  await signup(context, "Messenger Owner");
  const other = await browser.newContext({ baseURL: "http://localhost:3010" });
  try {
    await signup(other, "Messenger Peer");
    const team = await context.request.post("http://localhost:3011/api/v1/workspaces", {
      headers: { origin: webOrigin },
      data: { name: "Messenger team", visibility: "public" },
    });
    expect(team.ok()).toBe(true);
    const { id } = await team.json();
    expect(
      (
        await other.request.post(`http://localhost:3011/api/v1/workspaces/${id}/join`, {
          headers: { origin: webOrigin },
          data: {},
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/w/${id}/messenger`);
    await verifyMessenger(
      page,
      id,
      "Messenger Peer",
      testInfo.outputPath("messenger.png"),
      await other.newPage(),
    );
  } finally {
    await other.close();
  }
});

test("live private S3 attachments send and download through Messenger", async ({
  page,
  context,
}, testInfo) => {
  test.skip(
    process.env.LUMOLYNK_LIVE_MESSENGER_STORAGE !== "1",
    "Requires the existing private S3 configuration.",
  );
  await signup(context, "Attachment Owner");
  const me = await (await context.request.get(`${apiOrigin}/api/v1/me`)).json(),
    workspaceId = me.activeWorkspaceId;
  await page.goto(`/w/${workspaceId}/messenger`);
  await page.getByRole("button", { name: "Create channel", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create channel", exact: true });
  await dialog.getByLabel("Channel name").fill("Attachment validation");
  await dialog.getByRole("button", { name: "Create channel", exact: true }).click();
  await page.getByLabel("Choose attachment", { exact: true }).setInputFiles({
    name: "messenger-validation.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("LumoLynk Messenger attachment validation"),
  });
  await expect(
    page.getByRole("button", { name: "Remove messenger-validation.txt", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const history = page.getByRole("list", { name: "Messages", exact: true });
  await expect(history.getByText("Unscanned file", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await history
    .getByRole("button", { name: "messenger-validation.txt · Download", exact: true })
    .click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("messenger-validation.txt");
  await file.saveAs(testInfo.outputPath("messenger-validation.txt"));
  expect(await file.failure()).toBeNull();
});

test("profile photos save, replace, reload and remove in private storage", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.LUMOLYNK_LIVE_AVATAR_STORAGE !== "1",
    "Requires configured private S3 storage.",
  );
  const email = await signup(context, "Avatar Persistence");
  const me = await (await context.request.get(`${apiOrigin}/api/v1/me`)).json();
  await page.goto(`/w/${me.activeWorkspaceId}`);
  const second = await context.request.post(`${apiOrigin}/api/v1/workspaces`, {
    headers: { origin: webOrigin },
    data: { name: "Avatar switching", visibility: "private" },
  });
  expect(second.ok()).toBe(true);
  const other = await second.json();
  await verifyAvatarPersistence(page, async (current) => {
    await current.goto(`/w/${other.id}?profile=true`);
    const profile = current.getByRole("dialog", { name: "Your profile", exact: true });
    await expect(
      profile.getByRole("region", { name: "Profile photo", exact: true }).locator("img"),
    ).toBeVisible();
    await profile.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(current).toHaveURL(/\/login/);
    await current.getByLabel("Email address").fill(email);
    await current.getByLabel("Password", { exact: true }).fill("Messenger-e2e-password!2026");
    await current.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(current).toHaveURL(/\/w\/[a-f0-9-]+/);
    return current;
  });
});

test("live private media thumbnails, gallery and playback work in both themes", async ({
  page,
  context,
}, info) => {
  test.skip(
    process.env.LUMOLYNK_LIVE_MESSENGER_STORAGE !== "1",
    "Requires existing private S3 storage.",
  );
  await signup(context, "Media Owner");
  const me = await (await context.request.get(`${apiOrigin}/api/v1/me`)).json();
  await page.goto(`/w/${me.activeWorkspaceId}/messenger`);
  await verifyMedia(page, (name) => info.outputPath(name));
});
