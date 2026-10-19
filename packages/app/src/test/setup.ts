import assert from "node:assert/strict";

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  try {
    // Expected error-boundary diagnostics must be asserted and cleared by their test.
    assert.deepEqual(vi.mocked(console.error).mock.calls, [], "Unexpected console.error in test");
    assert.deepEqual(vi.mocked(console.warn).mock.calls, [], "Unexpected console.warn in test");
  } finally {
    vi.mocked(console.error).mockRestore();
    vi.mocked(console.warn).mockRestore();
  }
});

// jsdom does not implement scrolling or the native dialog lifecycle.
window.scrollTo = () => {};
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
