import { defaultMarkdownSerializer, schema } from "prosemirror-markdown";
import { yXmlFragmentToProsemirrorJSON } from "y-prosemirror";
import * as Y from "yjs";
import { z } from "zod";

import { AppError } from "../../lib/errors";

type RichNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};
const nodeSchema: z.ZodType<RichNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    text: z.string().optional(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    marks: z
      .array(z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() }))
      .optional(),
    content: z.array(nodeSchema).optional(),
  }),
);
const names: Record<string, string> = {
  horizontal_rule: "hr",
  hard_break: "hardbreak",
  em: "emphasis",
  code: "inlineCode",
};
const inverse = Object.fromEntries(Object.entries(names).map(([a, b]) => [b, a]));
function convert(node: RichNode, depth = 0): RichNode {
  if (depth > 64)
    throw new AppError(400, "WIKI_TOO_DEEP", "Wiki content exceeds the supported nesting depth.");
  const type = inverse[node.type] ?? node.type,
    attrs = { ...node.attrs };
  function safeUrl(value: unknown) {
    if (
      typeof value !== "string" ||
      !["http:", "https:", "mailto:"].includes(new URL(value, "https://wiki.invalid").protocol)
    )
      throw new AppError(400, "WIKI_UNSAFE_LINK", "Wiki links must use HTTP, HTTPS or email URLs.");
  }
  if (node.type === "image") safeUrl(attrs.src);
  for (const mark of node.marks ?? []) if (mark.type === "link") safeUrl(mark.attrs?.href);
  if (node.type === "heading")
    attrs.level = z.coerce.number().int().min(1).max(6).parse(attrs.level);
  if (node.type === "code_block") {
    attrs.params = attrs.language ?? "";
    delete attrs.language;
  }
  if (["bullet_list", "ordered_list"].includes(node.type)) {
    attrs.tight = attrs.spread !== true;
    delete attrs.spread;
  }
  if (type === "html")
    return {
      type: "paragraph",
      content: [{ type: "text", text: typeof attrs.value === "string" ? attrs.value : "" }],
    };
  return {
    ...node,
    type,
    attrs,
    marks: node.marks?.map((mark) => ({
      ...mark,
      type: inverse[mark.type] ?? mark.type,
    })),
    content: node.content?.map((v) => convert(v, depth + 1)),
  };
}
const WIKI_FORMAT = "markdown-v1";
export function isSourceWiki(document: Y.Doc) {
  return document.getMap("wiki").get("format") === WIKI_FORMAT;
}
export function initialWikiDocument(markdown: string) {
  const doc = new Y.Doc();
  doc.getMap("wiki").set("format", WIKI_FORMAT);
  doc.getText("markdown").insert(0, markdown);
  return doc;
}
export function wikiMarkdown(document: Y.Doc) {
  if (isSourceWiki(document)) {
    if (
      [...document.share.keys()].some((key) => key !== "markdown" && key !== "wiki") ||
      document.getMap("wiki").size !== 1
    )
      throw new AppError(400, "WIKI_INVALID_STATE", "Reload the Wiki editor before editing.");
    const source = document.getText("markdown").toJSON();
    if (source.includes("\0"))
      throw new AppError(400, "WIKI_INVALID_TEXT", "Wiki content must be UTF-8 text.");
    return source;
  }
  // Legacy Milkdown snapshots remain readable for history and upgrade on opening.

  const json = nodeSchema.parse(
    yXmlFragmentToProsemirrorJSON(document.getXmlFragment("prosemirror")),
  );
  const normalized = convert(json);
  if (!normalized.content?.length) return "";
  return defaultMarkdownSerializer.serialize(schema.nodeFromJSON(normalized)) + "\n";
}
