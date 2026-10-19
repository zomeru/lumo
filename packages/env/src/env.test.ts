import { describe, expect, test } from "vitest";

import { readServerEnv } from "./server.ts";
import { readWebEnv } from "./web.ts";

const valid = {
  DATABASE_URL: "postgresql://test:password@localhost/lumo_test",
  BETTER_AUTH_SECRET: "a".repeat(48),
};
describe("environment boundaries", () => {
  test("provides local defaults and coerces ports", () => {
    expect(readServerEnv({ ...valid, PORT: "3101" })).toMatchObject({
      PORT: 3101,
      HOST: "0.0.0.0",
      WEB_ORIGIN: "http://localhost:3000",
    });
  });
  test.each(["", "https://example.com/db", "postgresql://localhost"])(
    "rejects invalid database URL %s",
    (DATABASE_URL) => {
      expect(() => readServerEnv({ ...valid, DATABASE_URL })).toThrow("DATABASE_URL");
    },
  );
  test("requires secrets without leaking them", () => {
    expect(() => readServerEnv({ ...valid, BETTER_AUTH_SECRET: "very-secret" })).toThrow(
      "BETTER_AUTH_SECRET",
    );
    expect(() => readServerEnv({ ...valid, BETTER_AUTH_SECRET: "very-secret" })).not.toThrow(
      "very-secret",
    );
  });
  test.each(["http://localhost:3000/", "https://example.com/path", "ftp://example.com"])(
    "rejects non-origins %s",
    (WEB_ORIGIN) => {
      expect(() => readServerEnv({ ...valid, WEB_ORIGIN })).toThrow("WEB_ORIGIN");
    },
  );
  test("requires HTTPS and SMTP in production", () => {
    expect(() => readServerEnv({ ...valid, NODE_ENV: "production" })).toThrow("HTTPS");
    expect(() =>
      readServerEnv({
        ...valid,
        NODE_ENV: "production",
        API_ORIGIN: "https://api.example.com",
        WEB_ORIGIN: "https://example.com",
      }),
    ).toThrow("SMTP");
    expect(
      readServerEnv({
        ...valid,
        NODE_ENV: "production",
        API_ORIGIN: "https://api.example.com",
        WEB_ORIGIN: "https://example.com",
        SMTP_URL: "smtps://smtp.example.com",
      }).NODE_ENV,
    ).toBe("production");
  });
  test("validates only public configuration for the browser", () => {
    expect(readWebEnv({ DATABASE_URL: "private" })).toEqual({ VITE_API_URL: "" });
    expect(readWebEnv({ VITE_API_URL: "https://api.example.com" }).VITE_API_URL).toBe(
      "https://api.example.com",
    );
    expect(() => readWebEnv({ VITE_API_URL: "file:///secret" })).toThrow("VITE_API_URL");
  });
});

test("provider configuration rejects private values and insecure REST origins without echoing them", () => {
  for (const AGORA_CHAT_REST_ORIGIN of [
    "http://a61.chat.agora.io",
    "https://a61.chat.agora.io/path",
  ])
    expect(() => readServerEnv({ ...valid, AGORA_CHAT_REST_ORIGIN })).toThrow(
      "AGORA_CHAT_REST_ORIGIN",
    );
  expect(() =>
    readServerEnv({ ...valid, AGORA_APP_CERTIFICATE: "private-bad-certificate" }),
  ).not.toThrow("private-bad-certificate");
  expect(() => readServerEnv({ ...valid, AGORA_CHAT_APP_KEY: "without-app-name" })).toThrow(
    "AGORA_CHAT_APP_KEY",
  );
  expect(
    readServerEnv({
      ...valid,
      AGORA_APP_ID: "a".repeat(32),
      AGORA_APP_CERTIFICATE: "b".repeat(32),
      AGORA_CHAT_APP_KEY: "org#app",
      AGORA_CHAT_REST_ORIGIN: "https://a61.chat.agora.io",
    }).AGORA_CHAT_APP_KEY,
  ).toBe("org#app");
});

test("Drive configuration validates paired storage settings and MIME policy without exposing credentials", () => {
  expect(readServerEnv(valid).DRIVE_MAX_FILE_BYTES).toBe(1024 ** 3);
  expect(() => readServerEnv({ ...valid, AWS_REGION: "us-east-1" })).toThrow(
    "Configure AWS_REGION and AWS_S3_BUCKET together",
  );
  expect(() => readServerEnv({ ...valid, AWS_S3_BUCKET: "private-drive-bucket" })).toThrow(
    "AWS_S3_BUCKET",
  );
  expect(() => readServerEnv({ ...valid, DRIVE_ALLOWED_MIME_TYPES: "not a mime" })).toThrow(
    "DRIVE_ALLOWED_MIME_TYPES",
  );
  expect(
    readServerEnv({
      ...valid,
      AWS_REGION: "us-east-1",
      AWS_S3_BUCKET: "private-drive-bucket",
      DRIVE_ALLOWED_MIME_TYPES: "text/plain,image/*",
    }).AWS_REGION,
  ).toBe("us-east-1");
  expect(() => readServerEnv({ ...valid, DRIVE_MAX_FILE_BYTES: -1 })).toThrow(
    "DRIVE_MAX_FILE_BYTES",
  );
});
