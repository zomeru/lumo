import { expect, test } from "vitest";

import { messageReactionSchema } from "./messenger";

test.each(["👍🏽", "❤️", "👩‍💻", "🇵🇭", "1️⃣", "🦊", "🏳️‍🌈", "👨‍👩‍👧‍👦"])(
  "accepts a single emoji grapheme %s",
  (emoji) => {
    expect(messageReactionSchema.safeParse({ emoji, active: true }).success).toBe(true);
  },
);
test.each(["", "hello", "👍👍", "<script>", "a‍b", "©hello", "🇵", "🏽"])(
  "rejects invalid reaction %s",
  (emoji) => {
    expect(messageReactionSchema.safeParse({ emoji, active: true }).success).toBe(false);
  },
);
