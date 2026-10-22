import { randomUUID } from "node:crypto";

import { legalVersions } from "@lumo/contracts/legal";
import { expect, test, type BrowserContext } from "@playwright/test";

import { verifyMessenger } from "../../messenger-flow";

async function signup(context: BrowserContext, name: string) {
  const response = await context.request.post("http://localhost:3011/api/auth/sign-up/email", {
    headers: { origin: "http://localhost:3010" },
    data: {
      name,
      email: `${randomUUID()}@example.com`,
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
      headers: { origin: "http://localhost:3010" },
      data: { name: "Messenger team", visibility: "public" },
    });
    expect(team.ok()).toBe(true);
    const { id } = await team.json();
    expect(
      (
        await other.request.post(`http://localhost:3011/api/v1/workspaces/${id}/join`, {
          headers: { origin: "http://localhost:3010" },
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
