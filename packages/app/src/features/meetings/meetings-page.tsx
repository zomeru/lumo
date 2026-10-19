import { meetingSchema, meetingsSchema, meetingDetailSchema } from "@lumo/contracts/collaboration";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ErrorMessage,
  Field,
  Loading,
  MultiSelectField,
  PageHeading,
  SelectField,
} from "@lumo/ui";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Mic,
  MonitorUp,
  PhoneOff,
  Settings2,
  Video,
  VideoOff,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

import { api, command, sessionQuery, membersQuery } from "../../lib/api";
import { getPlatform } from "../../platform";
import { createMeetingConnection } from "./rtc";
export function MeetingsPage({ workspaceId }: { workspaceId: string }) {
  const [offset, setOffset] = useState(0);
  const members = useQuery(membersQuery(workspaceId));
  const meetings = useQuery({
    queryKey: ["workspace", workspaceId, "meetings", offset],
    queryFn: ({ signal }) =>
      api(`/workspaces/${workspaceId}/meetings?offset=${offset}`, meetingsSchema, { signal }),
    refetchInterval: 15000,
  });
  const create = useMutation({
    mutationFn: (body: unknown) =>
      api(`/workspaces/${workspaceId}/meetings`, meetingSchema, { method: "POST", body }),
    onSuccess: () => meetings.refetch(),
  });
  return (
    <>
      <PageHeading eyebrow="Face to face" title="Meetings">
        Meet now or make time to connect later.
      </PageHeading>
      <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
        <section>
          <h2 className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" aria-hidden="true" />
            Create a meeting
          </h2>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              const local = values.get("startsAt") as string;
              create.mutate({
                title: values.get("title"),
                access: values.get("access"),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                durationMinutes: Number(values.get("durationMinutes")),
                participantIds: values.getAll("participantIds") as string[],
                ...(local ? { startsAt: new Date(local).toISOString() } : {}),
              });
            }}
          >
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <Field label="Meeting title" name="title" required maxLength={100} />
              <SelectField
                label="Who can join"
                name="access"
                options={[
                  { value: "workspace", label: "Workspace members" },
                  { value: "open", label: "Anyone with a Lumo account and link" },
                ]}
              />
              <Field
                label="Start time (leave empty to meet now)"
                name="startsAt"
                type="datetime-local"
              />
              <Field
                label="Duration in minutes"
                name="durationMinutes"
                type="number"
                min={5}
                max={1440}
                defaultValue={60}
                required
              />
            </div>
            <MultiSelectField
              label="Invite workspace members (optional)"
              name="participantIds"
              options={
                members.data?.members.map((member) => ({
                  value: member.userId,
                  label: member.name,
                })) ?? []
              }
            />
            <ErrorMessage error={create.error ?? members.error} />
            <Button variant="primary" type="submit" disabled={create.isPending}>
              <Video aria-hidden="true" />
              Create meeting
            </Button>
          </form>
          {create.data && (
            <p className="my-3 block rounded-md border border-primary/15 bg-accent px-3 py-2.5 text-sm text-accent-foreground">
              Meeting created.{" "}
              <Link to="/meetings/$meetingId" params={{ meetingId: create.data.id }}>
                Open {create.data.title}
              </Link>
            </p>
          )}
        </section>
      </Card>
      <ErrorMessage error={meetings.error} />
      {meetings.isPending ? (
        <Loading />
      ) : meetings.data?.meetings.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {meetings.data.meetings.map((item) => (
            <Card asChild key={item.id} className="[&>p]:my-3 [&>form]:mt-4">
              <article key={item.id}>
                <Badge>
                  {item.status} · {item.access}
                </Badge>
                <h2>{item.title}</h2>
                <p>
                  {item.startsAt ? new Date(item.startsAt).toLocaleString() : "Meet now"} ·{" "}
                  {item.durationMinutes} minutes
                </p>
                <Button asChild>
                  <Link to="/meetings/$meetingId" params={{ meetingId: item.id }}>
                    <Video aria-hidden="true" />
                    Open meeting
                  </Link>
                </Button>
              </article>
            </Card>
          ))}
        </div>
      ) : (
        <p className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-surface px-5 py-10 text-center text-muted-foreground">
          No meetings yet.
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {offset > 0 && (
          <Button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button>
        )}
        {meetings.data?.nextOffset != null && (
          <Button onClick={() => setOffset(meetings.data!.nextOffset!)}>Next</Button>
        )}
      </div>
    </>
  );
}
export function MeetingPage({ meetingId }: { meetingId: string }) {
  const detail = useQuery({
    queryKey: ["meeting", meetingId],
    queryFn: ({ signal }) => api(`/meetings/${meetingId}`, meetingDetailSchema, { signal }),
    refetchInterval: 5000,
    retry: false,
  });
  const session = useQuery(sessionQuery());
  const local = useRef<HTMLDivElement>(null),
    remote = useRef<HTMLDivElement>(null),
    connection = useRef<Awaited<ReturnType<typeof createMeetingConnection>> | null>(null);
  const [state, setState] = useState("Ready to join"),
    [error, setError] = useState<unknown>(null),
    [joined, setJoined] = useState(false),
    [busy, setBusy] = useState(false),
    [mic, setMic] = useState(false),
    [camera, setCamera] = useState(false),
    [sharing, setSharing] = useState(false),
    [devices, setDevices] = useState<{
      cameras: MediaDeviceInfo[];
      microphones: MediaDeviceInfo[];
    }>({ cameras: [], microphones: [] });
  const ended = detail.data?.meeting.status === "ended";
  useEffect(
    () => () => {
      void connection.current?.close();
      connection.current = null;
    },
    [],
  );
  useEffect(() => {
    if (ended || detail.isError) {
      void connection.current?.close().then(() => setJoined(false));
    }
  }, [ended, detail.isError]);
  async function action(run: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  }
  const end = useMutation({
    mutationFn: () => command(`/meetings/${meetingId}/end`),
    onSuccess: async () => {
      await connection.current?.close();
      setJoined(false);
      await detail.refetch();
    },
  });
  if (detail.isError)
    return (
      <main className="mx-auto grid max-w-2xl gap-6 px-5 py-10 sm:px-8">
        <h1>Meeting unavailable</h1>
        <ErrorMessage error={detail.error} />
        <Link
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
          to="/workspaces"
        >
          Your workspaces
        </Link>
      </main>
    );
  if (!detail.data) return <Loading label="Loading meeting…" />;
  const item = detail.data.meeting;
  const link = `${getPlatform()?.webOrigin ?? window.location.origin}/meetings/${meetingId}`;
  return (
    <main className="mx-auto grid max-w-6xl gap-5 px-5 py-8 sm:px-8" id="main-content">
      <Link
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        to="/workspaces"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Your workspaces
      </Link>
      <PageHeading
        eyebrow={`${item.access === "open" ? "Open to signed-in guests" : "Workspace members only"} · ${item.status}`}
        title={item.title}
      >
        {item.startsAt
          ? `Starts ${new Date(item.startsAt).toLocaleString()} (${item.timezone})`
          : "Connect with your team."}
      </PageHeading>
      <Field
        label="Share meeting link"
        value={link}
        readOnly
        onFocus={(event) => event.target.select()}
      />
      <output aria-live="polite">{state}</output>
      <ErrorMessage error={error ?? end.error} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="relative min-h-56 overflow-hidden rounded-lg border bg-media-background">
          {!camera && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-media-foreground">
              <VideoOff className="size-7 opacity-60" aria-hidden="true" />
              <span className="text-xs">Your camera is off</span>
            </div>
          )}
          <div
            className="relative min-h-56 overflow-hidden rounded-lg border bg-media-background"
            data-video-tile
            ref={local}
            aria-label="Your camera"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2" data-remote-videos ref={remote} />
      </div>
      {!joined && !ended && (
        <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
          <section>
            <h2>Before you join</h2>
            <p>Your camera and microphone start off. Enable them when you are ready.</p>
            <label
              htmlFor="prejoin-microphone"
              className="flex cursor-pointer items-center gap-3 py-2 text-sm"
            >
              <Checkbox
                id="prejoin-microphone"
                checked={mic}
                disabled={busy}
                onCheckedChange={(checked) => {
                  const enabled = checked === true;
                  setMic(enabled);
                  if (connection.current) void action(() => connection.current!.mic(enabled));
                }}
              />
              Enable microphone on join
            </label>
            <label
              htmlFor="prejoin-camera"
              className="flex cursor-pointer items-center gap-3 py-2 text-sm"
            >
              <Checkbox
                id="prejoin-camera"
                checked={camera}
                disabled={busy}
                onCheckedChange={(checked) => {
                  const enabled = checked === true;
                  setCamera(enabled);
                  if (connection.current) void action(() => connection.current!.camera(enabled));
                }}
              />
              Enable camera on join
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                disabled={busy}
                onClick={() => {
                  void action(async () => {
                    await connection.current?.close();
                    const value = await createMeetingConnection(meetingId, {
                      local: local.current!,
                      remote: remote.current!,
                      onState: setState,
                      onError: setError,
                    });
                    if (!local.current || !remote.current) {
                      await value.close();
                      return;
                    }
                    connection.current = value;
                    try {
                      await value.preview(mic, camera);
                    } catch (cause) {
                      await value.close();
                      throw cause;
                    }
                  });
                }}
              >
                Check camera and microphone
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  void action(async () => {
                    await connection.current?.close();
                    connection.current = null;
                  });
                }}
              >
                Stop preview
              </Button>
              <Button
                variant="primary"

                disabled={busy}
                onClick={() => {
                  void action(async () => {
                    await connection.current?.close();
                    const value = await createMeetingConnection(meetingId, {
                      local: local.current!,
                      remote: remote.current!,
                      onState: (value) => {
                        setState(value);
                        if (value === "Left meeting") {
                          setJoined(false);
                          setSharing(false);
                        }
                      },
                      onError: setError,
                    });
                    if (!local.current || !remote.current) {
                      await value.close();
                      return;
                    }
                    connection.current = value;
                    await value.join(mic, camera);
                    setJoined(true);
                  });
                }}
              >
                Join meeting
              </Button>
            </div>
          </section>
        </Card>
      )}
      {joined && (
        <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
          <div>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button
                disabled={busy}
                onClick={() => {
                  void action(async () => {
                    await connection.current?.mic(!mic);
                    setMic(!mic);
                  });
                }}
              >
                <Mic aria-hidden="true" />
                {mic ? "Mute microphone" : "Unmute microphone"}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  void action(async () => {
                    await connection.current?.camera(!camera);
                    setCamera(!camera);
                  });
                }}
              >
                <Camera aria-hidden="true" />
                {camera ? "Turn camera off" : "Turn camera on"}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  void action(async () => setSharing(await connection.current!.share()));
                }}
              >
                <MonitorUp aria-hidden="true" />
                {sharing ? "Stop sharing" : "Share screen"}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  void action(async () => setDevices(await connection.current!.devices()));
                }}
              >
                <Settings2 aria-hidden="true" />
                Choose devices
              </Button>
              <Button
                variant="destructive"

                disabled={busy}
                onClick={() => {
                  void action(async () => {
                    await connection.current?.close();
                    setJoined(false);
                    setSharing(false);
                  });
                }}
              >
                <PhoneOff aria-hidden="true" />
                Leave meeting
              </Button>
            </div>
            {devices.microphones.length > 0 && (
              <SelectField
                label="Microphone"
                defaultValue=""
                onValueChange={(value) => {
                  void action(() => connection.current!.mic(mic, value));
                }}
                options={devices.microphones.map((device) => ({
                  value: device.deviceId,
                  label: device.label || "Microphone",
                }))}
              />
            )}
            {devices.cameras.length > 0 && (
              <SelectField
                label="Camera"
                defaultValue=""
                onValueChange={(value) => {
                  void action(() => connection.current!.camera(camera, value));
                }}
                options={devices.cameras.map((device) => ({
                  value: device.deviceId,
                  label: device.label || "Camera",
                }))}
              />
            )}
          </div>
        </Card>
      )}
      <Card asChild className="[&>p]:my-3 [&>form]:mt-4">
        <section>
          <h2>Participants</h2>
          {detail.data.participants.length ? (
            detail.data.participants.map((person) => (
              <p key={person.userId}>
                {person.name} · {person.online ? "In meeting" : person.invited ? "Invited" : "Left"}
              </p>
            ))
          ) : (
            <p>No participants yet.</p>
          )}
        </section>
      </Card>
      {item.hostId === session.data?.user.id && !ended && (
        <Button variant="destructive" disabled={end.isPending} onClick={() => end.mutate()}>
          End meeting for everyone
        </Button>
      )}
    </main>
  );
}
