import { expect, test } from "vitest";

import { themes } from "./tokens";

function luminance(hex: string) {
  const linear = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}
function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
test("both themes define the same semantic roles with readable text and input boundaries", () => {
  expect(Object.keys(themes.light).sort()).toEqual(Object.keys(themes.dark).sort());
  for (const [name, theme] of Object.entries(themes)) {
    for (const [foreground, background] of [
      [theme.foreground, theme.background],
      [theme.foreground, theme.surface],
      [theme["muted-foreground"], theme.surface],
      [theme["muted-foreground"], theme.sidebar],
      [theme["primary-foreground"], theme.primary],
      [theme["accent-foreground"], theme.accent],
      [theme.destructive, theme["destructive-subtle"]],
      [theme.success, theme["success-subtle"]],
    ])
      expect(
        contrast(foreground!, background!),
        `${name}: ${foreground} on ${background}`,
      ).toBeGreaterThanOrEqual(4.5);
    expect(contrast(theme.input, theme.surface), `${name} input boundary`).toBeGreaterThanOrEqual(
      3,
    );
  }
});
