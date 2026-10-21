export type CalendarView = "month" | "week" | "day";
export const addDays = (date: Date, amount: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};
export function calendarDays(date: Date, view: CalendarView) {
  const start = new Date(
    date.getFullYear(),
    date.getMonth(),
    view === "month" ? 1 : date.getDate(),
  );
  if (view !== "day") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const count = view === "month" ? 42 : view === "week" ? 7 : 1;
  return Array.from({ length: count }, (_, index) => addDays(start, index));
}
export function moveCalendar(date: Date, view: CalendarView, direction: number) {
  if (view !== "month") return addDays(date, direction * (view === "week" ? 7 : 1));
  // Anchor month navigation at day one so Jan 31 never skips February.
  return new Date(date.getFullYear(), date.getMonth() + direction, 1);
}
export function overlapsDay(item: { startsAt: string | null; durationMinutes: number }, day: Date) {
  if (!item.startsAt) return false;
  const start = Date.parse(item.startsAt);
  return start < addDays(day, 1).getTime() && start + item.durationMinutes * 60000 > day.getTime();
}
export function nextMeetingSlot(day = new Date()) {
  const result = new Date(day);
  result.setHours(9, 0, 0, 0);
  if (result.getTime() <= Date.now())
    return new Date(Math.ceil((Date.now() + 15 * 60000) / (15 * 60000)) * 15 * 60000);
  return result;
}
