import { describe, test, expect } from "vitest";

import { externalUrl, remoteOrigin, requestSchema, trustedRenderer, rendererCsp } from "./policy";
describe("desktop trust boundaries", () => {
  test("trusts only application and explicitly configured development origins", () => {
    expect(trustedRenderer("lumo://app/login")).toBe(true);
    expect(trustedRenderer("http://localhost:5174/login", "http://localhost:5174")).toBe(true);
    for (const url of ["https://evil.test", "lumo://evil/login", "file:///etc/passwd", "invalid"])
      expect(trustedRenderer(url)).toBe(false);
  });
  test.each([
    "https://evil.test/api/v1/me",
    "//evil.test/api/v1/me",
    "/api/v1/../auth/secret",
    "/api/v1/%2e%2e/secret",
    "/api/v1/a\\b",
    "/api/auth/get-session",
    "/api/auth/verify-email",
  ])("rejects unbounded path %s", (path) =>
    expect(requestSchema.safeParse({ path }).success).toBe(false),
  );
  test("bounds bodies and methods and allows real APIs", () => {
    expect(
      requestSchema.safeParse({ path: "/api/v1/me", method: "PATCH", body: { name: "Alice" } })
        .success,
    ).toBe(true);
    expect(
      requestSchema.safeParse({ path: "/api/v1/me", headers: { cookie: "stolen" } }).success,
    ).toBe(false);
    expect(requestSchema.safeParse({ path: "/api/v1/me", method: "CONNECT" }).success).toBe(false);
    expect(requestSchema.safeParse({ path: "/api/v1/me", body: "a".repeat(32769) }).success).toBe(
      false,
    );
  });
  test("requires secure exact origins and safe external links", () => {
    for (const value of [
      "http://evil.test",
      "https://example.com/path",
      "file:///etc/passwd",
      "https://user:pass@example.com",
    ])
      expect(() => remoteOrigin(value)).toThrow(/./);
    expect(remoteOrigin("http://localhost:3001")).toBe("http://localhost:3001");
    expect(remoteOrigin("https://api.example.com")).toBe("https://api.example.com");
    expect(externalUrl("https://lumo.test/invite?token=abc", "https://lumo.test")).toContain(
      "/invite",
    );
    for (const value of [
      "javascript:alert(1)",
      "https://evil.test",
      "https://user:pass@lumo.test",
      null,
    ])
      expect(() => externalUrl(value, "https://lumo.test")).toThrow(/./);
  });
});

test("development and packaged policies deny runtime script evaluation and scope HMR", () => {
  const production = rendererCsp();
  expect(production).toContain("script-src 'self';");
  expect(production).not.toContain("unsafe-eval");
  expect(production).toContain(
    "media-src 'self' blob: https://*.amazonaws.com https://*.amazonaws.com.cn https://*.digitaloceanspaces.com;",
  );
  expect(production).toContain(
    "frame-src https://*.amazonaws.com https://*.amazonaws.com.cn https://*.digitaloceanspaces.com;",
  );
  expect(production).not.toContain("ws://");
  const development = rendererCsp("http://127.0.0.1:5174", "random-nonce");
  expect(development).toContain("script-src 'self' 'nonce-random-nonce'");
  expect(development).toContain("ws://127.0.0.1:5174");
  expect(development).not.toContain("unsafe-eval");
  expect(rendererCsp("http://127.0.0.1:5174")).not.toContain("nonce-");
});

test("desktop permits bounded avatar uploads only at their dedicated endpoint", () => {
  const body = { data: "a".repeat(40000), mimeType: "image/webp" };
  expect(requestSchema.safeParse({ path: "/api/v1/me/avatar", method: "PUT", body }).success).toBe(
    true,
  );
  expect(requestSchema.safeParse({ path: "/api/v1/me", method: "PUT", body }).success).toBe(false);
  expect(requestSchema.safeParse({ path: "/api/v1/me/avatar", method: "POST", body }).success).toBe(
    false,
  );
  expect(
    requestSchema.safeParse({
      path: "/api/v1/me/avatar",
      method: "PUT",
      body: "a".repeat(7 * 1024 * 1024),
    }).success,
  ).toBe(false);
});
