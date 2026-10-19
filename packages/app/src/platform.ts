import type { Transport } from "@lumo/api-client";
export type AppPlatform = { kind: "web" | "desktop"; webOrigin: string; transport: Transport };
let platform: AppPlatform | undefined;
export function configurePlatform(value: AppPlatform | undefined) {
  platform = value;
}
export function getPlatform() {
  return platform;
}
