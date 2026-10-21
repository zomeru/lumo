/** Meeting state is shared by Calendar and Meetings; active rooms end when the host ends them. */
export function meetingState(
  item: { status: string; startsAt: string | null; durationMinutes: number },
  now = Date.now(),
) {
  if (item.status === "canceled") return "Canceled";
  if (item.status === "ended") return "Completed";
  if (item.status === "active") return "In progress";
  const start = Date.parse(item.startsAt!);
  if (start + item.durationMinutes * 60000 <= now) return "Completed";
  return start <= now ? "In progress" : "Upcoming";
}

/** An HTML datetime-local value for a particular IANA timezone, independent of host timezone. */
export function zonedDateTime(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** Reject DST gaps and repeated wall times instead of silently moving an intended appointment. */
export function localMeetingInstant(local: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new Error("Enter a valid date and time.");
  const wall = Date.parse(local + "Z");
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== local)
    throw new Error("Enter a valid date and time.");
  const candidates = new Set<number>();
  // Nearby samples cover the offsets on both sides of timezone transitions, including half hours.
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = wall + hours * 3600000;
    const offset = Date.parse(zonedDateTime(new Date(sample), timeZone) + "Z") - sample;
    const candidate = wall - offset;
    if (zonedDateTime(new Date(candidate), timeZone) === local) candidates.add(candidate);
  }
  if (candidates.size === 0)
    throw new Error(
      "This local time does not exist because of a timezone change. Choose another time.",
    );
  if (candidates.size > 1)
    throw new Error(
      "This local time occurs twice because of daylight saving. Use UTC to select the intended instant.",
    );
  return new Date([...candidates][0]!).toISOString();
}
