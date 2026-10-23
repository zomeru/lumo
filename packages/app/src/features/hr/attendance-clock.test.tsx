import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { AttendanceClock } from "./attendance-clock";

afterEach(() => vi.useRealTimers());

test("shows user-local time and advances across midnight without another API response", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-23T15:59:00Z"));
  const { rerender, unmount } = render(
    <AttendanceClock
      serverTime="2026-10-23T15:59:00Z"
      updatedAt={Date.now()}
      timezone="Asia/Shanghai"
    />,
  );
  expect(screen.getByLabelText("Current time")).toHaveTextContent("11:59 PM");
  expect(screen.getByText("Oct. 23, 2026")).toBeVisible();
  await act(() => vi.advanceTimersByTime(60000));
  expect(screen.getByLabelText("Current time")).toHaveTextContent("12:00 AM");
  expect(screen.getByText("Oct. 24, 2026")).toBeVisible();
  rerender(
    <AttendanceClock
      serverTime="2026-10-23T16:00:00Z"
      updatedAt={Date.now()}
      timezone="America/Los_Angeles"
    />,
  );
  expect(screen.getByLabelText("Current time")).toHaveTextContent("9:00 AM");
  expect(screen.getByText("Oct. 23, 2026")).toBeVisible();
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test("waits for the server clock and resynchronizes when attendance data refreshes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-23T06:00:00Z"));
  const { rerender } = render(<AttendanceClock updatedAt={0} timezone="Asia/Shanghai" />);
  expect(screen.getByLabelText("Current time")).toHaveTextContent("—");
  rerender(
    <AttendanceClock
      serverTime="2026-10-23T07:00:00Z"
      updatedAt={Date.now()}
      timezone="Asia/Shanghai"
    />,
  );
  expect(screen.getByLabelText("Current time")).toHaveTextContent("3:00 PM");
  await act(() => vi.advanceTimersByTime(60000));
  expect(screen.getByLabelText("Current time")).toHaveTextContent("3:01 PM");
  rerender(
    <AttendanceClock
      serverTime="2026-10-23T07:03:00Z"
      updatedAt={Date.now()}
      timezone="Asia/Shanghai"
    />,
  );
  expect(screen.getByLabelText("Current time")).toHaveTextContent("3:03 PM");
});
