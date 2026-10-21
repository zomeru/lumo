import { expect, test } from "vitest";

import { localMeetingInstant, meetingState, zonedDateTime } from "./meeting-time";

test("converts IANA wall times across dates, leap days and fractional offsets", () => {
  expect(localMeetingInstant("2030-01-01T00:30", "Asia/Shanghai")).toBe("2029-12-31T16:30:00.000Z");
  expect(localMeetingInstant("2028-02-29T12:00", "Asia/Kathmandu")).toBe(
    "2028-02-29T06:15:00.000Z",
  );
  expect(zonedDateTime(new Date("2030-01-01T00:30Z"), "America/New_York")).toBe("2029-12-31T19:30");
  expect(() => localMeetingInstant("2030-02-29T12:00", "UTC")).toThrow("valid date");
  expect(() => localMeetingInstant("not-a-date", "UTC")).toThrow("valid date");
  expect(() => localMeetingInstant("2030-01-01T00:30", "Invalid/Zone")).toThrow(
    "Invalid time zone",
  );
});
test("rejects daylight saving gaps and ambiguities including half hour transitions", () => {
  expect(() => localMeetingInstant("2026-03-08T02:30", "America/New_York")).toThrow(
    "does not exist",
  );
  expect(() => localMeetingInstant("2026-11-01T01:30", "America/New_York")).toThrow("occurs twice");
  expect(() => localMeetingInstant("2026-10-04T02:15", "Australia/Lord_Howe")).toThrow(
    "does not exist",
  );
  expect(localMeetingInstant("2026-03-08T03:30", "America/New_York")).toBe(
    "2026-03-08T07:30:00.000Z",
  );
  expect(localMeetingInstant("2026-11-01T06:30", "UTC")).toBe("2026-11-01T06:30:00.000Z");
});
test("derives consistent meeting state without ending active provider rooms by the clock", () => {
  const meeting = { status: "scheduled", startsAt: "2030-01-01T12:00:00Z", durationMinutes: 60 };
  expect(meetingState(meeting, Date.parse("2030-01-01T11:00Z"))).toBe("Upcoming");
  expect(meetingState(meeting, Date.parse("2030-01-01T12:30Z"))).toBe("In progress");
  expect(meetingState(meeting, Date.parse("2030-01-01T13:00Z"))).toBe("Completed");
  expect(meetingState({ ...meeting, status: "active" })).toBe("In progress");
  expect(meetingState({ ...meeting, status: "ended" })).toBe("Completed");
  expect(meetingState({ ...meeting, status: "canceled" })).toBe("Canceled");
});
