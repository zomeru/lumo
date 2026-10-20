import { expect, test } from "vitest";
import * as Y from "yjs";

import { initialWikiDocument, wikiMarkdown } from "./wiki-markdown";
const markdown =
  "# Heading 中文\n\n## Subheading\n\n- one\n- two\n\n1. ordered\n2. list\n\n```ts\nconst answer = 42;\n```\n\n[link](https://example.com) and *emphasis* and **strong** and `code`\n\n> quote\n\n---\n";
test("Wiki Yjs round trips CommonMark headings, fences, links, lists and Unicode", () => {
  const doc = initialWikiDocument(markdown);
  const restored = new Y.Doc();
  Y.applyUpdate(restored, Y.encodeStateAsUpdate(doc));
  const result = wikiMarkdown(restored);
  expect(result).toContain("# Heading 中文");
  expect(result).toContain("## Subheading");
  expect(result).toContain("```ts\nconst answer = 42;\n```");
  expect(result).toContain("[link](https://example.com)");
  expect(result).toContain("*emphasis*");
  expect(result).toContain("**strong**");
  expect(result).toContain("`code`");
  expect(result).toContain("> quote");
  expect(wikiMarkdown(initialWikiDocument(result))).toBe(result);
  doc.destroy();
  restored.destroy();
});
test("concurrent edits converge and deletions survive serialization/reopening", () => {
  const seed = initialWikiDocument("# Shared\n");
  const a = new Y.Doc(),
    b = new Y.Doc();
  const state = Y.encodeStateAsUpdate(seed);
  Y.applyUpdate(a, state);
  Y.applyUpdate(b, state);
  const ax = a.getText("markdown"),
    bx = b.getText("markdown");
  ax.insert(6, " Alice");
  bx.insert(6, " Bob");
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  expect(wikiMarkdown(a)).toBe(wikiMarkdown(b));
  ax.delete(0, 6);
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  expect(wikiMarkdown(b)).not.toContain("Shared");
  for (const doc of [seed, a, b]) doc.destroy();
});
test("legacy unsafe links are rejected and raw source content remains text", () => {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph"),
    text = new Y.XmlText();
  text.insert(0, "safe");
  paragraph.insert(0, [text]);
  doc.getXmlFragment("prosemirror").insert(0, [paragraph]);
  text.format(0, 4, { link: { href: "javascript:alert(1)" } });
  expect(() => wikiMarkdown(doc)).toThrow("Wiki links must");
  doc.destroy();
  const html = initialWikiDocument("<script>alert(1)</script>\n");
  expect(wikiMarkdown(html)).toContain("script");
  html.destroy();
});

test("legacy blocks and marks retain their Markdown semantics during migration", () => {
  const doc = new Y.Doc();
  function block(type: string, content?: string, attrs: Record<string, string> = {}) {
    const node = new Y.XmlElement(type);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (content) {
      const text = new Y.XmlText();
      text.insert(0, content);
      node.insert(0, [text]);
    }
    return node;
  }
  const paragraph = block("paragraph", "emphasis code link");
  const bullet = block("bullet_list"),
    ordered = block("ordered_list");
  for (const list of [bullet, ordered]) {
    const item = block("list_item");
    item.insert(0, [block("paragraph", "entry")]);
    list.insert(0, [item]);
  }
  doc
    .getXmlFragment("prosemirror")
    .insert(0, [
      block("heading", "Title", { level: "6" }),
      paragraph,
      block("code_block", "const n = 1;", { language: "ts" }),
      block("hr"),
      bullet,
      ordered,
      block("image", undefined, { src: "https://example.com/image.png", alt: "safe" }),
      block("html", undefined, { value: "<script>text</script>" }),
    ]);
  const text = paragraph.get(0) as Y.XmlText;
  text.format(0, 8, { emphasis: {} });
  text.format(9, 4, { inlineCode: {} });
  text.format(14, 4, { link: { href: "https://example.com" } });
  const result = wikiMarkdown(doc);
  expect(result).toContain("###### Title");
  expect(result).toContain("*emphasis* `code` [link](https://example.com)");
  expect(result).toContain("```ts\nconst n = 1;");
  expect(result).toContain("* entry");
  expect(result).toContain("1. entry");
  expect(result).toContain("![safe](https://example.com/image.png)");
  expect(result).toContain("script");
  doc.destroy();
});

test("source validation rejects invalid roots, metadata and NUL text", () => {
  for (const mutate of [
    (doc: Y.Doc) => doc.getMap("unexpected").set("x", 1),
    (doc: Y.Doc) => doc.getMap("wiki").set("extra", true),
    (doc: Y.Doc) => doc.getText("markdown").insert(0, "\0"),
  ]) {
    const doc = initialWikiDocument("valid");
    mutate(doc);
    expect(() => wikiMarkdown(doc)).toThrow(/Reload the Wiki editor|UTF-8/);
    doc.destroy();
  }
  const empty = new Y.Doc();
  expect(wikiMarkdown(empty)).toBe("");
  empty.destroy();
});

test("legacy images reject unsafe sources and excessive nesting is bounded", () => {
  const doc = new Y.Doc(),
    image = new Y.XmlElement("image");
  image.setAttribute("src", "data:text/html,payload");
  doc.getXmlFragment("prosemirror").insert(0, [image]);
  expect(() => wikiMarkdown(doc)).toThrow("Wiki links must");
  doc.destroy();
  const nested = new Y.Doc();
  let parent = new Y.XmlElement("blockquote");
  nested.getXmlFragment("prosemirror").insert(0, [parent]);
  for (let i = 0; i < 66; i++) {
    const child = new Y.XmlElement("blockquote");
    parent.insert(0, [child]);
    parent = child;
  }
  expect(() => wikiMarkdown(nested)).toThrow("nesting depth");
  nested.destroy();
});
