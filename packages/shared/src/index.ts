/** Stable provider identities, scoped to workspace; no PII or user-controlled names. */
export const chatIdentity = (workspaceId: string, userId: string) =>
  `${workspaceId.replaceAll("-", "")}${userId.replaceAll("-", "")}`;
export const rtcIdentity = (userId: string, screen = false) =>
  `${userId}${screen ? "-screen" : ""}`;
export type ChatMessage = {
  id: string;
  text: string;
  sender: string;
  time: number;
  pending?: boolean;
  failed?: boolean;
};
export function mergeMessages(previous: ChatMessage[], incoming: ChatMessage[]) {
  return [
    ...new Map([...previous, ...incoming].map((message) => [message.id, message])).values(),
  ].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}
/** Parse only known Lumo destinations, without browser/native URL globals. */
export function parseLumoLink(
  value: string,
  webOrigin: string,
): { kind: "invite"; token: string } | { kind: "meeting"; id: string } {
  if (value.length > 2048 || !value.startsWith(`${webOrigin}/`))
    throw new Error("Use a link from your Lumo server.");
  const [path, query] = value.slice(webOrigin.length).split("?", 2);
  const token = query
    ?.split("&")
    .find((part) => part.startsWith("token="))
    ?.slice(6);
  if (path === "/invite" && token && /^[a-f0-9]{64}$/.test(token)) return { kind: "invite", token };
  const match = /^\/meetings\/([a-f0-9-]{36})$/.exec(path ?? "");
  if (match && !query) return { kind: "meeting", id: match[1]! };
  throw new Error("Paste a valid Lumo invitation or meeting link.");
}
