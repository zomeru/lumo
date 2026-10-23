import type { Transport } from "@lumolynk/api-client";
export type AppPlatform = {
  kind: "web" | "desktop";
  webOrigin: string;
  transport: Transport;
  openAttachment?: (path: string) => Promise<void>;
  download?: (path: string, body: unknown) => Promise<void>;
};
let platform: AppPlatform | undefined;
export function configurePlatform(value: AppPlatform | undefined) {
  platform = value;
}
export function getPlatform() {
  return platform;
}
