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

// jsdom does not implement document scrolling.
window.scrollTo = () => {};

// Radix uses browser pointer capture and scrolling, which jsdom does not implement.
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};
HTMLElement.prototype.scrollIntoView = () => {};
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// CodeMirror measures text selections using Range geometry, absent in jsdom.
Range.prototype.getBoundingClientRect = () => new DOMRect();
Range.prototype.getClientRects = () => Object.assign([], { item: () => null });
