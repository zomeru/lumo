type DateValue = string | number | Date | null | undefined;
const months = [
  "Jan.",
  "Feb.",
  "Mar.",
  "Apr.",
  "May",
  "Jun.",
  "Jul.",
  "Aug.",
  "Sep.",
  "Oct.",
  "Nov.",
  "Dec.",
];
function parse(value: DateValue) {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    date.toISOString().slice(0, 10) !== value
  )
    return null;
  return date;
}
/** Calendar dates have no timezone; instants use the user's timezone by default. */
export function formatDate(value: DateValue, timeZone?: string): string {
  const date = parse(value);
  if (!date) return "—";
  const zone = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : timeZone;
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: zone,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)!.value;
  return `${months[Number(part("month")) - 1]} ${part("day")}, ${part("year")}`;
}
export function formatTime(value: DateValue, timeZone?: string): string {
  const date = parse(value);
  return date
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone,
      }).format(date)
    : "—";
}
export function formatDateTime(value: DateValue, timeZone?: string): string {
  return parse(value) ? `${formatDate(value, timeZone)}, ${formatTime(value, timeZone)}` : "—";
}
