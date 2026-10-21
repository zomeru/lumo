import {
  meetingAvailabilitySchema,
  meetingSchema,
  scheduledMeetingInputSchema,
  type Meeting,
} from "@lumo/contracts/collaboration";
import { formatDateTime } from "@lumo/shared/date-time";
import { localMeetingInstant, zonedDateTime } from "@lumo/shared/meeting-time";
import {
  Button,
  DialogTitle,
  DialogDescription,
  ErrorMessage,
  Field,
  FormField,
  Textarea,
  MultiSelectField,
  SelectField,
} from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useMemo, useState } from "react";

import { api, membersQuery, sessionQuery } from "../../lib/api";
import { useMeetingClock } from "./meeting-clock";
import { refreshMeetings } from "./meeting-queries";

const supportedTimezones = Intl.supportedValuesOf("timeZone");
const TimezoneField = memo(function TimezoneField({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (zone: string) => void;
}) {
  const options = useMemo(
    () =>
      [...new Set([value, "UTC", ...supportedTimezones])]
        .sort()
        .map((zone) => ({ value: zone, label: zone })),
    [value],
  );
  return (
    <SelectField
      label="Scheduling timezone (IANA)"
      value={value}
      onValueChange={onValueChange}
      options={options}
    />
  );
});

export function ScheduleComposer({
  workspaceId,
  initial,
  meeting,
  participantIds = [],
  onSaved,
}: {
  workspaceId: string;
  initial: Date;
  meeting?: Meeting;
  participantIds?: string[];
  onSaved: (meeting: Meeting) => void;
}) {
  const now = useMeetingClock();
  const client = useQueryClient();
  const members = useQuery(membersQuery(workspaceId));
  const session = useQuery(sessionQuery());
  const [title, setTitle] = useState(meeting?.title ?? "");
  const [description, setDescription] = useState(meeting?.description ?? "");
  const [access, setAccess] = useState<"workspace" | "open">(meeting?.access ?? "workspace");
  const [timezone, setTimezone] = useState(
    meeting?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [startsAt, setStartsAt] = useState(() =>
    zonedDateTime(meeting?.startsAt ? new Date(meeting.startsAt) : initial, timezone),
  );
  const [durationMinutes, setDuration] = useState(meeting?.durationMinutes ?? 60);
  const [invitees, setInvitees] = useState(participantIds);
  const converted = useMemo(() => {
    try {
      return localMeetingInstant(startsAt, timezone);
    } catch (cause) {
      return cause instanceof Error ? cause : new Error("Choose a valid scheduling timezone.");
    }
  }, [startsAt, timezone]);
  let input: ReturnType<typeof scheduledMeetingInputSchema.parse> | undefined;
  let validation: Error | null = null;
  try {
    if (converted instanceof Error) throw converted;
    const instant = converted;
    input = scheduledMeetingInputSchema.parse({
      title,
      description,
      access,
      startsAt: instant,
      timezone,
      durationMinutes,
      participantIds: invitees,
    });
    if (Date.parse(instant) <= now) throw new Error("Schedule a future start time.");
  } catch (cause) {
    // Field constraints have native controls; timezone/time errors need explicit feedback.
    validation = cause instanceof Error ? cause : new Error("Check the meeting fields.");
  }
  const from = input?.startsAt;
  const to = from ? new Date(Date.parse(from) + durationMinutes * 60000).toISOString() : undefined;
  const availability = useQuery({
    queryKey: ["workspace", workspaceId, "availability", from, to, invitees, meeting?.id],
    queryFn: ({ signal }) =>
      api(`/workspaces/${workspaceId}/meetings/availability`, meetingAvailabilitySchema, {
        method: "POST",
        body: {
          from,
          to,
          participantIds: invitees,
          ...(meeting ? { excludeMeetingId: meeting.id } : {}),
        },
        signal,
      }),
    enabled: Boolean(input && !validation),
    retry: false,
    refetchInterval: 15000,
  });
  const save = useMutation({
    mutationFn: (body: NonNullable<typeof input>) =>
      api(`/workspaces/${workspaceId}/meetings${meeting ? `/${meeting.id}` : ""}`, meetingSchema, {
        method: meeting ? "PATCH" : "POST",
        body,
      }),
    onSuccess: async (saved) => {
      await refreshMeetings(client, workspaceId, saved.id);
      onSaved(saved);
    },
  });
  return (
    <>
      <DialogTitle>{meeting ? "Edit scheduled meeting" : "Schedule meeting"}</DialogTitle>
      <DialogDescription>
        Times below use the scheduling timezone. Calendar displays your local time. Overlaps are
        warnings; simultaneous meetings are allowed.
      </DialogDescription>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (input && !validation) save.mutate(input);
        }}
      >
        <Field
          label="Meeting title"
          required
          maxLength={100}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <FormField label="Description / agenda">
          <Textarea
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </FormField>
        <p className="text-sm">Organizer: {session.data?.user.name}</p>
        <Field
          label="Start date and time"
          type="datetime-local"
          required
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Duration in minutes"
            type="number"
            min={5}
            max={1440}
            required
            value={durationMinutes}
            onChange={(event) => setDuration(Number(event.target.value))}
          />
          <TimezoneField value={timezone} onValueChange={setTimezone} />
        </div>
        {to && (
          <p className="text-sm">
            Ends {formatDateTime(to, timezone)} ({timezone})
          </p>
        )}
        <SelectField
          label="Who can join"
          value={access}
          onValueChange={(value) => setAccess(value as "workspace" | "open")}
          options={[
            { value: "workspace", label: "Workspace members" },
            { value: "open", label: "Anyone with a Lumo account and link" },
          ]}
        />
        <MultiSelectField
          label="Invite workspace members (optional)"
          value={invitees}
          onValueChange={setInvitees}
          options={
            members.data?.members.map((person) => ({ value: person.userId, label: person.name })) ??
            []
          }
        />
        <ErrorMessage error={save.error ?? members.error} />
        {validation && title.trim() && (
          <ErrorMessage
            error={
              validation.name === "ZodError"
                ? new Error("Check the title, duration and timezone.")
                : validation
            }
          />
        )}
        <section aria-live="polite" className="rounded-lg border bg-accent/40 p-3 text-sm">
          {availability.isError ? (
            <>
              <p>Availability unavailable. You may still schedule.</p>
              <Button type="button" size="sm" onClick={() => void availability.refetch()}>
                Retry availability
              </Button>
            </>
          ) : availability.isFetching ? (
            "Checking availability…"
          ) : availability.data?.conflicts.length ? (
            <>
              <p>Organizer or invitee conflicts (saving is allowed):</p>
              <ul className="mt-2 list-disc pl-5">
                {availability.data.conflicts.map((item) => (
                  <li key={item.id}>
                    {item.title} · {formatDateTime(item.startsAt, timezone)} –{" "}
                    {formatDateTime(item.endsAt, timezone)}
                  </li>
                ))}
              </ul>
              <p className="mt-2">Choose another time above to check an alternative.</p>
            </>
          ) : input && !validation ? (
            "No organizer or invitee conflicts in this workspace."
          ) : (
            "Enter valid meeting details to check availability."
          )}
        </section>
        <Button
          type="submit"
          variant="primary"
          disabled={save.isPending || !input || Boolean(validation)}
        >
          {save.isPending ? "Saving…" : meeting ? "Save changes" : "Schedule meeting"}
        </Button>
      </form>
    </>
  );
}
