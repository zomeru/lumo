import { test, expect } from "vitest";

import { installStaticChatCodec } from "./chat-codec";
test("static protocol codecs round-trip authentication envelopes without runtime compilation", () => {
  const sdk = {
    prototype: {} as {
      root?: {
        lookup: (name: string) => {
          encode: (value: unknown) => { finish: () => Uint8Array };
          decode: (bytes: Uint8Array) => Record<string, unknown>;
        };
      };
    },
  };
  installStaticChatCodec(sdk);
  const codec = sdk.prototype.root!.lookup("easemob.pb.MSync");
  const bytes = codec.encode({ command: 3, version: 1, auth: "test-credential" }).finish();
  expect(codec.decode(bytes)).toMatchObject({ command: 3, version: 1, auth: "test-credential" });
  expect(() => sdk.prototype.root!.lookup("missing.Type")).toThrow("Unsupported Chat protocol");
  expect(() => sdk.prototype.root!.lookup("easemob.pb.MSync.missing")).toThrow(
    "Unsupported Chat protocol",
  );
  expect(() => sdk.prototype.root!.lookup("easemob.missing.Type")).toThrow(
    "Unsupported Chat protocol",
  );
});

test("static codecs are byte-compatible with the vendor reflection implementation", async () => {
  const module = await import("agora-chat");
  const imported = module.default;
  const sdk =
    "connection" in imported
      ? imported
      : (imported as unknown as { default: typeof imported }).default;
  const prototype = sdk.connection.prototype as unknown as {
    root: {
      lookup: (name: string) => {
        encode: (value: unknown) => { finish: () => Uint8Array };
        decode: (value: Uint8Array) => unknown;
      };
    };
  };
  const root = prototype.root;
  const payload = {
    command: 3,
    version: 1,
    auth: "test-credential",
    encryptType: [0],
    guid: { name: "testuser", appKey: "org#app" },
  };
  const original = root.lookup("easemob.pb.MSync").encode(payload).finish();
  installStaticChatCodec(sdk.connection);
  for (const [name, value] of [
    ["MSync", { command: 0, version: 1, encryptType: [0], payload: Uint8Array.of(1) }],
    ["StatisticsBody", { operation: 0, os: 0 }],
    ["CommSyncUL", { key: "0", queue: { name: "queue" } }],
    ["MessageBody.Content", { type: 0, text: "hello" }],
  ] as const) {
    expect([...prototype.root.lookup(`easemob.pb.${name}`).encode(value).finish()]).toEqual([
      ...root.lookup(`easemob.pb.${name}`).encode(value).finish(),
    ]);
  }
  const compiled = prototype.root.lookup("easemob.pb.MSync").encode(payload).finish();
  expect([...compiled]).toEqual([...original]);
  expect(JSON.stringify(prototype.root.lookup("easemob.pb.MSync").decode(original))).toBe(
    JSON.stringify(root.lookup("easemob.pb.MSync").decode(original)),
  );
});
