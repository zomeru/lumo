import { AppChromeProvider } from "@lumolynk/app/chrome";
import { Button } from "@lumolynk/ui";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { WindowApi, WindowState } from "../window-api";

import "./window-chrome.css";

function WindowControls({ api, state }: { api: WindowApi; state: WindowState }) {
  const maximizeLabel = state.maximized ? "Restore window" : "Maximize window";
  return (
    <fieldset className="desktop-window-controls" aria-label="Window controls">
      <Button
        variant="ghost"
        size="icon"
        title="Minimize window"
        aria-label="Minimize window"
        onClick={() => {
          void api.minimize().catch(console.error);
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M3 8h10" />
        </svg>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title={maximizeLabel}
        aria-label={maximizeLabel}
        disabled={state.fullscreen}
        onClick={() => {
          void api.toggleMaximize().catch(console.error);
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          {state.maximized ? <path d="M5 5V3h8v8h-2M3 5h8v8H3z" /> : <path d="M3 3h10v10H3z" />}
        </svg>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="desktop-window-close"
        title="Close window"
        aria-label="Close window"
        onClick={() => {
          void api.close().catch(console.error);
        }}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="m3 3 10 10M13 3 3 13" />
        </svg>
      </Button>
    </fieldset>
  );
}

export function DesktopChrome({ api, children }: { api: WindowApi; children: ReactNode }) {
  const [header, setHeader] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<WindowState>({ maximized: false, fullscreen: false });
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const unsubscribe = api.onStateChanged((next) => {
      receivedEvent = true;
      setState(next);
    });
    void api
      .getState()
      .then((initial) => {
        if (active && !receivedEvent) setState(initial);
      })
      .catch(console.error);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [api]);
  const controls = api.platform === "darwin" ? null : <WindowControls api={api} state={state} />;
  return (
    <div className="desktop-app" data-platform={api.platform} data-fullscreen={state.fullscreen}>
      {!header && (
        <header className="desktop-fallback" aria-label="Application window">
          {controls}
        </header>
      )}
      <div className="desktop-content">
        <AppChromeProvider headerRef={setHeader}>{children}</AppChromeProvider>
      </div>
      {header && createPortal(controls, header)}
    </div>
  );
}
