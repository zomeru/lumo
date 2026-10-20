import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, expect, test } from "vitest";

import { formatWiki, insertWikiLink, setWikiHeading } from "./wiki-formatting";
const views: EditorView[] = [];
function editor(text = "one\ntwo", from = 0, to = text.length) {
  const view = new EditorView({
    parent: document.body,
    state: EditorState.create({ doc: text, selection: { anchor: from, head: to } }),
  });
  views.push(view);
  return view;
}
afterEach(() => {
  for (const view of views.splice(0)) view.destroy();
});
test.each([
  ["bold", "**"],
  ["italic", "*"],
  ["strike", "~~"],
  ["inline-code", "`"],
] as const)("%s wraps the selection and toggles its surrounding marks", (format, mark) => {
  const view = editor("text");
  formatWiki(view, format);
  expect(view.state.doc.toString()).toBe(mark + "text" + mark);
  formatWiki(view, format);
  expect(view.state.doc.toString()).toBe("text");
});
test.each([
  ["bullet", "- one\n- two"],
  ["ordered", "1. one\n2. two"],
  ["task", "- [ ] one\n- [ ] two"],
  ["quote", "> one\n> two"],
] as const)("%s formats selected lines and toggles back", (format, expected) => {
  const view = editor();
  formatWiki(view, format);
  expect(view.state.doc.toString()).toBe(expected);
  formatWiki(view, format);
  expect(view.state.doc.toString()).toBe("one\ntwo");
});
test("headings, code fences, tables and rules insert actual Markdown", () => {
  const view = editor("title");
  for (let i = 1; i <= 6; i++) {
    setWikiHeading(view, i);
    expect(view.state.doc.toString()).toBe("#".repeat(i) + " title");
  }
  setWikiHeading(view, 0);
  expect(view.state.doc.toString()).toBe("title");
  for (const action of ["code-block", "table", "rule"] as const) {
    const v = editor("");
    formatWiki(v, action);
    expect(v.state.doc.toString()).toContain(
      action === "code-block" ? "```text" : action === "table" ? "| --- | --- |" : "---",
    );
  }
});
test("links and images escape labels and reject unsafe protocols", () => {
  const view = editor("title");
  insertWikiLink(view, "https://example.com", "[title]", false);
  expect(view.state.doc.toString()).toContain("\\[title\\]");
  const image = editor("");
  insertWikiLink(image, "https://example.com/image.png", "Alt", true);
  expect(image.state.doc.toString()).toBe("![Alt](<https://example.com/image.png>)");
  expect(() => insertWikiLink(image, "javascript:alert(1)", "bad", false)).toThrow("Use an HTTP");
  expect(() => insertWikiLink(image, "data:text/html,x", "bad", true)).toThrow("Use an HTTP");
});
