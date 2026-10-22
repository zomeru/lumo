/** Native Node fetch and Chromium sockets share one explicit loopback origin. */
export function desktopApiOrigin() {
  const origin = new URL(process.env.LUMO_E2E_API_ORIGIN ?? "http://localhost:3011");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))
    throw new Error("Desktop acceptance requires a loopback API origin.");
  origin.hostname = "127.0.0.1";
  return origin.origin;
}
