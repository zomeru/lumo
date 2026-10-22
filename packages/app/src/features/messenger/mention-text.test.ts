import { expect, test } from "vitest";

import {
  decodeMentionBody,
  encodeMentionDraft,
  mentionSearch,
  updateMentionDraft,
} from "./mention-text";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
test("stable mentions round trip Unicode, spaces, punctuation and duplicate names", () => {
  const draft = {
    text: "Hello @李 小] and @李 小]",
    mentions: [
      { start: 6, end: 11, userId: id, name: "李 小]" },
      { start: 16, end: 21, userId: id, name: "李 小]" },
    ],
  };
  const encoded = encodeMentionDraft(draft);
  expect(encoded.mentionIds).toEqual([id]);
  expect(decodeMentionBody(encoded.body)).toEqual(draft);
});
test("editing and deleting token text removes identity, while surrounding changes move intact ranges", () => {
  const draft = { text: "Hi @Bob ok", mentions: [{ start: 3, end: 7, userId: id, name: "Bob" }] };
  expect(updateMentionDraft(draft, "Hey Hi @Bob ok").mentions[0]).toMatchObject({
    start: 7,
    end: 11,
  });
  expect(updateMentionDraft(draft, "Hi @Bo ok").mentions).toEqual([]);
  expect(updateMentionDraft(draft, "Hi  ok").mentions).toEqual([]);
  expect(updateMentionDraft(draft, "Hi @Bob okay").mentions).toEqual(draft.mentions);
});
test("autocomplete follows the caret and handles names with spaces without treating emails as mentions", () => {
  expect(mentionSearch("Hello @李 小 rest", 10)).toEqual({ start: 6, end: 10, q: "李 小" });
  expect(mentionSearch("email@example.com", 17)).toBeNull();
  expect(mentionSearch("Hello\n@", 7)).toEqual({ start: 6, end: 7, q: "" });
  expect(decodeMentionBody("@[%zz](user:" + id + ")").text).toContain("%zz");
});
