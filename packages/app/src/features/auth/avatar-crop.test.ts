import { expect, test } from "vitest";

import { avatarCrop } from "./avatar-crop";
test("crop uses source coordinates and preserves the same bounds at every zoom", () => {
  expect(avatarCrop(800, 400, 1, 50, 50)).toEqual({ side: 400, left: 200, top: 0 });
  expect(avatarCrop(800, 400, 2, 100, 0)).toEqual({ side: 200, left: 600, top: 0 });
  expect(avatarCrop(400, 800, 2, 0, 100)).toEqual({ side: 200, left: 0, top: 600 });
  expect(avatarCrop(400, 400, 0, -1, 200)).toEqual({ side: 400, left: 0, top: 0 });
});
