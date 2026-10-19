import { test, expect, vi, afterEach } from "vitest";
const fakes = vi.hoisted(() => {
  const clients: {
    handlers: Map<string, (...args: unknown[]) => unknown>;
    join: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<void>>>;
    leave: ReturnType<typeof vi.fn<() => Promise<void>>>;
    publish: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<void>>>;
    renewToken: ReturnType<typeof vi.fn<(token: string) => Promise<void>>>;
    subscribe: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<void>>>;
    removeAllListeners: ReturnType<typeof vi.fn<() => void>>;
  }[] = [];
  const track = () => ({
    stop: vi.fn<() => void>(),
    close: vi.fn<() => void>(),
    play: vi.fn<(...args: unknown[]) => void>(),
    setEnabled: vi.fn<(value: boolean) => Promise<void>>(async () => {}),
    setDevice: vi.fn<(value: string) => Promise<void>>(async () => {}),
    on: vi.fn<(name: string, handler: () => void) => void>(),
  });
  const audio = track(),
    video = track(),
    screen = track();
  return {
    clients,
    audio,
    video,
    screen,
    token: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
      appId: "app",
      channel: "server-channel",
      uid: "server-user",
      token: "scoped-token",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    })),
    command: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ ok: true })),
    sdk: {
      setLogLevel: () => {},
      disableLogUpload: () => {},
      createClient: () => {
        const handlers = new Map<string, (...args: unknown[]) => unknown>();
        const client = {
          handlers,
          on: (event: string, callback: (...args: unknown[]) => unknown) =>
            handlers.set(event, callback),
          join: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
          leave: vi.fn<() => Promise<void>>(async () => {}),
          publish: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
          renewToken: vi.fn<(token: string) => Promise<void>>(async () => {}),
          subscribe: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
          removeAllListeners: vi.fn<() => void>(),
        };
        clients.push(client);
        return client;
      },
      createMicrophoneAudioTrack: async () => audio,
      createCameraVideoTrack: async () => video,
      createScreenVideoTrack: async () => screen,
      getCameras: async () => [{ deviceId: "camera", label: "Camera" }],
      getMicrophones: async () => [{ deviceId: "mic", label: "Mic" }],
    },
  };
});
vi.mock("agora-rtc-sdk-ng", () => ({ default: fakes.sdk }));
vi.mock("../../lib/api", () => ({ api: fakes.token, command: fakes.command }));
import { createMeetingConnection } from "./rtc";
afterEach(() => {
  vi.useRealTimers();
  fakes.clients.length = 0;
});
const renderers = () => ({
  local: document.createElement("div"),
  remote: document.createElement("div"),
  onState: vi.fn<(state: string) => void>(),
  onError: vi.fn<(error: unknown) => void>(),
});
test("RTC registers events before join, controls devices and cleans tracks", async () => {
  const view = renderers(),
    connection = await createMeetingConnection("meeting", view);
  const client = fakes.clients[0]!;
  expect(client.handlers.has("user-published")).toBe(true);
  await connection.join(true, true);
  expect(client.join).toHaveBeenCalledWith("app", "server-channel", "scoped-token", "server-user");
  expect(fakes.video.play).toHaveBeenCalledWith(view.local);
  await connection.mic(false, "new-mic");
  await connection.camera(false, "new-camera");
  expect(fakes.audio.setDevice).toHaveBeenCalledWith("new-mic");
  expect(fakes.video.setEnabled).toHaveBeenCalledWith(false);
  const remoteTrack = { play: vi.fn<(...args: unknown[]) => void>() };
  client.handlers.get("user-published")!(
    { uid: "remote", audioTrack: remoteTrack, videoTrack: remoteTrack },
    "video",
  );
  await vi.waitFor(() => expect(view.remote.children).toHaveLength(1));
  client.handlers.get("user-published")!({ uid: "remote", audioTrack: remoteTrack }, "audio");
  await vi.waitFor(() => expect(remoteTrack.play).toHaveBeenCalledTimes(2));
  client.handlers.get("user-unpublished")!({ uid: "remote" }, "video");
  expect(view.remote.children).toHaveLength(0);
  client.handlers.get("user-left")!({ uid: "remote" });
  expect(await connection.devices()).toMatchObject({ cameras: [{ deviceId: "camera" }] });
  await connection.close();
  await connection.close();
  expect(fakes.audio.stop).toHaveBeenCalled();
  expect(fakes.audio.close).toHaveBeenCalled();
  expect(client.leave).toHaveBeenCalledTimes(1);
  expect(fakes.command).toHaveBeenCalledWith("/meetings/meeting/leave");
  await connection.mic(true);
  await connection.camera(true);
});
test("screen sharing uses a second server identity and handles capture ending", async () => {
  const connection = await createMeetingConnection("meeting", renderers());
  await connection.join(false, false);
  expect(await connection.share()).toBe(true);
  expect(fakes.clients).toHaveLength(2);
  expect(fakes.token).toHaveBeenLastCalledWith("/meetings/meeting/token", expect.anything(), {
    method: "POST",
    body: { screen: true },
  });
  expect(await connection.share()).toBe(false);
  expect(fakes.screen.close).toHaveBeenCalled();
  await connection.share();
  const handler = fakes.screen.on.mock.calls.at(-1)![1];
  handler();
  await vi.waitFor(() => expect(fakes.clients[2]!.leave).toHaveBeenCalled());
  await connection.close();
});
test("token renewal reauthorizes, including screen sharing, and closes on revoked access", async () => {
  vi.useFakeTimers();
  const view = renderers(),
    connection = await createMeetingConnection("meeting", view);
  await connection.join(false, false);
  await connection.share();
  await vi.advanceTimersByTimeAsync(25000);
  expect(fakes.clients[0]!.renewToken).toHaveBeenCalled();
  expect(fakes.clients[1]!.renewToken).toHaveBeenCalled();
  fakes.token.mockRejectedValueOnce(new Error("revoked"));
  fakes.clients[0]!.handlers.get("token-privilege-will-expire")!();
  await vi.advanceTimersByTimeAsync(1);
  expect(view.onError).toHaveBeenCalled();
  expect(fakes.clients[0]!.leave).toHaveBeenCalled();
});
test("expired credentials and join failures release devices", async () => {
  const view = renderers();
  await createMeetingConnection("meeting", view);
  fakes.clients[0]!.handlers.get("connection-state-change")!("RECONNECTING");
  expect(view.onState).toHaveBeenCalledWith("RECONNECTING");
  fakes.clients[0]!.handlers.get("token-privilege-did-expire")!();
  await vi.waitFor(() => expect(view.onError).toHaveBeenCalled());
  const second = await createMeetingConnection("meeting", renderers());
  fakes.clients[1]!.join.mockRejectedValueOnce(new Error("provider failed"));
  await expect(second.join(true, true)).rejects.toThrow(/./);
  expect(fakes.clients[1]!.leave).toHaveBeenCalled();
});

test("prejoin previews capture only selected devices and publish only after authorization", async () => {
  const view = renderers();
  const connection = await createMeetingConnection("meeting", view);
  await connection.preview(true, true);
  expect(fakes.clients[0]!.publish).not.toHaveBeenCalled();
  expect(fakes.token).not.toHaveBeenCalled();
  expect(fakes.video.play).toHaveBeenCalledWith(view.local);
  await connection.mic(false);
  await connection.camera(false);
  expect(fakes.audio.setEnabled).toHaveBeenCalledWith(false);
  expect(fakes.video.setEnabled).toHaveBeenCalledWith(false);
  await connection.join(true, true);
  expect(fakes.clients[0]!.publish).toHaveBeenCalledTimes(2);
  await connection.close();
});
test("a closed preview never enables devices and failed screen publishing releases capture", async () => {
  const connection = await createMeetingConnection("meeting", renderers());
  await connection.preview(false, false);
  await connection.close();
  await connection.join(false, false);
  expect(fakes.clients[0]!.join).not.toHaveBeenCalled();
  const second = await createMeetingConnection("meeting", renderers());
  await second.join(false, false);
  const original = fakes.sdk.createClient;
  fakes.sdk.createClient = () => {
    const client = original();
    client.publish.mockRejectedValueOnce(new Error("screen publish failed"));
    return client;
  };
  try {
    await expect(second.share()).rejects.toThrow("screen publish failed");
    expect(fakes.screen.close).toHaveBeenCalled();
  } finally {
    fakes.sdk.createClient = original;
    await second.close();
  }
});

test("camera capture completing after navigation is immediately released", async () => {
  let finish: (track: typeof fakes.video) => void = () => {};
  const original = fakes.sdk.createCameraVideoTrack;
  fakes.sdk.createCameraVideoTrack = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  const connection = await createMeetingConnection("meeting", renderers());
  const pending = connection.preview(false, true);
  await connection.close();
  finish(fakes.video);
  await pending;
  expect(fakes.video.close).toHaveBeenCalled();
  expect(fakes.clients[0]!.publish).not.toHaveBeenCalled();
  fakes.sdk.createCameraVideoTrack = original;
});

test("revoked screen credentials release the selected capture before publication", async () => {
  const connection = await createMeetingConnection("meeting", renderers());
  await connection.join(false, false);
  fakes.token.mockRejectedValueOnce(new Error("revoked"));
  await expect(connection.share()).rejects.toThrow("revoked");
  expect(fakes.screen.close).toHaveBeenCalled();
  expect(fakes.clients).toHaveLength(1);
  await connection.close();
});
test("leaving while screen authorization is pending cannot resurrect capture", async () => {
  const connection = await createMeetingConnection("meeting", renderers());
  await connection.join(false, false);
  let finish: (value: unknown) => void = () => {};
  fakes.token.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const sharing = connection.share();
  await vi.waitFor(() => expect(fakes.screen.on).toHaveBeenCalled());
  await connection.close();
  finish({ appId: "app", channel: "channel", token: "token", uid: "screen" });
  expect(await sharing).toBe(false);
  expect(fakes.clients).toHaveLength(1);
});
