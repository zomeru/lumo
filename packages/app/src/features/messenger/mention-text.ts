type MentionRange = { start: number; end: number; userId: string; name: string };
export type MentionDraft = { text: string; mentions: MentionRange[] };
/** Retain only intact tokens; text edits inside one deliberately remove its identity. */
export function updateMentionDraft(previous: MentionDraft, text: string): MentionDraft {
  let start = 0;
  while (
    start < previous.text.length &&
    start < text.length &&
    previous.text[start] === text[start]
  )
    start++;
  let oldEnd = previous.text.length,
    newEnd = text.length;
  while (oldEnd > start && newEnd > start && previous.text[oldEnd - 1] === text[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  const delta = newEnd - oldEnd;
  return {
    text,
    mentions: previous.mentions.flatMap((m) =>
      m.end <= start
        ? [m]
        : m.start >= oldEnd
          ? [{ ...m, start: m.start + delta, end: m.end + delta }]
          : [],
    ),
  };
}
export function encodeMentionDraft(draft: MentionDraft) {
  let body = draft.text;
  for (const mention of [...draft.mentions].sort((a, b) => b.start - a.start))
    body =
      body.slice(0, mention.start) +
      `@[${encodeURIComponent(mention.name)}](user:${mention.userId})` +
      body.slice(mention.end);
  return { body: body.trim(), mentionIds: [...new Set(draft.mentions.map((m) => m.userId))] };
}
export function decodeMentionBody(body: string): MentionDraft {
  const mentions: MentionRange[] = [];
  let text = "",
    end = 0;
  for (const match of body.matchAll(/@\[([^\]]*)\]\(user:([0-9a-f-]{36})\)/g)) {
    let name: string;
    try {
      name = decodeURIComponent(match[1]!);
    } catch {
      continue;
    }
    text += body.slice(end, match.index);
    const start = text.length;
    text += "@" + name;
    mentions.push({ start, end: text.length, userId: match[2]!, name });
    end = match.index + match[0].length;
  }
  return { text: text + body.slice(end), mentions };
}
export function mentionSearch(text: string, caret: number) {
  const match = /(?:^|\s)@([^@\n]{0,100})$/u.exec(text.slice(0, caret));
  return match ? { start: caret - match[1]!.length - 1, end: caret, q: match[1]! } : null;
}
