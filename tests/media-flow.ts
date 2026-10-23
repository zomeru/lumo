import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, type Page } from "@playwright/test";

// Two looping frames; tiny generated fixture with no external asset or image dependency.
function animatedGif() {
  const header = Buffer.from("47494638396102000200800000f472b638bdf8", "hex");
  const loop = Buffer.from("21ff0b4e45545343415045322e300301000000", "hex");
  const frames = [0, 1].map((color) => {
    const codes = [4, color, 4, color, 4, color, 4, color, 5];
    let value = 0,
      bits = 0;
    const data: number[] = [];
    for (const code of codes) {
      value |= code << bits;
      bits += 3;
      while (bits >= 8) {
        data.push(value & 255);
        value >>= 8;
        bits -= 8;
      }
    }
    if (bits) data.push(value);
    return Buffer.concat([
      Buffer.from("21f904001e0000002c00000000020002000002", "hex"),
      Buffer.from([data.length, ...data, 0]),
    ]);
  });
  return Buffer.concat([header, loop, ...frames, Buffer.from([0x3b])]);
}
/** Real uploads/playback through private storage on Web, mobile and the packaged protocol. */
export async function verifyMedia(
  page: Page,
  screenshot: (name: string) => string,
  verifyNativeDownload?: (file: { name: string; buffer: Buffer }) => Promise<void>,
) {
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  const recordVideo = (mimeType: string) =>
    page.evaluate(async (mimeType) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext("2d")!;
      const stream = canvas.captureStream(12),
        chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType });
      const interval = setInterval(() => {
        ctx.fillStyle = "#2563eb";
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = "white";
        ctx.font = "24px sans-serif";
        ctx.fillText(`LumoLynk ${Date.now() % 10000}`, 30, 95);
      }, 70);
      recorder.ondataavailable = (event) => chunks.push(event.data);
      const completed = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.start();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      recorder.stop();
      await completed;
      clearInterval(interval);
      stream.getTracks().forEach((track) => track.stop());
      return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
    }, mimeType);
  const webm = await recordVideo("video/webm;codecs=vp8"),
    mp4 = await recordVideo("video/mp4;codecs=avc1.42001E");
  const files = [
    {
      name: "LumoLynk-photo.png",
      mimeType: "image/png",
      buffer: await readFile(resolve("packages/ui/src/assets/lumolynk-logo.png")),
    },
    { name: "LumoLynk-animation.gif", mimeType: "image/gif", buffer: animatedGif() },
    { name: "LumoLynk-clip.webm", mimeType: "video/webm", buffer: Buffer.from(webm) },
    { name: "LumoLynk-clip.mp4", mimeType: "video/mp4", buffer: Buffer.from(mp4) },
    {
      name: "LumoLynk-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Private Messenger media validation"),
    },
  ];
  const verifyDownload = async (
    file: { name: string; buffer: Buffer },
    action: () => Promise<void>,
  ) => {
    if (verifyNativeDownload) {
      await action();
      await verifyNativeDownload(file);
    } else {
      const downloadEvent = page.waitForEvent("download");
      await action();
      const download = await downloadEvent;
      expect(download.suggestedFilename()).toBe(file.name);
      await download.saveAs(screenshot(file.name));
      expect(await download.failure()).toBeNull();
    }
  };
  await page.getByRole("button", { name: "Create channel", exact: true }).click();
  const create = page.getByRole("dialog", { name: "Create channel", exact: true });
  await create.getByLabel("Channel name").fill("Media validation");
  await create.getByRole("button", { name: "Create channel", exact: true }).click();
  for (const file of files) {
    await page.getByLabel("Choose attachment", { exact: true }).setInputFiles(file);
    await expect(
      page.getByRole("button", { name: `Remove ${file.name}`, exact: true }),
    ).toBeVisible({ timeout: 30000 });
  }
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const history = page.getByRole("list", { name: "Messages", exact: true });
  await expect(history.getByText("Unscanned file", { exact: true })).toHaveCount(5);
  for (const file of files.slice(0, 2)) {
    await history
      .getByRole("button", { name: `Preview ${file.name}`, exact: true })
      .scrollIntoViewIfNeeded();
    const image = history.getByAltText(`${file.name} thumbnail`, { exact: true });
    await expect
      .poll(() => image.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  }
  for (const file of files.filter((file) => file.mimeType.startsWith("video/"))) {
    const thumbnail = history.getByRole("button", { name: `Preview ${file.name}`, exact: true });
    await thumbnail.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        thumbnail.locator("video").evaluate((video: HTMLVideoElement) => video.readyState),
      )
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(() =>
        thumbnail.locator("video").evaluate((video: HTMLVideoElement) => video.videoWidth),
      )
      .toBeGreaterThan(0);
  }
  await expect(history.getByText("Text file · 34 B", { exact: true })).toBeVisible();
  await expect(
    history.getByRole("button", { name: "Preview LumoLynk-notes.txt", exact: true }),
  ).toHaveCount(0);
  const trigger = history.getByRole("button", { name: "Preview LumoLynk-photo.png", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  for (const theme of ["light", "dark"]) {
    // The product theme is changed through its own appearance menu outside the modal.
    await expect(dialog).toHaveAccessibleName("LumoLynk-photo.png");
    await expect
      .poll(() =>
        dialog
          .getByAltText("LumoLynk-photo.png", { exact: true })
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    const bounds = await dialog.boundingBox();
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await page.screenshot({ path: screenshot(`gallery-${theme}.png`) });
    if (theme === "light")
      await verifyDownload(files[0]!, () =>
        dialog.getByRole("button", { name: "Download", exact: true }).click(),
      );
    await dialog.getByRole("button", { name: "Next attachment", exact: true }).click();
    await expect(dialog).toHaveAccessibleName("LumoLynk-animation.gif");
    await expect
      .poll(() =>
        dialog
          .getByAltText("LumoLynk-animation.gif", { exact: true })
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBe(2);
    for (const clip of ["LumoLynk-clip.webm", "LumoLynk-clip.mp4"]) {
      await dialog.getByRole("button", { name: "Next attachment", exact: true }).click();
      await expect(dialog).toHaveAccessibleName(clip);
      const player = dialog.getByLabel(`Video: ${clip}`, { exact: true });
      await expect
        .poll(() => player.evaluate((video: HTMLVideoElement) => video.readyState))
        .toBeGreaterThanOrEqual(2);
      await player.evaluate(async (video: HTMLVideoElement) => {
        video.currentTime = 0;
        await video.play();
      });
      await expect
        .poll(() => player.evaluate((video: HTMLVideoElement) => video.currentTime))
        .toBeGreaterThan(0.1);
      await page.screenshot({ path: screenshot(`${clip}-${theme}.png`) });
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    if (theme === "light") {
      await page.getByRole("button", { name: "Change appearance", exact: true }).click();
      await page.getByRole("menuitemcheckbox", { name: "Dark", exact: true }).click();
      await trigger.click();
    }
  }
  await verifyDownload(files.at(-1)!, () =>
    history.getByRole("button", { name: "LumoLynk-notes.txt · Download", exact: true }).click(),
  );
  await page.screenshot({ path: screenshot("attachments-dark.png") });
}
