import type { EditorView } from "@codemirror/view";

export type WikiFormat =
  | "bold"
  | "italic"
  | "strike"
  | "inline-code"
  | "bullet"
  | "ordered"
  | "task"
  | "quote"
  | "code-block"
  | "table"
  | "rule";
export function formatWiki(view: EditorView, action: WikiFormat) {
  const { from, to } = view.state.selection.main,
    selected = view.state.sliceDoc(from, to);
  const marks = { bold: "**", italic: "*", strike: "~~", "inline-code": "`" };
  if (action in marks) {
    const mark = marks[action as keyof typeof marks];
    const wrapped =
      view.state.sliceDoc(Math.max(0, from - mark.length), from) === mark &&
      view.state.sliceDoc(to, to + mark.length) === mark;
    if (wrapped)
      view.dispatch({
        changes: [
          { from: from - mark.length, to: from, insert: "" },
          { from: to, to: to + mark.length, insert: "" },
        ],
        selection: { anchor: from - mark.length, head: to - mark.length },
        userEvent: "input.format",
      });
    else {
      const text = selected || "text";
      view.dispatch({
        changes: { from, to, insert: mark + text + mark },
        selection: { anchor: from + mark.length, head: from + mark.length + text.length },
        userEvent: "input.format",
      });
    }
  } else if (["bullet", "ordered", "task", "quote"].includes(action)) {
    const start = view.state.doc.lineAt(from),
      end = view.state.doc.lineAt(to);
    const lines = Array.from({ length: end.number - start.number + 1 }, (_, i) =>
      view.state.doc.line(start.number + i),
    );
    const prefix = (i: number) =>
      action === "ordered"
        ? `${i + 1}. `
        : action === "task"
          ? "- [ ] "
          : action === "quote"
            ? "> "
            : "- ";
    const pattern =
      action === "ordered"
        ? /^\d+\. /
        : action === "task"
          ? /^- \[[ xX]\] /
          : action === "quote"
            ? /^> /
            : /^[-*+] /;
    const remove = lines.every((line) => pattern.test(line.text));
    view.dispatch({
      changes: lines.map((line, i) => ({
        from: line.from,
        to: line.to,
        insert: remove ? line.text.replace(pattern, "") : prefix(i) + line.text,
      })),
      userEvent: "input.format",
    });
  } else {
    const insert =
      action === "code-block"
        ? `\n\n\`\`\`text\n${selected || "code"}\n\`\`\`\n\n`
        : action === "table"
          ? "\n\n| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |\n\n"
          : "\n\n---\n\n";
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      userEvent: "input.format",
    });
  }
  view.focus();
}
export function setWikiHeading(view: EditorView, level: number) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  view.dispatch({
    changes: {
      from: line.from,
      to: line.to,
      insert: (level ? "#".repeat(level) + " " : "") + line.text.replace(/^#{1,6}\s+/, ""),
    },
    userEvent: "input.format",
  });
  view.focus();
}
export function insertWikiLink(view: EditorView, url: string, label: string, image: boolean) {
  const parsed = new URL(url, "https://wiki.invalid");
  if (!(image ? ["https:", "http:"] : ["https:", "http:", "mailto:"]).includes(parsed.protocol))
    throw new Error("Use an HTTP, HTTPS or email link.");
  const { from, to } = view.state.selection.main;
  const text = (label || view.state.sliceDoc(from, to) || (image ? "Image" : "Link")).replace(
    /[[\]\\]/g,
    "\\$&",
  );
  const insert = `${image ? "!" : ""}[${text}](<${url.replace(/[<>\n\r]/g, "")}>)`;
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + insert.length },
    userEvent: "input.format",
  });
  view.focus();
}
