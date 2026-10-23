// @vitest-environment jsdom
import { AppHeader } from "@lumolynk/app/chrome";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import type { WindowApi, WindowState } from "../window-api";
import { DesktopChrome } from "./window-chrome";

afterEach(cleanup);

function bridge(platform = "linux") {
  const listeners = new Set<(state: WindowState) => void>();
  const api = {
    platform,
    minimize: vi.fn<WindowApi["minimize"]>().mockResolvedValue(undefined),
    toggleMaximize: vi.fn<WindowApi["toggleMaximize"]>().mockResolvedValue(undefined),
    close: vi.fn<WindowApi["close"]>().mockResolvedValue(undefined),
    getState: vi
      .fn<WindowApi["getState"]>()
      .mockResolvedValue({ maximized: false, fullscreen: false }),
    onStateChanged: (listener: (state: WindowState) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  } satisfies WindowApi;
  const publish = (state: WindowState) =>
    act(() => {
      for (const listener of listeners) listener(state);
    });
  return { api, listeners, publish };
}

test("composes controls into the active header and keeps them available without a header", async () => {
  const { api, listeners } = bridge();
  const view = render(
    <DesktopChrome api={api}>
      <AppHeader>
        <button type="button">Navigation</button>
      </AppHeader>
    </DesktopChrome>,
  );
  await act(async () => {});
  const minimize = screen.getByRole("button", { name: "Minimize window" });
  expect(minimize.closest("[data-app-header]")).not.toBeNull();
  expect(screen.queryByRole("banner", { name: "Application window" })).toBeNull();
  fireEvent.click(minimize);
  expect(api.minimize).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Maximize window" }));
  expect(api.toggleMaximize).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Close window" }));
  expect(api.close).toHaveBeenCalledOnce();
  view.rerender(
    <DesktopChrome api={api}>
      <main>Standalone page</main>
    </DesktopChrome>,
  );
  expect(screen.getByRole("banner", { name: "Application window" })).not.toBeNull();
  expect(screen.getAllByRole("group", { name: "Window controls" })).toHaveLength(1);
  view.unmount();
  expect(listeners.size).toBe(0);
});

test("restores the initial maximized icon and follows native maximize/fullscreen changes", async () => {
  const { api, publish } = bridge();
  api.getState.mockResolvedValue({ maximized: true, fullscreen: false });
  const view = render(
    <DesktopChrome api={api}>
      <main>Page</main>
    </DesktopChrome>,
  );
  const restore = await screen.findByRole("button", { name: "Restore window" });
  expect(restore.getAttribute("title")).toBe("Restore window");
  const maximizedIcon = restore.querySelector("path")!.getAttribute("d");
  fireEvent.click(restore);
  expect(api.toggleMaximize).toHaveBeenCalledOnce();
  publish({ maximized: false, fullscreen: false });
  const maximize = screen.getByRole("button", { name: "Maximize window" });
  expect(maximize.querySelector("path")!.getAttribute("d")).not.toBe(maximizedIcon);
  publish({ maximized: false, fullscreen: true });
  expect((maximize as HTMLButtonElement).disabled).toBe(true);
  expect(view.container.querySelector(".desktop-app")!.getAttribute("data-fullscreen")).toBe(
    "true",
  );
  publish({ maximized: false, fullscreen: false });
  expect((maximize as HTMLButtonElement).disabled).toBe(false);
});

test("a native event takes precedence over a delayed initial snapshot", async () => {
  const { api, publish } = bridge();
  let resolve!: (state: WindowState) => void;
  api.getState.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  render(
    <DesktopChrome api={api}>
      <main>Page</main>
    </DesktopChrome>,
  );
  publish({ maximized: true, fullscreen: false });
  await act(async () => {
    resolve({ maximized: false, fullscreen: false });
  });
  expect(screen.getByRole("button", { name: "Restore window" })).not.toBeNull();
});

test("does not update a removed chrome from an outstanding state request", async () => {
  const { api, listeners } = bridge();
  let resolve!: (state: WindowState) => void;
  api.getState.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const view = render(
    <DesktopChrome api={api}>
      <main>Page</main>
    </DesktopChrome>,
  );
  view.unmount();
  await act(async () => {
    resolve({ maximized: true, fullscreen: false });
  });
  expect(listeners.size).toBe(0);
  expect(screen.queryByRole("group", { name: "Window controls" })).toBeNull();
});

test("macOS reserves native traffic lights without rendering duplicate controls", async () => {
  const { api } = bridge("darwin");
  const view = render(
    <DesktopChrome api={api}>
      <AppHeader>Header</AppHeader>
    </DesktopChrome>,
  );
  await act(async () => {});
  expect(view.container.querySelector("[data-platform=darwin]")).not.toBeNull();
  expect(screen.queryByRole("group", { name: "Window controls" })).toBeNull();
});
