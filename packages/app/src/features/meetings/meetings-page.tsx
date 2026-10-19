import { meetingSchema, meetingsSchema, meetingDetailSchema } from "@lumo/contracts/collaboration";
import { ErrorMessage, Field, PageHeading, SelectField, Loading } from "@lumo/ui";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
      <section className="card">
        <h2>Create a meeting</h2>
        <form
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
          <div className="form-grid">
            <Field label="Meeting title" name="title" required maxLength={100} />
            <SelectField label="Who can join" name="access">
              <option value="workspace">Workspace members</option>
              <option value="open">Anyone with a Lumo account and link</option>
            </SelectField>
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
          <SelectField label="Invite workspace members (optional)" name="participantIds" multiple>
            {members.data?.members.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </SelectField>
          <ErrorMessage error={create.error ?? members.error} />
          <button className="primary" disabled={create.isPending}>
            Create meeting
          </button>
        </form>
        {create.data && (
          <p className="notice">
            Meeting created.{" "}
            <Link to="/meetings/$meetingId" params={{ meetingId: create.data.id }}>
              Open {create.data.title}
            </Link>
          </p>
        )}
      </section>
      <ErrorMessage error={meetings.error} />
      {meetings.isPending ? (
        <Loading />
      ) : meetings.data?.meetings.length ? (
        <div className="workspace-grid">
          {meetings.data.meetings.map((item) => (
            <article className="card" key={item.id}>
              <span className="badge">
                {item.status} · {item.access}
              </span>
              <h2>{item.title}</h2>
              <p>
                {item.startsAt ? new Date(item.startsAt).toLocaleString() : "Meet now"} ·{" "}
                {item.durationMinutes} minutes
              </p>
              <Link className="button" to="/meetings/$meetingId" params={{ meetingId: item.id }}>
                Open meeting
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">No meetings yet.</p>
      )}
      <div className="actions">
        {offset > 0 && (
          <button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button>
        )}
        {meetings.data?.nextOffset != null && (
          <button onClick={() => setOffset(meetings.data!.nextOffset!)}>Next</button>
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
      <main className="narrow-page">
        <h1>Meeting unavailable</h1>
        <ErrorMessage error={detail.error} />
        <Link to="/workspaces">Your workspaces</Link>
      </main>
    );
  if (!detail.data) return <Loading label="Loading meeting…" />;
  const item = detail.data.meeting;
  const link = `${getPlatform()?.webOrigin ?? window.location.origin}/meetings/${meetingId}`;
  return (
    <main className="meeting-page" id="main-content">
      <Link to="/workspaces">← Your workspaces</Link>
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
      <div className="video-grid">
        <div className="video-tile" ref={local} aria-label="Your camera" />
        <div className="remote-videos" ref={remote} />
      </div>
      {!joined && !ended && (
        <section className="card">
          <h2>Before you join</h2>
          <p>Your camera and microphone start off. Enable them when you are ready.</p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={mic}
              disabled={busy}
              onChange={(event) => {
                const enabled = event.target.checked;
                setMic(enabled);
                if (connection.current) void action(() => connection.current!.mic(enabled));
              }}
            />
            Enable microphone on join
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={camera}
              disabled={busy}
              onChange={(event) => {
                const enabled = event.target.checked;
                setCamera(enabled);
                if (connection.current) void action(() => connection.current!.camera(enabled));
              }}
            />
            Enable camera on join
          </label>
          <button
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
          </button>
          <button
            disabled={busy}
            onClick={() => {
              void action(async () => {
                await connection.current?.close();
                connection.current = null;
              });
            }}
          >
            Stop preview
          </button>
          <button
            className="primary"
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
          </button>
        </section>
      )}
      {joined && (
        <div className="card">
          <div className="actions">
            <button
              disabled={busy}
              onClick={() => {
                void action(async () => {
                  await connection.current?.mic(!mic);
                  setMic(!mic);
                });
              }}
            >
              {mic ? "Mute microphone" : "Unmute microphone"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                void action(async () => {
                  await connection.current?.camera(!camera);
                  setCamera(!camera);
                });
              }}
            >
              {camera ? "Turn camera off" : "Turn camera on"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                void action(async () => setSharing(await connection.current!.share()));
              }}
            >
              {sharing ? "Stop sharing" : "Share screen"}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                void action(async () => setDevices(await connection.current!.devices()));
              }}
            >
              Choose devices
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => {
                void action(async () => {
                  await connection.current?.close();
                  setJoined(false);
                  setSharing(false);
                });
              }}
            >
              Leave meeting
            </button>
          </div>
          {devices.microphones.length > 0 && (
            <SelectField
              label="Microphone"
              onChange={(event) => {
                void action(() => connection.current!.mic(mic, event.target.value));
              }}
            >
              {devices.microphones.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || "Microphone"}
                </option>
              ))}
            </SelectField>
          )}
          {devices.cameras.length > 0 && (
            <SelectField
              label="Camera"
              onChange={(event) => {
                void action(() => connection.current!.camera(camera, event.target.value));
              }}
            >
              {devices.cameras.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || "Camera"}
                </option>
              ))}
            </SelectField>
          )}
        </div>
      )}
      <section className="card">
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
      {item.hostId === session.data?.user.id && !ended && (
        <button className="danger" disabled={end.isPending} onClick={() => end.mutate()}>
          End meeting for everyone
        </button>
      )}
    </main>
  );
}
