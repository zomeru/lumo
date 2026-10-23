export const windowChannels = {
  minimize: "lumolynk:window:minimize",
  toggleMaximize: "lumolynk:window:toggle-maximize",
  close: "lumolynk:window:close",
  state: "lumolynk:window:state",
  stateChanged: "lumolynk:window:state-changed",
} as const;

export type WindowState = { maximized: boolean; fullscreen: boolean };
export type WindowApi = {
  platform: string;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  getState: () => Promise<WindowState>;
  onStateChanged: (listener: (state: WindowState) => void) => () => void;
};
