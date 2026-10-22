import { setTimeout as delay } from "node:timers/promises";

import type { BrowserContext } from "@playwright/test";

const minute = 60_100;
let registrationCount = 0;
let lastRegistration = 0;
/** Better Auth resets its signup counter after a quiet minute, not a rolling timestamp window. */
export async function reserveRegistration() {
  if (Date.now() - lastRegistration >= minute) registrationCount = 0;
  if (registrationCount >= 4) {
    // Allow for form submission just after reservation; keep the production five-signup cap intact.
    await delay(Math.max(0, lastRegistration + 62_000 - Date.now()));
    registrationCount = 0;
  }
  registrationCount++;
  lastRegistration = Date.now();
}

/** Pause between complete workflow sections, never during an assertion or in production code. */
export function apiBudgetCheckpoint(context: BrowserContext) {
  const requests: number[] = [];
  context.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/v1/")) requests.push(Date.now());
  });
  return async () => {
    while (requests.length && Date.now() - requests[0]! >= minute) requests.shift();
    // Leave ample room for shell polling, realtime reconciliation and the next workflow section.
    if (requests.length >= 150) await delay(Math.max(0, requests.at(-1)! + minute - Date.now()));
  };
}
