import { themes, tokens } from "@lumolynk/ui/tokens";

import type { EmailMessage } from "./email.ts";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character]!;
  });
}

export function createVerificationEmail({
  to,
  name,
  url,
}: {
  to: string;
  name?: string;
  url: string;
}): EmailMessage {
  if (!/^https?:$/.test(new URL(url).protocol))
    throw new Error("Verification email requires an absolute HTTP(S) URL");
  const light = themes.light;
  const dark = themes.dark;
  const href = escapeHtml(url);
  const greeting = name?.trim() ? `Hi ${escapeHtml(name.trim())},` : "Hi there,";
  const font = escapeHtml(tokens.fontFamily);

  return {
    to,
    subject: "Verify your LumoLynk email",
    text: `Verify your email to accept workspace invitations:\n${url}`,
    url,
    // Inline styles and presentation tables keep the baseline usable without CSS support.
    // Import only platform-independent tokens; email rendering does not depend on React or Tailwind.
    html: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>Verify your LumoLynk email</title>
  <style>
    a:focus-visible { outline: 2px solid ${light.ring}; outline-offset: 4px; }
    @media only screen and (max-width: 600px) {
      .email-outer { padding: 28px 16px !important; }
      .email-content { padding: 28px 24px !important; }
      .email-heading { font-size: 26px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-canvas { background-color: ${dark.background} !important; }
      .email-card { background-color: ${dark.surface} !important; border-color: ${dark.border} !important; }
      .email-heading, .email-brand { color: ${dark.foreground} !important; }
      .email-muted { color: ${dark["muted-foreground"]} !important; }
      .email-link { color: ${dark.primary} !important; }
      .email-button-cell, .email-button { background-color: ${dark.primary} !important; border-color: ${dark.primary} !important; color: ${dark["primary-foreground"]} !important; }
      .email-divider { border-color: ${dark.border} !important; }
    }
  </style>
</head>
<body class="email-canvas" style="margin:0;padding:0;background-color:${light.background};font-family:${font};color:${light.foreground};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;" aria-hidden="true">Your people, all in one place. Verify your email to get connected.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-canvas" bgcolor="${light.background}" style="width:100%;background-color:${light.background};">
    <tr><td align="center" class="email-outer" style="padding:48px 24px;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">
        <tr><td style="padding:0 4px 28px;">
          <p class="email-brand" style="margin:0;color:${light.foreground};font-size:26px;font-weight:600;line-height:32px;letter-spacing:-1px;">lumolynk<span class="email-link" style="color:${light.primary};">.</span></p>
          <p class="email-muted" style="margin:4px 0 0;color:${light["muted-foreground"]};font-size:12px;line-height:20px;">Everything, connected.</p>
        </td></tr>
        <tr><td class="email-card email-content" bgcolor="${light.surface}" style="padding:40px;background-color:${light.surface};border:1px solid ${light.border};border-radius:${tokens.radius.xl}px;">
          <main>
            <p class="email-link" style="margin:0 0 12px;color:${light.primary};font-size:12px;font-weight:600;line-height:20px;">Welcome to LumoLynk</p>
            <h1 class="email-heading" style="margin:0 0 24px;color:${light.foreground};font-size:30px;font-weight:600;line-height:1.2;letter-spacing:-0.7px;">Verify your email</h1>
            <p class="email-muted" style="margin:0 0 12px;color:${light["muted-foreground"]};font-size:14px;line-height:24px;word-break:break-word;overflow-wrap:anywhere;">${greeting}</p>
            <p class="email-muted" style="margin:0 0 28px;color:${light["muted-foreground"]};font-size:14px;line-height:24px;">Good work starts with connection. Confirm your email address to accept workspace invitations and connect with your team.</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
              <td class="email-button-cell" align="center" bgcolor="${light.primary}" style="background-color:${light.primary};border-radius:${tokens.radius.md}px;mso-padding-alt:12px 24px;">
                <a class="email-button" href="${href}" style="display:inline-block;padding:12px 24px;border:1px solid ${light.primary};border-radius:${tokens.radius.md}px;background-color:${light.primary};color:${light["primary-foreground"]};font-family:${font};font-size:14px;font-weight:600;line-height:20px;text-decoration:none;text-align:center;mso-padding-alt:0;">Verify email address</a>
              </td>
            </tr></table>
            <p class="email-muted" style="margin:14px 0 28px;color:${light["muted-foreground"]};font-size:12px;line-height:20px;">This link expires in 1 hour.</p>
            <div class="email-divider" style="padding-top:24px;border-top:1px solid ${light.border};">
              <p class="email-muted" style="margin:0 0 8px;color:${light["muted-foreground"]};font-size:12px;line-height:20px;">If the button doesn’t work, copy and paste this link into your browser:</p>
              <p style="margin:0;font-size:12px;line-height:20px;word-break:break-all;overflow-wrap:anywhere;"><a class="email-link" href="${href}" style="color:${light.primary};text-decoration:underline;word-break:break-all;">${href}</a></p>
            </div>
          </main>
        </td></tr>
        <tr><td style="padding:24px 4px 0;">
          <p class="email-muted" style="margin:0 0 12px;color:${light["muted-foreground"]};font-size:12px;line-height:20px;">If you didn’t create a LumoLynk account or request this email, you can safely ignore it.</p>
          <p class="email-muted" style="margin:0;color:${light["muted-foreground"]};font-size:12px;line-height:20px;">LumoLynk · Your people, all in one place.</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`,
  };
}
