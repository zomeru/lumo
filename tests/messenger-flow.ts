import { expect, type Page } from "@playwright/test";

async function select(page: Page, label: string, value: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
/** Shared, persisted Messenger user journey for browser/mobile and Electron. */
export async function verifyMessenger(
  page: Page,
  workspaceId: string,
  peerName: string,
  screenshot: string,
  peer?: Page,
) {
  const origin = page.url().startsWith("lumo:") ? "lumo://app" : "http://localhost:3010",
    root = `${origin}/w/${workspaceId}/messenger`;
  await page.goto(root);
  if (peer) {
    await peer.goto(`http://localhost:3010/w/${workspaceId}/messenger`);
    await expect(peer.getByText("Connected", { exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Create channel", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Create channel", exact: true });
  await expect(dialog.getByLabel("Find members")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Browse channels", exact: true })).toHaveCount(0);
  await dialog.getByLabel("Channel name").fill("Launch team");
  await dialog.getByLabel("Description").fill("Shared launch planning");
  await dialog.getByRole("button", { name: "Create channel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "# Launch team", exact: true })).toBeVisible();
  const channelId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.getByLabel("Message", { exact: true }).fill("Messenger launch hello");
  await page.getByLabel("Message", { exact: true }).press("Enter");
  const history = page.getByRole("list", { name: "Messages", exact: true });
  await expect(history.getByText("Messenger launch hello", { exact: true })).toBeVisible();
  if (peer) {
    await peer.getByRole("link", { name: /Launch team/ }).click();
    await expect(peer).toHaveURL(new RegExp(`/messenger/${channelId}$`));
    await expect(
      peer
        .getByRole("list", { name: "Messages", exact: true })
        .getByText("Messenger launch hello", { exact: true }),
    ).toBeVisible();
    await expect(peer.getByLabel("Message", { exact: true })).toBeVisible();
    await expect(peer.getByRole("button", { name: "Join channel", exact: true })).toHaveCount(0);
    await expect(peer.getByRole("button", { name: "Create channel", exact: true })).toHaveCount(0);
    await peer.getByLabel("Message", { exact: true }).fill("Peer realtime reply");
    await peer.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(history.getByText("Peer realtime reply", { exact: true })).toBeVisible();
  }
  let message = history
    .locator("li[data-message-id]")
    .filter({ hasText: "Messenger launch hello" });
  await message.hover();
  await message.getByRole("button", { name: "Add reaction", exact: true }).click();
  await page.getByRole("combobox", { name: "Type to search for an emoji" }).fill("party popper");
  await page.getByRole("gridcell", { name: "party popper", exact: true }).first().click();
  await expect(message.getByRole("button", { name: "🎉 1", exact: true })).toBeVisible();
  await message.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(message.getByText("Pinned", { exact: true })).toBeVisible();
  await message.getByRole("button", { name: "More message actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit message", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Edit message", exact: true });
  await dialog.getByLabel("Edit message body").fill("Messenger launch edited");
  await dialog.getByRole("button", { name: "Save message", exact: true }).click();
  await expect(history.getByText("Messenger launch edited", { exact: true })).toBeVisible();
  message = history.locator("li[data-message-id]").filter({ hasText: "Messenger launch edited" });
  await message.getByRole("button", { name: "Reply in thread", exact: true }).click();
  const thread = page.getByRole("complementary", { name: "Thread", exact: true });
  await thread.getByLabel("Message", { exact: true }).fill("Thread decision");
  await thread.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(thread.getByText("Thread decision", { exact: true })).toBeVisible();
  await thread.getByRole("button", { name: "Close thread", exact: true }).click();
  await page.getByRole("button", { name: "Search messages", exact: true }).click();
  await page.getByLabel("Search workspace messages", { exact: true }).fill("launch edited");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  const search = page.getByRole("region", { name: "Message search", exact: true });
  await search.getByRole("link").first().click();
  await expect(
    page.getByRole("link", { name: "Return to latest messages", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Return to latest messages", exact: true }).click();
  await page.getByRole("button", { name: "Conversation settings", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Launch team settings", exact: true });
  await dialog.getByRole("button", { name: "Archive channel", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Unarchive channel", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Conversation settings", exact: true }).click();
  await page.getByRole("button", { name: "Unarchive channel", exact: true }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Files", exact: true }).click();
  await expect(page.getByText("No shared files.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Files", exact: true }).click();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  const dimensions = await page.evaluate(() => {
    const main = document.querySelector("main")!,
      section = document.querySelector('[aria-label="Workspace messenger"]')!;
    const a = main.getBoundingClientRect(),
      b = section.getBoundingClientRect();
    return {
      width: Math.abs(a.width - b.width),
      height: Math.abs(a.height - b.height),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(dimensions.width).toBeLessThan(2);
  expect(dimensions.height).toBeLessThan(2);
  expect(dimensions.overflow).toBe(false);
  await page.screenshot({ path: screenshot });
  await page.goto(root);
  await page.getByRole("button", { name: "Create channel", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Create channel", exact: true });
  await dialog.getByLabel("Channel name").fill("Private launch");
  await select(page, "Visibility", "Private");
  await dialog.getByRole("button", { name: "Create channel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "🔒 Private launch", exact: true })).toBeVisible();
  const privateId = new URL(page.url()).pathname.split("/").at(-1)!;
  if (peer) {
    await peer.goto(`http://localhost:3010/w/${workspaceId}/messenger/${privateId}`);
    await expect(
      peer.getByRole("heading", { name: "Conversation unavailable", exact: true }),
    ).toBeVisible();
    await expect(peer.getByRole("heading", { name: "🔒 Private launch", exact: true })).toHaveCount(
      0,
    );
  }
  await page.getByRole("button", { name: "Conversation settings", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Private launch settings", exact: true });
  await dialog.locator("summary").filter({ hasText: "Add workspace members" }).click();
  await dialog.getByLabel("Find members").fill(peerName);
  await dialog.getByRole("checkbox", { name: peerName, exact: true }).check();
  await dialog.getByRole("button", { name: "Add selected members", exact: true }).click();
  await expect(dialog.getByText(peerName, { exact: true }).first()).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
  if (peer) {
    await peer.reload();
    await expect(
      peer.getByRole("heading", { name: "🔒 Private launch", exact: true }),
    ).toBeVisible();
  }
  await page.goto(root);
  await page.getByRole("button", { name: "New conversation", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "New conversation", exact: true });
  await dialog.getByLabel("Conversation name").fill("Direct launch");
  await dialog.getByLabel("Find members").fill(peerName);
  await dialog.getByRole("checkbox", { name: peerName, exact: true }).check();
  await dialog.getByRole("button", { name: "Create conversation", exact: true }).click();
  await expect(page.getByLabel("Message", { exact: true })).toBeVisible();
  await page.getByLabel("Message", { exact: true }).fill("Private DM hello");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page
      .getByRole("list", { name: "Messages", exact: true })
      .getByText("Private DM hello", { exact: true }),
  ).toBeVisible();
  const dmId = new URL(page.url()).pathname.split("/").at(-1)!;
  if (peer) {
    await peer.goto(`http://localhost:3010/w/${workspaceId}/messenger/${dmId}`);
    await expect(
      peer
        .getByRole("list", { name: "Messages", exact: true })
        .getByText("Private DM hello", { exact: true }),
    ).toBeVisible();
  }
}
