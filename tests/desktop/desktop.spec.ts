import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  test,
  expect,
  _electron,
  type ElectronApplication,
  type Page,
  type Browser,
} from "@playwright/test";

const require = createRequire(import.meta.url);
const password = "Strong-desktop-password-2026!";
async function launch(dir: string, capture = false) {
  const executable = process.env.LUMO_PACKAGED_DESKTOP;
  const clientEnv = { ...process.env };
  for (const key of [
    "AGORA_APP_CERTIFICATE",
    "BETTER_AUTH_SECRET",
    "DATABASE_URL",
    "TEST_DATABASE_URL",
    "SMTP_URL",
  ])
    delete clientEnv[key];
  const args = [
    `--user-data-dir=${dir}`,
    ...(process.env.LUMO_LIVE_AGORA === "1" && !capture
      ? ["--use-fake-device-for-media-stream"]
      : []),
    ...(capture ? ["--disable-gpu", "--disable-dev-shm-usage"] : []),
  ];
  return _electron.launch({
    ...(executable
      ? { executablePath: resolve(executable), args }
      : {
          executablePath: require("electron") as string,
          args: [resolve("apps/desktop/out/main/index.js"), ...args],
        }),
    env: {
      ...clientEnv,
      DESKTOP_API_URL: "http://localhost:3011",
      DESKTOP_WEB_ORIGIN: "http://localhost:3010",
    },
    timeout: 30000,
  });
}
async function register(page: Page, name: string, email: string) {
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/w\/[a-f0-9-]+/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Make yourself at home/ }),
  ).toBeVisible();
}
async function login(page: Page, email: string) {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/w\/[a-f0-9-]+/);
  await expect(
    page.getByRole("heading", { level: 1, name: /Make yourself at home/ }),
  ).toBeVisible();
}
test("frameless chrome, menu removal, drag regions and web isolation", async ({ page: web }) => {
  const dir = await mkdtemp(join(tmpdir(), "lumo-window-e2e-"));
  const app = await launch(dir);
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Sign in to Lumo" })).toBeVisible();
    const platform = await app.evaluate(() => process.platform);
    const native = await app.evaluate(({ BrowserWindow, Menu }) => {
      const window = BrowserWindow.getAllWindows()[0]!;
      return {
        menu: Menu.getApplicationMenu(),
        resizable: window.isResizable(),
        maximizable: window.isMaximizable(),
        minimizable: window.isMinimizable(),
        minimum: window.getMinimumSize(),
        bounds: window.getBounds(),
        content: window.getContentBounds(),
      };
    });
    expect(native.menu).toBeNull();
    expect(native.resizable).toBe(true);
    expect(native.maximizable).toBe(true);
    expect(native.minimizable).toBe(true);
    expect(native.minimum).toEqual([600, 540]);
    if (platform !== "darwin") {
      expect(native.bounds.height).toBe(native.content.height);
      expect(native.bounds.width).toBe(native.content.width);
      await expect(page.getByRole("group", { name: "Window controls" })).toBeVisible();
      await page.keyboard.press("Alt");
      expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu())).toBeNull();
      const close = page.getByRole("button", { name: "Close window", exact: true });
      await close.hover();
      await expect(close).toHaveCSS("background-color", "rgb(196, 43, 28)");
      const controls = await page.getByRole("group", { name: "Window controls" }).boundingBox();
      const theme = await page.getByRole("button", { name: "Change appearance" }).boundingBox();
      expect(controls!.y).toBe(0);
      expect(controls!.x).toBeGreaterThanOrEqual(theme!.x + theme!.width);
      await expect(page.locator("[data-app-header]")).toHaveCSS("app-region", "drag");
      await expect(close).toHaveCSS("app-region", "no-drag");
      await expect(page.getByRole("button", { name: "Change appearance" })).toHaveCSS(
        "app-region",
        "no-drag",
      );
      await page.getByRole("button", { name: "Change appearance" }).click();
      await expect(page.getByRole("menuitemcheckbox", { name: "Dark" })).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      await expect(page.getByRole("group", { name: "Window controls" })).toHaveCount(0);
    }
    const window = await app.browserWindow(page);
    await window.evaluate((win) => win.setSize(600, 540));
    await expect.poll(() => window.evaluate((win) => win.getSize())).toEqual([600, 540]);
    await page.getByLabel("Email address").fill("window@example.com");
    await expect(page.getByLabel("Email address")).toHaveValue("window@example.com");
    await page.goto(new URL("/about", page.url()).href);
    await expect(page.getByRole("heading", { name: "About Lumo" })).toBeVisible();
    await expect(page.getByRole("banner", { name: "Application window" })).toBeVisible();
    await page.goto(new URL("/does-not-exist", page.url()).href);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    if (platform !== "darwin") {
      await expect(page.getByRole("button", { name: "Close window", exact: true })).toBeVisible();
      const closed = page.waitForEvent("close");
      await page.getByRole("button", { name: "Close window", exact: true }).click();
      await closed;
    }
    await web.goto("/login");
    await expect(web.getByRole("heading", { name: "Sign in to Lumo" })).toBeVisible();
    await expect(web.getByRole("group", { name: "Window controls" })).toHaveCount(0);
    await expect(web.locator(".desktop-app")).toHaveCount(0);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("native window controls synchronize maximize, restore and fullscreen", async () => {
  test.skip(
    process.platform === "linux" && process.env.LUMO_NATIVE_WINDOW_TESTS !== "1",
    "Requires a Linux window manager; plain Xvfb cannot process native window states. Set LUMO_NATIVE_WINDOW_TESTS=1 on a managed display.",
  );
  test.skip(process.platform === "darwin", "macOS uses native traffic lights.");
  const dir = await mkdtemp(join(tmpdir(), "lumo-native-window-e2e-"));
  const app = await launch(dir);
  try {
    const page = await app.firstWindow();
    const window = await app.browserWindow(page);
    await page.getByRole("button", { name: "Maximize window", exact: true }).click();
    await expect.poll(() => window.evaluate((win) => win.isMaximized())).toBe(true);
    const restore = page.getByRole("button", { name: "Restore window", exact: true });
    await expect(restore).toBeVisible();
    const maximizedIcon = await restore.locator("svg").innerHTML();
    await restore.click();
    await expect.poll(() => window.evaluate((win) => win.isMaximized())).toBe(false);
    await expect(page.getByRole("button", { name: "Maximize window", exact: true })).toBeVisible();
    expect(
      await page
        .getByRole("button", { name: "Maximize window", exact: true })
        .locator("svg")
        .innerHTML(),
    ).not.toBe(maximizedIcon);
    // OS-driven state changes must update the renderer too, including after reload.
    await window.evaluate((win) => win.maximize());
    await expect(restore).toBeVisible();
    await page.reload();
    await expect(restore).toBeVisible();
    await window.evaluate((win) => win.unmaximize());
    await expect(page.getByRole("button", { name: "Maximize window", exact: true })).toBeVisible();
    await window.evaluate((win) => win.setFullScreen(true));
    await expect(page.locator(".desktop-app")).toHaveAttribute("data-fullscreen", "true");
    await window.evaluate((win) => win.setFullScreen(false));
    await expect(page.locator(".desktop-app")).toHaveAttribute("data-fullscreen", "false");
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("native minimize control works when the window manager supports minimization", async () => {
  test.skip(
    process.platform === "linux" && process.env.LUMO_NATIVE_WINDOW_TESTS !== "1",
    "Requires a managed display with LUMO_NATIVE_WINDOW_TESTS=1.",
  );
  test.skip(process.platform === "darwin", "macOS uses native traffic lights.");
  const dir = await mkdtemp(join(tmpdir(), "lumo-minimize-e2e-"));
  const app = await launch(dir);
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole("button", { name: "Minimize window", exact: true })).toBeVisible();
    const window = await app.browserWindow(page);
    // Probe Electron directly first: some compositors (including WSLg) ignore minimization.
    await window.evaluate((win) => win.minimize());
    let supported = false;
    try {
      await expect
        .poll(() => window.evaluate((win) => win.isMinimized()), { timeout: 2000 })
        .toBe(true);
      supported = true;
    } catch {
      /* Host does not implement the native operation. */
    }
    test.skip(!supported, "The compositor ignores Electron's native minimize API.");
    await window.evaluate((win) => win.restore());
    await expect.poll(() => window.evaluate((win) => win.isMinimized())).toBe(false);
    await page.getByRole("button", { name: "Minimize window", exact: true }).click();
    await expect.poll(() => window.evaluate((win) => win.isMinimized())).toBe(true);
    await window.evaluate((win) => win.restore());
    await expect.poll(() => window.evaluate((win) => win.isMinimized())).toBe(false);
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("desktop login, real API, workspace parity, logout, restart and sandbox boundaries", async () => {
  const testInfo = test.info();
  const dir = await mkdtemp(join(tmpdir(), "lumo-desktop-e2e-"));
  let app: ElectronApplication | undefined;
  try {
    app = await launch(dir);
    let page = await app.firstWindow();
    await expect(page.getByRole("heading", { name: "Sign in to Lumo" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("desktop-login.png") });
    const globals = await page.evaluate(() => {
      const renderer = window as unknown as {
        require?: unknown;
        process?: { versions?: { node?: unknown }; getBuiltinModule?: unknown };
      };
      return {
        require: typeof renderer.require,
        process: typeof renderer.process,
        nodeVersion: typeof renderer.process?.versions?.node,
        getBuiltinModule: typeof renderer.process?.getBuiltinModule,
      };
    });
    // Vite dependencies may inject a browser process shim; Node must remain unavailable.
    expect(globals.require).toBe("undefined");
    expect(globals.nodeVersion).toBe("undefined");
    expect(globals.getBuiltinModule).toBe("undefined");
    if (process.env.LUMO_PACKAGED_DESKTOP || !process.env.ELECTRON_RENDERER_URL)
      expect(globals.process).toBe("undefined");
    const preferences = await app.evaluate(({ BrowserWindow }) => {
      const settings = (
        BrowserWindow.getAllWindows()[0]!.webContents as unknown as {
          getLastWebPreferences: () => {
            nodeIntegration: boolean;
            contextIsolation: boolean;
            sandbox: boolean;
          };
        }
      ).getLastWebPreferences();
      return {
        nodeIntegration: settings.nodeIntegration,
        contextIsolation: settings.contextIsolation,
        sandbox: settings.sandbox,
      };
    });
    expect(preferences).toEqual({ nodeIntegration: false, contextIsolation: true, sandbox: true });
    const email = `desktop-${Date.now()}@example.com`;
    await register(page, "Desktop User", email);
    await expect(
      page.getByRole("heading", { name: "Make yourself at home, Desktop" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Change appearance" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("combobox", { name: "Workspace", exact: true }).click();
    const choices = page.getByRole("listbox");
    await expect(choices).toBeVisible();
    const box = await choices.boundingBox();
    expect(box && box.width > 150 && box.x >= 0).toBe(true);
    await page.keyboard.press("Escape");
    await page.screenshot({ path: testInfo.outputPath("desktop-home-dark.png") });
    await page.getByRole("link", { name: /Messenger/ }).click();
    await page.getByRole("button", { name: "New conversation" }).click();
    const dialog = page.getByRole("dialog", { name: "New conversation" });
    await dialog.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Private group" }).click();
    await expect(dialog.getByRole("combobox", { name: "Type" })).toHaveText("Private group");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await page.getByRole("link", { name: /Contacts/ }).click();
    await expect(page.getByRole("heading", { name: "Contacts", exact: true })).toBeVisible();
    await page.getByRole("link", { name: /Meetings/ }).click();
    await page.getByLabel("Meeting title").fill("Desktop planning");
    await page.getByRole("button", { name: "Create meeting" }).click();
    await expect(page.getByRole("link", { name: "Open Desktop planning" })).toBeVisible();
    await app.close();
    app = await launch(dir);
    page = await app.firstWindow();
    // OS-protected cookie persistence is tested only when safeStorage is available; Linux basic_text uses memory.
    const protectedStore = await app.evaluate(
      ({ safeStorage }) =>
        safeStorage.isEncryptionAvailable() &&
        (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text"),
    );
    if (protectedStore)
      await expect(
        page.getByRole("heading", { name: "Make yourself at home, Desktop" }),
      ).toBeVisible();
    else {
      await expect(page.getByRole("heading", { name: "Sign in to Lumo" })).toBeVisible();
      await login(page, email);
    }
    await page.getByRole("link", { name: /Your profile/ }).click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in to Lumo" })).toBeVisible();
    const result = await page.evaluate(async () => {
      try {
        await (
          window as unknown as { lumo: { request: (path: string) => Promise<unknown> } }
        ).lumo.request("https://evil.test/api/v1/me");
        return "allowed";
      } catch {
        return "denied";
      }
    });
    expect(result).toBe("denied");
  } finally {
    await app?.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("live Agora sends messages from browser to desktop and back", async ({ browser }) => {
  test.skip(
    process.env.LUMO_LIVE_AGORA !== "1",
    "Requires explicit live Agora opt-in and server configuration.",
  );
  const dir = await mkdtemp(join(tmpdir(), "lumo-chat-e2e-"));
  const app = await launch(dir);
  const webContext = await browser.newContext({ baseURL: "http://localhost:3010" });
  const web = await webContext.newPage();
  const desktop = await app.firstWindow();
  try {
    const email = `chat-${Date.now()}@example.com`;
    await register(desktop, "Chat Tester", email);
    const workspaceId = new URL(desktop.url()).pathname.split("/")[2]!;
    await web.goto("/login");
    await login(web, email);
    // Same authenticated account on two devices exercises provider multi-device delivery without broadening membership.
    await desktop.getByRole("link", { name: /Messenger/ }).click();
    await expect(desktop.getByRole("heading", { name: "Messenger", exact: true })).toBeVisible();
    // A second authorized participant is created through real registration and public joining.
    const colleagueContext = await browser.newContext({ baseURL: "http://localhost:3010" });
    const other = await colleagueContext.newPage();
    await other.goto("/register");
    await other.getByLabel("Full name").fill("Colleague");
    await other.getByLabel("Email address").fill(`colleague-${Date.now()}@example.com`);
    await other.getByLabel("Password", { exact: true }).fill(password);
    await other.getByRole("button", { name: "Create account" }).click();
    await expect(other).toHaveURL(/\/w\//);
    // Personal workspace cannot become public; create a real public team through the authenticated browser API.
    const teamResponse = await web.request.post("http://localhost:3011/api/v1/workspaces", {
      headers: { origin: "http://localhost:3010" },
      data: { name: "Chat interoperability", visibility: "public" },
    });
    expect(teamResponse.ok()).toBe(true);
    const team = (await teamResponse.json()) as { id: string };
    const join = await other.request.post(
      `http://localhost:3011/api/v1/workspaces/${team.id}/join`,
      { headers: { origin: "http://localhost:3010" }, data: {} },
    );
    expect(join.ok()).toBe(true);
    await desktop.goto(`lumo://app/w/${team.id}/contacts`);
    await desktop.getByRole("button", { name: "Message Colleague" }).click();
    await expect(desktop).toHaveURL(/\/messenger\/[a-f0-9-]+$/);
    const conversationId = new URL(desktop.url()).pathname.split("/").at(-1)!;
    await other.goto(`/w/${team.id}/messenger/${conversationId}`);
    await expect(other.getByText("Connected", { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(desktop.getByText("Connected", { exact: true })).toBeVisible({ timeout: 30000 });
    await desktop.getByLabel("Message", { exact: true }).fill("Hello from desktop");
    await desktop.getByRole("button", { name: "Send message" }).click();
    await expect(other.getByText("Hello from desktop", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await other.getByLabel("Message", { exact: true }).fill("Hello from web");
    await other.getByRole("button", { name: "Send message" }).click();
    await expect(desktop.getByText("Hello from web", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await other.reload();
    await expect(other.getByText("Hello from desktop", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(other.getByText("Hello from web", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    const colleague = (await (
      await other.request.get("http://localhost:3011/api/v1/me")
    ).json()) as { user: { id: string } };
    const createdGroup = await web.request.post(
      `http://localhost:3011/api/v1/workspaces/${team.id}/conversations`,
      {
        headers: { origin: "http://localhost:3010" },
        data: { kind: "group", name: "Project group", memberIds: [colleague.user.id] },
      },
    );
    expect(createdGroup.ok()).toBe(true);
    const group = (await createdGroup.json()) as { id: string };
    await desktop.goto(`lumo://app/w/${team.id}/messenger/${group.id}`);
    await other.goto(`/w/${team.id}/messenger/${group.id}`);
    await expect(desktop.getByText("Connected", { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(other.getByText("Connected", { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(desktop.getByText("Hello from desktop", { exact: true })).toHaveCount(0);
    await other.getByLabel("Message", { exact: true }).fill("Hello private group");
    await other.getByRole("button", { name: "Send message" }).click();
    await expect(desktop.getByText("Hello private group", { exact: true })).toBeVisible({
      timeout: 30000,
    });
    expect(workspaceId).toBeTruthy();
    await colleagueContext.close();
  } finally {
    await webContext.close();
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

async function liveMeeting(browser: Browser, screenCapture: boolean) {
  test.skip(
    process.env.LUMO_LIVE_AGORA !== "1",
    "Requires explicit live Agora opt-in. Uses synthetic media, not physical devices.",
  );
  const dir = await mkdtemp(join(tmpdir(), "lumo-rtc-e2e-"));
  const app = await launch(dir, screenCapture);
  const context = await browser.newContext({ baseURL: "http://localhost:3010" });
  try {
    // Simulate a user's approval of the real native permission/source dialogs.
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false });
    });
    const desktop = await app.firstWindow();
    const email = `rtc-${Date.now()}@example.com`;
    await register(desktop, "RTC Tester", email);
    const workspaceId = new URL(desktop.url()).pathname.split("/")[2]!;
    const web = await context.newPage();
    await web.goto("/login");
    await login(web, email);
    const response = await web.request.post(
      `http://localhost:3011/api/v1/workspaces/${workspaceId}/meetings`,
      {
        headers: { origin: "http://localhost:3010" },
        data: { title: "Live interoperability", access: "open" },
      },
    );
    expect(response.ok()).toBe(true);
    const meeting = (await response.json()) as { id: string };
    await desktop.goto(`lumo://app/meetings/${meeting.id}`);
    await desktop.getByRole("button", { name: "Join meeting", exact: true }).click();
    await expect(desktop.getByRole("button", { name: "Leave meeting", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await web.goto("/profile");
    await web.getByRole("button", { name: "Sign out", exact: true }).click();
    await register(web, "RTC Guest", `rtc-guest-${Date.now()}@example.com`);
    await web.goto(`/meetings/${meeting.id}`);
    await web.getByRole("button", { name: "Join meeting", exact: true }).click();
    await expect(web.getByRole("button", { name: "Leave meeting", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await web.getByRole("button", { name: "Turn camera on", exact: true }).click();
    await expect(web.getByRole("button", { name: "Turn camera off", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(desktop.locator("[data-remote-videos] video")).toHaveCount(1, { timeout: 30000 });
    if (!screenCapture) {
      await desktop.getByRole("button", { name: "Turn camera on", exact: true }).click();
      await expect(
        desktop.getByRole("button", { name: "Turn camera off", exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await expect(web.locator("[data-remote-videos] video")).toHaveCount(1, { timeout: 30000 });
      await desktop.getByRole("button", { name: "Unmute microphone", exact: true }).click();
      await expect(
        desktop.getByRole("button", { name: "Mute microphone", exact: true }),
      ).toBeVisible();
      await desktop.getByRole("button", { name: "Mute microphone", exact: true }).click();
    }
    if (screenCapture) {
      const sources = await app.evaluate(
        async ({ desktopCapturer }) =>
          (await desktopCapturer.getSources({ types: ["screen", "window"] })).length,
      );
      test.skip(
        sources === 0,
        "This graphical host reports no native capture sources. Physical target-machine validation remains required.",
      );
      await desktop.getByRole("button", { name: "Share screen", exact: true }).click();
      await expect(desktop.getByRole("button", { name: "Stop sharing", exact: true })).toBeVisible({
        timeout: 30000,
      });
      await expect(web.locator("[data-remote-videos] video")).toHaveCount(1, { timeout: 30000 });
      await desktop.getByRole("button", { name: "Stop sharing", exact: true }).click();
      await expect(web.locator("[data-remote-videos] video")).toHaveCount(0, { timeout: 30000 });
    }
    await desktop.getByRole("button", { name: "End meeting for everyone", exact: true }).click();
    await expect(desktop.getByRole("button", { name: "Join meeting", exact: true })).toHaveCount(0);
    await expect(web.getByRole("button", { name: "Leave meeting", exact: true })).toHaveCount(0, {
      timeout: 15000,
    });
  } finally {
    await context.close();
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}
test("live RTC joins web and desktop, publishes synthetic camera, controls microphone and ends", async ({
  browser,
}) => {
  await liveMeeting(browser, false);
});
test("live native screen capture publishes a second track and stops it", async ({ browser }) => {
  test.skip(
    process.env.LUMO_LIVE_SCREEN_CAPTURE !== "1",
    "Requires explicit native capture opt-in and a supported graphical capture host.",
  );
  await liveMeeting(browser, true);
});
