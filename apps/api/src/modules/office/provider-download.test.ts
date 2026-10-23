import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import { readServerEnv } from "@lumolynk/env/server";
import { beforeEach, expect, test, vi } from "vitest";

import { createOfficeProvider, OFFICE_MAX_BYTES } from "./provider";
const network = vi.hoisted(() => ({
  addresses: [{ address: "8.8.8.8", family: 4 }],
  status: 200,
  length: "4",
  chunks: [Buffer.from("file")],
  fail: false,
  pinned: [] as { address: string; family: number }[],
}));
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn<() => Promise<typeof network.addresses>>(async () => network.addresses),
}));
type TestGet = (
  _url: URL,
  options: {
    lookup: (
      host: string,
      options: unknown,
      callback: (error: Error | null, address: string, family: number) => void,
    ) => void;
  },
  callback: (response: Readable & { statusCode: number; headers: Record<string, string> }) => void,
) => EventEmitter;
vi.mock("node:https", () => ({
  get: vi.fn<TestGet>((_url, options, callback) => {
    const request = new EventEmitter();
    queueMicrotask(() => {
      if (network.fail) {
        request.emit("error", new Error("private diagnostic"));
        return;
      }
      options.lookup("ignored", {}, (_error, address, family) => {
        network.pinned.push({ address, family });
      });
      const response = Object.assign(Readable.from(network.chunks), {
        statusCode: network.status,
        headers: { "content-length": network.length },
      });
      callback(response);
    });
    return request;
  }),
}));
const env = readServerEnv({
    DATABASE_URL: "postgres://localhost/test",
    BETTER_AUTH_SECRET: "test-secret-with-thirty-two-characters",
    ONLYOFFICE_DOCUMENT_SERVER_URL: "https://office.example.com",
    ONLYOFFICE_JWT_SECRET: "provider-secret-with-thirty-two-characters",
    ONLYOFFICE_PUBLIC_API_BASE_URL: "https://api.example.com",
  }),
  provider = createOfficeProvider(env);
beforeEach(() => {
  network.addresses = [{ address: "8.8.8.8", family: 4 }];
  network.status = 200;
  network.length = "4";
  network.chunks = [Buffer.from("file")];
  network.fail = false;
  network.pinned = [];
});
async function bytes() {
  const stream = await provider.download("https://office.example.com/cache/file");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}
test("public IPv4 is allowed without being blocked by IPv4-mapped IPv6 deny rules", async () => {
  expect(await bytes()).toEqual(Buffer.from("file"));
  expect(network.pinned).toEqual([{ address: "8.8.8.8", family: 4 }]);
});
test("public IPv6 is pinned too; reserved IPv4/IPv6 and mixed DNS answers are rejected", async () => {
  network.addresses = [{ address: "2606:4700:4700::1111", family: 6 }];
  expect(await bytes()).toEqual(Buffer.from("file"));
  for (const [address, family] of [
    ["127.0.0.1", 4],
    ["169.254.169.254", 4],
    ["10.0.0.1", 4],
    ["::1", 6],
    ["::ffff:127.0.0.1", 6],
    ["fc00::1", 6],
    ["fe80::1", 6],
  ] as const) {
    network.addresses = [{ address, family }];
    await expect(bytes()).rejects.toThrow("public address");
  }
  network.addresses = [
    { address: "8.8.8.8", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ];
  await expect(bytes()).rejects.toThrow("public address");
  network.addresses = [];
  await expect(bytes()).rejects.toThrow("public address");
});
test("HTTP redirects/errors, advertised and streamed oversize, and TLS failures retain last revision", async () => {
  network.status = 302;
  await expect(bytes()).rejects.toThrow("bounded saved file");
  network.status = 200;
  network.length = String(OFFICE_MAX_BYTES + 1);
  await expect(bytes()).rejects.toThrow("bounded saved file");
  network.length = "";
  network.chunks = [Buffer.alloc(OFFICE_MAX_BYTES), Buffer.from("overflow")];
  await expect(bytes()).rejects.toThrow("editor limit");
  network.fail = true;
  await expect(bytes()).rejects.toThrow("Unable to retrieve");
});
