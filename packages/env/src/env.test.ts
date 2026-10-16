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
      HOST: "127.0.0.1",
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
