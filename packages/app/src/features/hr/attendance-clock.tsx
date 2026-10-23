import { formatDate, formatTime } from "@lumo/shared/date-time";
import { useEffect, useState } from "react";

export function AttendanceClock({
  serverTime,
  updatedAt,
  timezone,
}: {
  serverTime?: string;
  updatedAt: number;
  timezone: string;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const instant = serverTime
    ? new Date(Date.parse(serverTime) + Math.max(0, now - updatedAt))
    : null;
  return (
    <>
      <p>{formatDate(instant, timezone)}</p>
      <time
        aria-label="Current time"
        dateTime={instant?.toISOString()}
        className="my-3 block text-3xl font-semibold"
      >
        {formatTime(instant, timezone)}
      </time>
      <p className="mb-3 text-sm text-muted-foreground">{timezone}</p>
    </>
  );
}
