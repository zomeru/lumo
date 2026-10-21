import { expect, test } from "vitest";

import { formatDate, formatDateTime, formatTime } from "./date-time";

test("formats calendar dates without moving them into the previous day", () => {
  expect(formatDate("2026-01-30", "America/Los_Angeles")).toBe("Jan. 30, 2026");
  expect(formatDate("2026-05-01")).toBe("May 1, 2026");
});
test("formats instants in the selected timezone with a twelve hour clock", () => {
  expect(formatDateTime("2026-01-30T14:30:00Z", "Asia/Shanghai")).toBe("Jan. 30, 2026, 10:30 PM");
  expect(formatDateTime("2026-01-30T02:30:00Z", "America/Los_Angeles")).toBe(
    "Jan. 29, 2026, 6:30 PM",
  );
  expect(formatTime(new Date("2026-01-30T00:00:00Z"), "UTC")).toBe("12:00 AM");
  expect(formatTime(Date.parse("2026-01-30T12:00:00Z"), "UTC")).toBe("12:00 PM");
});
test("does not fabricate unavailable or invalid dates", () => {
  for (const value of [null, undefined, "", "invalid"]) {
    expect(formatDate(value)).toBe("—");
    expect(formatDateTime(value)).toBe("—");
    expect(formatTime(value)).toBe("—");
  }
});
