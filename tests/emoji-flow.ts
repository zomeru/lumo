import { expect, type Page } from "@playwright/test";

/** Inspect Chromium's actual selected glyph fonts, not just a computed CSS family list. */
export async function verifyEmojiFonts(page: Page) {
  await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.id = "lumo-font-verification";
    probe.style.cssText =
      "position:fixed;top:80px;left:20px;background:var(--surface);padding:12px;z-index:99999;font-size:24px";
    for (const [id, text] of [
      ["digits", "0123456789"],
      ["emoji", "😀👍🎉☕❤️🇵🇭👩🏽‍💻1️⃣"],
    ]) {
      const span = document.createElement("span");
      span.id = `lumo-font-${id}`;
      span.textContent = text!;
      probe.append(span);
    }
    document.body.append(probe);
  });
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    const { root } = await cdp.send("DOM.getDocument");
    for (const kind of ["digits", "emoji"]) {
      const { nodeId } = await cdp.send("DOM.querySelector", {
        nodeId: root.nodeId,
        selector: `#lumo-font-${kind}`,
      });
      const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.every((font) => /emoji/i.test(font.familyName) === (kind === "emoji"))).toBe(
        true,
      );
    }
  } finally {
    await cdp.detach();
    await page.evaluate(() => document.getElementById("lumo-font-verification")?.remove());
  }
}
