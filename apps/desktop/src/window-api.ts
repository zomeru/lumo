export const windowChannels = {
  minimize: "lumo:window:minimize",
  toggleMaximize: "lumo:window:toggle-maximize",
  close: "lumo:window:close",
  state: "lumo:window:state",
  stateChanged: "lumo:window:state-changed",
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
