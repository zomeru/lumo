import { themes, tokens } from "@lumo/ui/tokens";
import { describe, expect, test } from "vitest";

import { createVerificationEmail } from "./verification-email.ts";

const input = {
  to: "alice@example.com",
  name: "Alice",
  url: "https://api.example.com/api/auth/verify-email?token=example&callbackURL=https%3A%2F%2Fexample.com%2Fworkspaces",
};

describe("verification email template", () => {
  test("preserves the subject, plain text and local preview action link", () => {
    expect(createVerificationEmail(input)).toMatchObject({
      to: input.to,
      subject: "Verify your Lumo email",
      text: `Verify your email to accept workspace invitations:\n${input.url}`,
      url: input.url,
    });
  });

  test("renders the platform brand, tokens, accessible action and expiry", () => {
    const { html } = createVerificationEmail(input);
    expect(html).toContain('lang="en"');
    expect(html).toContain("Everything, connected.");
    expect(html).toContain("Hi Alice,");
    expect(html).toContain("Verify email address</a>");
    expect(html).toContain("This link expires in 1 hour.");
    expect(html).toContain("you can safely ignore it.");
    expect(html).toContain(`background-color:${themes.light.primary}`);
    expect(html).toContain(`border-radius:${tokens.radius.md}px`);
    expect(html).toContain(`background-color: ${themes.dark.background} !important`);
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).not.toMatch(/<script|<img|<link|url\(|var\(--|display:flex|display:grid/);
  });

  test("escapes names and URLs in HTML while keeping the original plain-text link", () => {
    const url = "https://example.com/verify?token=example&value=\"<tag>'";
    const { html, text } = createVerificationEmail({
      ...input,
      name: "<img src=x onerror=\"bad()\"> & 'Alice'",
      url,
    });
    expect(html).toContain("Hi &lt;img src=x onerror=&quot;bad()&quot;&gt; &amp; &#39;Alice&#39;,");
    expect(html).not.toContain("<img");
    const escaped = "https://example.com/verify?token=example&amp;value=&quot;&lt;tag&gt;&#39;";
    expect(html?.split(`href="${escaped}"`)).toHaveLength(3);
    expect(html).toContain(`>${escaped}</a>`);
    expect(text).toContain(url);
  });

  test.each([undefined, "", "   "])("uses a neutral greeting when no name is available", (name) => {
    expect(createVerificationEmail({ ...input, name }).html).toContain("Hi there,");
  });

  test.each(["javascript:alert(1)", "data:text/html,example", "file:///tmp/example"])(
    "rejects unsafe action protocols",
    (url) => {
      expect(() => createVerificationEmail({ ...input, url })).toThrow("absolute HTTP(S) URL");
    },
  );
});
