import { type Meeting } from "@lumolynk/contracts/collaboration";
import { formatDate, formatTime, formatDateTime } from "@lumolynk/shared/date-time";
import { meetingState } from "@lumolynk/shared/meeting-time";
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  ErrorMessage,
  Field,
  Loading,
  PageHeading,
  SelectField,
  cn,
} from "@lumolynk/ui";
import { ConfirmAction } from "@lumolynk/ui/confirm-action";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { command, sessionQuery } from "../../lib/api";
import { getPlatform } from "../../platform";
import {
  addDays,
  calendarDays,
  moveCalendar,
  nextMeetingSlot,
  overlapsDay,
  type CalendarView,
} from "./calendar-dates";
import { useMeetingClock } from "./meeting-clock";
import { calendarDetailQuery, calendarQuery, refreshMeetings } from "./meeting-queries";
import { ScheduleComposer } from "./schedule-composer";

type Composer =
  | { kind: "create"; initial: Date }
  | { kind: "detail"; id: string }
  | { kind: "edit"; meeting: Meeting; participantIds: string[] };
const dateLabel = (date: Date) => formatDate(date);
const meetingLink = (id: string) =>
  `${getPlatform()?.webOrigin ?? window.location.origin}/meetings/${id}`;
const timeRange = (item: Meeting) =>
  `${formatDateTime(item.startsAt!)} – ${formatDateTime(Date.parse(item.startsAt!) + item.durationMinutes * 60000)}`;

const eventTimeRange = (item: Meeting) => {
  const start = new Date(item.startsAt!);
  const end = new Date(start.getTime() + item.durationMinutes * 60000);
  return `${formatTime(start)} – ${start.toDateString() === end.toDateString() ? formatTime(end) : formatDateTime(end)}`;
};

function MeetingLinks({ meeting }: { meeting: Meeting }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="grid gap-3">
      <Field
        label="Share meeting link"
        value={meetingLink(meeting.id)}
        readOnly
        onFocus={(event) => event.target.select()}
      />
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/meetings/$meetingId" params={{ meetingId: meeting.id }}>
            View meeting
          </Link>
        </Button>
        <Button
          onClick={() => {
            void Promise.resolve()
              .then(() => navigator.clipboard.writeText(meetingLink(meeting.id)))
              .then(() => setCopied(true))
              .catch(setError);
          }}
        >
          {copied ? "Link copied" : "Copy link"}
        </Button>
      </div>
      <ErrorMessage error={error} />
    </div>
  );
}
function CalendarDetails({
  workspaceId,
  id,
  onEdit,
}: {
  workspaceId: string;
  id: string;
  onEdit: (meeting: Meeting, participantIds: string[]) => void;
}) {
  const now = useMeetingClock();
  const detail = useQuery(calendarDetailQuery(workspaceId, id));
  const session = useQuery(sessionQuery());
  const client = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => command(`/workspaces/${workspaceId}/meetings/${id}/cancel`),
    onSuccess: () => refreshMeetings(client, workspaceId, id),
  });
  if (detail.isError)
    return (
      <>
        <DialogTitle>Meeting unavailable</DialogTitle>
        <DialogDescription>Access may have changed.</DialogDescription>
        <ErrorMessage error={detail.error} />
        <Button onClick={() => void detail.refetch()}>Retry</Button>
      </>
    );
  if (!detail.data)
    return (
      <>
        <DialogTitle>Meeting details</DialogTitle>
        <DialogDescription>Loading scheduled meeting.</DialogDescription>
        <Loading />
      </>
    );
  const item = detail.data.meeting;
  const editable =
    item.hostId === session.data?.user.id &&
    item.status === "scheduled" &&
    meetingState(item, now) !== "Completed";
  return (
    <>
      <DialogTitle>{item.title}</DialogTitle>
      <DialogDescription>{timeRange(item)}</DialogDescription>
      <Badge>{meetingState(item, now)}</Badge>
      <p className="text-sm">
        Scheduled in {item.timezone} · {item.durationMinutes} minutes
        <br />
        Calendar times: {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>
      <p className="text-sm">Organizer: {detail.data.hostName}</p>
      <p className="text-sm">
        {item.access === "open"
          ? "Anyone with a LumoLynk account and link"
          : "Workspace members only"}
      </p>
      {item.description && <p className="whitespace-pre-wrap text-sm">{item.description}</p>}
      <MeetingLinks meeting={item} />
      <ErrorMessage error={cancel.error} />
      {editable && (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              onEdit(
                item,
                detail.data.participants
                  .filter((person) => person.invited)
                  .map((person) => person.userId),
              )
            }
          >
            Edit / reschedule
          </Button>
          <ConfirmAction
            label="Cancel meeting"
            message="The meeting remains on Calendar as canceled. Its link will no longer allow joining."
            disabled={cancel.isPending}
            onConfirm={() => cancel.mutate()}
          />
        </div>
      )}
    </>
  );
}

function CalendarHour({
  hour,
  columns,
  openSlot,
  eventButton,
}: {
  hour: number;
  columns: { day: Date; meetings: (Meeting & { hostName: string })[] }[];
  openSlot: (day: Date, hour: number) => void;
  eventButton: (meeting: Meeting & { hostName: string }) => ReactNode;
}) {
  return (
    <>
      <div className="h-28 border-r border-b bg-muted/10 px-2 pt-2 text-right text-[10px] tabular-nums text-muted-foreground">
        {hour % 12 || 12} {hour < 12 ? "AM" : "PM"}
      </div>
      {columns.map(({ day, meetings }) => (
        <div
          key={day.toISOString()}
          className="relative h-28 min-w-0 overflow-y-auto border-r border-b last:border-r-0"
        >
          <button
            type="button"
            className="absolute inset-0 size-full transition-colors hover:bg-accent/40 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            aria-label={`Schedule ${dateLabel(day)} ${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`}
            onClick={() => openSlot(day, hour)}
          />
          <div className="pointer-events-none relative z-10 px-1 [&_button]:pointer-events-auto">
            {meetings
              .filter((item) => {
                const start = new Date(item.startsAt!);
                return start < day ? hour === 0 : start.getHours() === hour;
              })
              .map(eventButton)}
          </div>
        </div>
      ))}
    </>
  );
}

export function CalendarPage({
  workspaceId,
  compose,
  onComposeClosed,
}: {
  workspaceId: string;
  compose: boolean;
  onComposeClosed: () => void;
}) {
  const now = useMeetingClock();
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>("week");
  const [composer, setComposer] = useState<Composer | null>(() =>
    compose ? { kind: "create", initial: nextMeetingSlot() } : null,
  );
  const [previousCompose, setPreviousCompose] = useState(compose);
  if (compose !== previousCompose) {
    setPreviousCompose(compose);
    setComposer((current) =>
      compose
        ? { kind: "create", initial: nextMeetingSlot() }
        : current?.kind === "create"
          ? null
          : current,
    );
  }
  const [saved, setSaved] = useState<Meeting | null>(null);
  const days = calendarDays(date, view);
  const from = days[0]!.toISOString();
  const to = addDays(days.at(-1)!, 1).toISOString();
  const events = useQuery(calendarQuery(workspaceId, from, to));
  const timeColumns = (view === "month" ? [] : days).map((day) => ({
    day,
    meetings: events.data?.filter((item) => overlapsDay(item, day)) ?? [],
  }));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Start time grids at the working day; users can scroll to any of the 24 hours.
    if (grid.current && view !== "month") grid.current.scrollTop = 8 * 112;
  }, [view, from, events.isPending]);
  const openSlot = (day: Date, hour = 9) => {
    const initial = new Date(day);
    initial.setHours(hour, 0, 0, 0);
    setComposer({ kind: "create", initial });
  };
  const close = () => {
    setComposer(null);
    onComposeClosed();
  };
  const eventButton = (item: NonNullable<typeof events.data>[number], compact: boolean) => (
    <button
      type="button"
      key={item.id}
      className={cn(
        "my-1 block w-full rounded-md border border-primary/20 bg-accent text-left text-xs text-accent-foreground hover:border-primary focus-visible:outline-2 focus-visible:outline-ring",
        compact ? "p-1.5" : "p-2",
        item.status === "canceled" && "bg-muted text-muted-foreground line-through",
        meetingState(item, now) === "Completed" && "opacity-65",
      )}
      title={`${item.title} · ${timeRange(item)} · ${item.hostName} · ${meetingState(item, now)}`}
      onClick={() => setComposer({ kind: "detail", id: item.id })}
    >
      <span className={cn("block font-medium", compact && "line-clamp-2")}>{item.title}</span>
      <span className={cn("block", compact && "line-clamp-2 text-[10px] leading-4")}>
        {eventTimeRange(item)}
      </span>
      <span className={compact ? "sr-only" : "block"}>
        {item.hostName} · {meetingState(item, now)}
      </span>
    </button>
  );
  return (
    <>
      <PageHeading eyebrow="Connect · Shared workspace schedule" title="Calendar">
        Make time for your team. Displaying {timezone}.
      </PageHeading>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            aria-label="Previous date range"
            onClick={() => setDate(moveCalendar(date, view, -1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button onClick={() => setDate(new Date())}>Today</Button>
          <Button aria-label="Next date range" onClick={() => setDate(moveCalendar(date, view, 1))}>
            <ChevronRight aria-hidden="true" />
          </Button>
          <h2 className="text-sm font-semibold" aria-live="polite">
            {view === "month"
              ? date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
              : `${dateLabel(days[0]!)}${view === "week" ? ` – ${dateLabel(days.at(-1)!)}` : ""} · ${date.getFullYear()}`}
          </h2>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <SelectField
            label="Calendar view"
            value={view}
            onValueChange={(value) => setView(value as CalendarView)}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
            ]}
          />
          <Button
            variant="primary"
            onClick={() => {
              setComposer({ kind: "create", initial: nextMeetingSlot(date) });
            }}
          >
            <Plus aria-hidden="true" />
            Schedule meeting
          </Button>
        </div>
      </div>
      {saved && !events.isError && (
        <Card className="grid gap-3">
          <output>Meeting saved: {saved.title}</output>
          <MeetingLinks key={saved.id} meeting={saved} />
        </Card>
      )}
      {events.isError ? (
        <Card className="grid gap-3">
          <ErrorMessage error={events.error} />
          <p>Calendar unavailable. Check your connection or workspace access.</p>
          <Button onClick={() => void events.refetch()}>Retry Calendar</Button>
        </Card>
      ) : events.isPending ? (
        <Loading
          label={
            events.fetchStatus === "paused"
              ? "You are offline. Reconnect to load Calendar."
              : "Loading Calendar…"
          }
        />
      ) : (
        <>
          {events.fetchStatus === "paused" && (
            <output>You are offline. Showing the last schedule; reconnect to refresh.</output>
          )}
          {events.data.length === 0 && (
            <p className="rounded-lg border border-dashed p-5 text-center text-muted-foreground">
              No scheduled meetings in this range. Select a date or schedule a meeting.
            </p>
          )}
          <div
            className={cn(
              "hidden overflow-auto rounded-xl border bg-surface md:block",
              view !== "month" && "max-h-[70vh]",
            )}
            aria-label={`${view} calendar`}
            ref={grid}
          >
            {view === "month" ? (
              <>
                <div className="grid grid-cols-7 border-b bg-muted/30">
                  {days.slice(0, 7).map((day) => (
                    <div
                      key={day.toISOString()}
                      className="py-3 text-center text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                    >
                      {day.toLocaleDateString(undefined, { weekday: "short" })}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {days.map((day) => {
                    const today = day.toDateString() === new Date(now).toDateString();
                    return (
                      <section
                        key={day.toISOString()}
                        aria-label={dateLabel(day)}
                        className={cn(
                          "min-h-36 min-w-0 border-r border-b p-1 last:border-r-0",
                          day.getMonth() !== date.getMonth() && "bg-muted/20 text-muted-foreground",
                        )}
                      >
                        <div className="flex justify-center py-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "min-w-8 rounded-full px-2 text-xs",
                              today &&
                                "bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground",
                            )}
                            aria-label={`Schedule on ${dateLabel(day)}`}
                            onClick={() => openSlot(day)}
                          >
                            {day.getDate() === 1
                              ? day.toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })
                              : day.getDate()}
                          </Button>
                        </div>
                        {events.data
                          .filter((item) => overlapsDay(item, day))
                          .map((item) => eventButton(item, false))}
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "sticky top-0 z-20 grid border-b bg-surface",
                    view === "day"
                      ? "grid-cols-[4rem_minmax(0,1fr)]"
                      : "grid-cols-[4rem_repeat(7,minmax(0,1fr))]",
                  )}
                >
                  <div className="flex items-end justify-center border-r bg-muted/20 pb-3 text-[10px] text-muted-foreground">
                    Local time
                  </div>
                  {days.map((day) => {
                    const today = day.toDateString() === new Date(now).toDateString();
                    return (
                      <div
                        key={day.toISOString()}
                        className="grid justify-items-center gap-1 border-r bg-muted/20 py-3 last:border-r-0"
                      >
                        <span
                          className={cn(
                            "text-[10px] font-semibold tracking-wide text-muted-foreground uppercase",
                            today && "text-primary",
                          )}
                        >
                          {day.toLocaleDateString(undefined, { weekday: "short" })}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "size-9 rounded-full text-lg font-semibold",
                            today &&
                              "bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground",
                          )}
                          aria-label={`Schedule on ${dateLabel(day)}`}
                          onClick={() => openSlot(day)}
                        >
                          {day.getDate()}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div
                  className={cn(
                    "grid",
                    view === "day"
                      ? "grid-cols-[4rem_minmax(0,1fr)]"
                      : "grid-cols-[4rem_repeat(7,minmax(0,1fr))]",
                  )}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <CalendarHour
                      key={hour}
                      hour={hour}
                      columns={timeColumns}
                      openSlot={openSlot}
                      eventButton={(item) => eventButton(item, true)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="grid gap-4 md:hidden" aria-label="Calendar agenda">
            <p className="text-sm text-muted-foreground">
              Agenda · {timezone}
              {view === "month" ? " · Days with meetings" : ""}
            </p>
            {days
              .filter(
                (day) => view !== "month" || events.data.some((item) => overlapsDay(item, day)),
              )
              .map((day) => (
                <Card key={day.toISOString()} className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">{dateLabel(day)}</h2>
                    <Button
                      size="sm"
                      aria-label={`Schedule on ${dateLabel(day)}`}
                      onClick={() => openSlot(day)}
                    >
                      <CalendarDays aria-hidden="true" />
                      Schedule
                    </Button>
                  </div>
                  {events.data
                    .filter((item) => overlapsDay(item, day))
                    .map((item) => eventButton(item, false))}
                </Card>
              ))}
          </div>
        </>
      )}
      <Dialog
        open={composer !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="max-w-xl">
          {composer?.kind === "detail" ? (
            <CalendarDetails
              workspaceId={workspaceId}
              id={composer.id}
              onEdit={(meeting, participantIds) =>
                setComposer({ kind: "edit", meeting, participantIds })
              }
            />
          ) : composer ? (
            <ScheduleComposer
              key={composer.kind === "edit" ? composer.meeting.id : composer.initial.toISOString()}
              workspaceId={workspaceId}
              initial={
                composer.kind === "create" ? composer.initial : new Date(composer.meeting.startsAt!)
              }
              {...(composer.kind === "edit"
                ? { meeting: composer.meeting, participantIds: composer.participantIds }
                : {})}
              onSaved={(meeting) => {
                setSaved(meeting);
                setDate(new Date(meeting.startsAt!));
                close();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
