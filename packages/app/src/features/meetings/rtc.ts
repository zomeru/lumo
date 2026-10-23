import { rtcCredentialsSchema } from "@lumolynk/contracts/collaboration";
import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  ILocalVideoTrack,
} from "agora-rtc-sdk-ng/esm";

import { api, command } from "../../lib/api";
export async function createMeetingConnection(
  meetingId: string,
  renderers: {
    local: HTMLElement;
    remote: HTMLElement;
    onState: (value: string) => void;
    onError: (error: unknown) => void;
  },
) {
  const {
    setLogLevel,
    disableLogUpload,
    createClient,
    createMicrophoneAudioTrack,
    createCameraVideoTrack,
    createScreenVideoTrack,
    getCameras,
    getMicrophones,
  } = await import("agora-rtc-sdk-ng/esm");
  setLogLevel(4);
  disableLogUpload();
  const client = createClient({ mode: "rtc", codec: "vp8" });
  const token = (screen = false) =>
    api(`/meetings/${meetingId}/token`, rtcCredentialsSchema, { method: "POST", body: { screen } });
  let audio: IMicrophoneAudioTrack | undefined,
    video: ICameraVideoTrack | undefined,
    screenClient: IAgoraRTCClient | undefined,
    screenTracks: ILocalVideoTrack[] = [];
  let timer: ReturnType<typeof setInterval> | undefined,
    closed = false;
  let connected = false,
    audioPublished = false,
    videoPublished = false;
  const remoteNodes = new Map<string, HTMLElement>();
  const remove = (uid: string) => {
    remoteNodes.get(uid)?.remove();
    remoteNodes.delete(uid);
  };
  async function stopScreen() {
    const tracks = screenTracks;
    screenTracks = [];
    for (const track of tracks) {
      track.stop();
      track.close();
    }
    const current = screenClient;
    screenClient = undefined;
    await current?.leave();
  }
  async function close() {
    if (closed) return;
    closed = true;
    connected = false;
    clearInterval(timer);
    audio?.stop();
    audio?.close();
    audio = undefined;
    video?.stop();
    video?.close();
    video = undefined;
    client.removeAllListeners();
    await Promise.allSettled([
      stopScreen(),
      client.leave(),
      command(`/meetings/${meetingId}/leave`),
    ]);
    renderers.remote.replaceChildren();
    remoteNodes.clear();
    renderers.onState("Left meeting");
  }
  async function refresh() {
    try {
      const credentials = await token();
      if (closed) return;
      await client.renewToken(credentials.token);
      if (screenClient) {
        const credentials = await token(true);
        if (!closed) await screenClient?.renewToken(credentials.token);
      }
    } catch (error) {
      renderers.onError(error);
      await close();
    }
  }
  client.on("user-published", (user, mediaType) => {
    void (async () => {
      await client.subscribe(user, mediaType);
      if (closed) return;
      if (mediaType === "audio") user.audioTrack?.play();
      if (mediaType === "video") {
        const key = String(user.uid);
        remove(key);
        const node = document.createElement("div");
        node.dataset.videoTile = "";
        node.setAttribute("aria-label", `Video ${key}`);
        renderers.remote.append(node);
        remoteNodes.set(key, node);
        user.videoTrack?.play(node);
      }
    })().catch(renderers.onError);
  });
  client.on("user-left", (user) => remove(String(user.uid)));
  client.on("user-unpublished", (user, type) => {
    if (type === "video") remove(String(user.uid));
  });
  client.on("connection-state-change", (value) => {
    if (!closed) renderers.onState(value);
  });
  client.on("token-privilege-will-expire", () => {
    void refresh();
  });
  client.on("token-privilege-did-expire", () => {
    renderers.onError(new Error("Meeting credentials expired. Join again."));
    void close();
  });
  async function mic(enabled: boolean, device?: string) {
    if (closed) return;
    if (enabled && !audio) {
      const track = await createMicrophoneAudioTrack(device ? { microphoneId: device } : {});
      if (closed) {
        track.stop();
        track.close();
        return;
      }
      audio = track;
    } else if (audio) {
      if (device) await audio.setDevice(device);
      await audio.setEnabled(enabled);
    }
    if (enabled && audio && connected && !audioPublished) {
      await client.publish(audio);
      audioPublished = true;
    }
  }
  async function camera(enabled: boolean, device?: string) {
    if (closed) return;
    if (enabled && !video) {
      const track = await createCameraVideoTrack({
        encoderConfig: "480p_1",
        ...(device ? { cameraId: device } : {}),
      });
      if (closed) {
        track.stop();
        track.close();
        return;
      }
      video = track;
      video.play(renderers.local);
    } else if (video) {
      if (device) await video.setDevice(device);
      await video.setEnabled(enabled);
    }
    if (enabled && video && connected && !videoPublished) {
      await client.publish(video);
      videoPublished = true;
    }
  }
  return {
    async preview(microphone: boolean, cameraEnabled: boolean) {
      await Promise.all([mic(microphone), camera(cameraEnabled)]);
      renderers.onState("Preview ready. Devices are not published until you join.");
    },
    async join(microphone: boolean, cameraEnabled: boolean) {
      try {
        const credentials = await token();
        if (closed) return;
        await client.join(
          credentials.appId,
          credentials.channel,
          credentials.token,
          credentials.uid,
        );
        if (closed) {
          await client.leave();
          return;
        }
        connected = true;
        await Promise.all([mic(microphone), camera(cameraEnabled)]);
        timer = setInterval(() => {
          void refresh();
        }, 25000);
        renderers.onState("CONNECTED");
      } catch (error) {
        await close();
        throw error;
      }
    },
    mic,
    camera,
    close,
    devices: async () => ({
      cameras: await getCameras(),
      microphones: await getMicrophones(),
    }),
    async share() {
      if (screenClient) {
        await stopScreen();
        return false;
      }
      // Start the native picker within the user's action; network authorization
      // happens before publication, without consuming the capture gesture.
      const track = await createScreenVideoTrack({ encoderConfig: "720p_2" }, "disable");
      if (closed) {
        track.stop();
        track.close();
        return false;
      }
      screenTracks = [track];
      track.on("track-ended", () => {
        void stopScreen().then(
          () => renderers.onState("Screen sharing stopped"),
          renderers.onError,
        );
      });
      try {
        const credentials = await token(true);
        if (closed || !screenTracks.length) {
          await stopScreen();
          return false;
        }
        const current = createClient({ mode: "rtc", codec: "vp8" });
        screenClient = current;
        current.on("token-privilege-will-expire", () => {
          void refresh();
        });
        await current.join(
          credentials.appId,
          credentials.channel,
          credentials.token,
          credentials.uid,
        );
        if (closed || screenClient !== current) {
          await current.leave();
          return false;
        }
        await current.publish(track);
        return true;
      } catch (error) {
        await stopScreen();
        throw error;
      }
    },
  };
}
