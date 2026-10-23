import { describe, expect, test } from "vitest";

import { readServerEnv } from "./server.ts";
import { readWebEnv } from "./web.ts";

const valid = {
  DATABASE_URL: "postgresql://test:password@localhost/lumo_test",
  BETTER_AUTH_SECRET: "a".repeat(48),
};

const production = {
  ...valid,
  NODE_ENV: "production",
  API_ORIGIN: "https://api.example.com",
  WEB_ORIGIN: "https://example.com",
  RESEND_API_KEY: "re_synthetic_test_key",
  EMAIL_FROM: "hello@lumolynk.com",
};

describe("production email configuration", () => {
  test.each([undefined, "", "   "])(
    "rejects missing or blank Resend credentials",
    (RESEND_API_KEY) => {
      expect(() => readServerEnv({ ...production, RESEND_API_KEY })).toThrow("RESEND_API_KEY");
    },
  );
  test.each([
    undefined,
    "hello@other.com",
    "hello@sub.lumolynk.com",
    "hello@lumolynk.com.attacker.com",
    "Lumo <hello@lumolynk.com>",
  ])("requires a sender address at the verified domain: %s", (EMAIL_FROM) => {
    expect(() => readServerEnv({ ...production, EMAIL_FROM })).toThrow("EMAIL_FROM");
  });
  test("accepts a configured sender with a default or custom display name", () => {
    expect(readServerEnv(production)).toMatchObject({
      EMAIL_FROM: "hello@lumolynk.com",
      EMAIL_FROM_NAME: "Lumo",
    });
    expect(readServerEnv({ ...production, EMAIL_FROM_NAME: "Lumo Support" }).EMAIL_FROM_NAME).toBe(
      "Lumo Support",
    );
  });
  test.each(["", "Lumo\r\nBcc: other@example.com", "Lumo <other@example.com>"])(
    "rejects invalid display names without echoing them",
    (EMAIL_FROM_NAME) => {
      expect(() => readServerEnv({ ...production, EMAIL_FROM_NAME })).toThrow("EMAIL_FROM_NAME");
      expect(() => readServerEnv({ ...production, EMAIL_FROM_NAME })).not.toThrow(
        EMAIL_FROM_NAME || "synthetic-private-value",
      );
    },
  );
  test("email configuration errors and browser config exclude secrets", () => {
    const config = {
      ...production,
      RESEND_API_KEY: "re_private_secret",
      EMAIL_FROM: "private-value",
    };
    expect(() => readServerEnv(config)).toThrow("EMAIL_FROM");
    expect(() => readServerEnv(config)).not.toThrow("re_private_secret");
    expect(() => readServerEnv(config)).not.toThrow("private-value");
    expect(readWebEnv(config)).toEqual({ VITE_API_URL: "" });
  });
});

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
  test("requires HTTPS and Resend in production", () => {
    expect(() => readServerEnv({ ...valid, NODE_ENV: "production" })).toThrow("HTTPS");
    expect(() =>
      readServerEnv({
        ...valid,
        NODE_ENV: "production",
        API_ORIGIN: "https://api.example.com",
        WEB_ORIGIN: "https://example.com",
      }),
    ).toThrow("RESEND_API_KEY");
    expect(
      readServerEnv({
        ...valid,
        NODE_ENV: "production",
        API_ORIGIN: "https://api.example.com",
        WEB_ORIGIN: "https://example.com",
        RESEND_API_KEY: "re_synthetic_test_key",
        EMAIL_FROM: "hello@lumolynk.com",
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

test("RTC configuration validates server-only credentials without echoing them", () => {
  expect(() =>
    readServerEnv({ ...valid, AGORA_APP_CERTIFICATE: "private-bad-certificate" }),
  ).toThrow("AGORA_APP_CERTIFICATE");
  expect(() =>
    readServerEnv({ ...valid, AGORA_APP_CERTIFICATE: "private-bad-certificate" }),
  ).not.toThrow("private-bad-certificate");
  expect(
    readServerEnv({ ...valid, AGORA_APP_ID: "a".repeat(32), AGORA_APP_CERTIFICATE: "b".repeat(32) })
      .AGORA_APP_ID,
  ).toBe("a".repeat(32));
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

const office = {
  ONLYOFFICE_DOCUMENT_SERVER_URL: "https://docs.example.com",
  ONLYOFFICE_PUBLIC_API_BASE_URL: "https://api.example.com",
  ONLYOFFICE_JWT_SECRET: "synthetic-tenant-secret-for-tests-only",
};
test("ONLYOFFICE is optional together, with server-only settings and an explicit deployment mode", () => {
  expect(readServerEnv(valid).ONLYOFFICE_DOCUMENT_SERVER_URL).toBeUndefined();
  expect(readServerEnv({ ...valid, ...office })).toMatchObject({
    ...office,
    ONLYOFFICE_MODE: "cloud",
  });
  expect(
    readServerEnv({ ...valid, ...office, ONLYOFFICE_MODE: "self-hosted" }).ONLYOFFICE_MODE,
  ).toBe("self-hosted");
  expect(
    readWebEnv({ ...office, VITE_ONLYOFFICE_JWT_SECRET: office.ONLYOFFICE_JWT_SECRET }),
  ).toEqual({ VITE_API_URL: "" });
});

test.each([
  "ONLYOFFICE_DOCUMENT_SERVER_URL",
  "ONLYOFFICE_PUBLIC_API_BASE_URL",
  "ONLYOFFICE_JWT_SECRET",
] as const)(
  "rejects partial ONLYOFFICE configuration missing %s without echoing secrets",
  (field) => {
    expect(() => readServerEnv({ ...valid, ...office, [field]: undefined })).toThrow(field);
    expect(() => readServerEnv({ ...valid, ...office, [field]: undefined })).not.toThrow(
      office.ONLYOFFICE_JWT_SECRET,
    );
  },
);

test.each([
  "http://docs.example.com",
  "https://docs.example.com/",
  "https://docs.example.com/path",
  "https://docs.example.com?token=secret",
  "https://user:secret@docs.example.com",
  "https://docs.example.com#fragment",
  "https://localhost",
  "https://127.0.0.1",
  "https://[::1]",
])("ONLYOFFICE requires exact external HTTPS origins: %s", (url) => {
  for (const field of ["ONLYOFFICE_DOCUMENT_SERVER_URL", "ONLYOFFICE_PUBLIC_API_BASE_URL"])
    expect(() => readServerEnv({ ...valid, ...office, [field]: url })).toThrow(field);
});

test("rejects weak ONLYOFFICE secrets and unknown modes without exposing their values", () => {
  expect(() =>
    readServerEnv({ ...valid, ...office, ONLYOFFICE_JWT_SECRET: "private-short-value" }),
  ).toThrow("ONLYOFFICE_JWT_SECRET");
  expect(() =>
    readServerEnv({ ...valid, ...office, ONLYOFFICE_JWT_SECRET: "private-short-value" }),
  ).not.toThrow("private-short-value");
  expect(() => readServerEnv({ ...valid, ...office, ONLYOFFICE_MODE: "docspace" })).toThrow(
    "ONLYOFFICE_MODE",
  );
});

test("S3-compatible settings preserve AWS defaults and validate custom endpoints and key pairs", () => {
  const storage = { ...valid, AWS_REGION: "us-east-1", AWS_S3_BUCKET: "private-bucket" };
  expect(readServerEnv(storage)).toMatchObject({ S3_FORCE_PATH_STYLE: false });
  expect(readServerEnv({ ...storage, S3_FORCE_PATH_STYLE: "false" }).S3_FORCE_PATH_STYLE).toBe(
    false,
  );
  expect(readServerEnv({ ...storage, S3_FORCE_PATH_STYLE: "true" }).S3_FORCE_PATH_STYLE).toBe(true);
  expect(() => readServerEnv({ ...storage, S3_FORCE_PATH_STYLE: "yes" })).toThrow(
    "S3_FORCE_PATH_STYLE",
  );
  expect(
    readServerEnv({
      ...storage,
      S3_ENDPOINT: "https://nyc3.digitaloceanspaces.com",
      S3_ACCESS_KEY_ID: "spaces-key",
      S3_SECRET_ACCESS_KEY: "synthetic-secret",
    }).S3_ENDPOINT,
  ).toBe("https://nyc3.digitaloceanspaces.com");
  for (const field of ["S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) {
    expect(() => readServerEnv({ ...storage, [field]: "synthetic-secret" })).toThrow("together");
    expect(() => readServerEnv({ ...storage, [field]: "synthetic-secret" })).not.toThrow(
      "synthetic-secret",
    );
  }
  expect(() =>
    readServerEnv({ ...valid, S3_ENDPOINT: "https://nyc3.digitaloceanspaces.com" }),
  ).toThrow("AWS_S3_BUCKET");
});

test.each([
  "ftp://example.com",
  "https://nyc3.digitaloceanspaces.com/bucket",
  "https://nyc3.digitaloceanspaces.com/",
  "https://example.com?secret=value",
  "https://example.com#fragment",
  "https://user:private-password@example.com",
])("rejects invalid S3 endpoint %s without echoing credentials", (S3_ENDPOINT) => {
  const source = {
    ...valid,
    AWS_REGION: "us-east-1",
    AWS_S3_BUCKET: "private-bucket",
    S3_ENDPOINT,
  };
  expect(() => readServerEnv(source)).toThrow("S3_ENDPOINT");
  expect(() => readServerEnv(source)).not.toThrow("private-password");
});

test("production S3 endpoints require HTTPS", () => {
  expect(() =>
    readServerEnv({
      ...valid,
      NODE_ENV: "production",
      API_ORIGIN: "https://api.example.com",
      WEB_ORIGIN: "https://app.example.com",
      RESEND_API_KEY: "re_synthetic_test_key",
      EMAIL_FROM: "hello@lumolynk.com",
      AWS_REGION: "us-east-1",
      AWS_S3_BUCKET: "private-bucket",
      S3_ENDPOINT: "http://nyc3.digitaloceanspaces.com",
    }),
  ).toThrow("S3_ENDPOINT: HTTPS is required");
});

test("storage provider defaults to AWS and Spaces requires its origin and dedicated credentials", () => {
  expect(readServerEnv(valid).STORAGE_PROVIDER).toBe("aws");
  expect(() => readServerEnv({ ...valid, STORAGE_PROVIDER: "other" })).toThrow("STORAGE_PROVIDER");
  const spaces = {
    ...valid,
    STORAGE_PROVIDER: "digitalocean",
    AWS_REGION: "us-east-1",
    AWS_S3_BUCKET: "private-space",
    S3_ENDPOINT: "https://nyc3.digitaloceanspaces.com",
    S3_ACCESS_KEY_ID: "spaces-key",
    S3_SECRET_ACCESS_KEY: "synthetic-secret",
  };
  expect(readServerEnv(spaces).STORAGE_PROVIDER).toBe("digitalocean");
  for (const field of [
    "AWS_REGION",
    "AWS_S3_BUCKET",
    "S3_ENDPOINT",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ])
    expect(() => readServerEnv({ ...spaces, [field]: undefined })).toThrow(field);
  for (const S3_ENDPOINT of [
    "https://bucket.nyc3.digitaloceanspaces.com",
    "https://nyc3.cdn.digitaloceanspaces.com",
    "https://nyc3.digitaloceanspaces.com.evil.test",
    "https://s3.amazonaws.com",
    "http://nyc3.digitaloceanspaces.com",
  ])
    expect(() => readServerEnv({ ...spaces, S3_ENDPOINT })).toThrow("S3_ENDPOINT");
});
