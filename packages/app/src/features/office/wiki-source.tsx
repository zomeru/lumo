import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { EditorState, Prec } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import {
  Button,
  Tooltip,
  TooltipProvider,
  SelectField,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Field,
  ErrorMessage,
} from "@lumolynk/ui";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Code,
  SquareCode,
  Link,
  Image,
  Table,
  Minus,
  Undo2,
  Redo2,
} from "lucide-react";
import { useEffect, useRef, useState, useDeferredValue } from "react";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import type { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";

import { formatWiki, insertWikiLink, setWikiHeading, type WikiFormat } from "./wiki-formatting";
import WikiPreview from "./wiki-preview";

export type WikiConnection = { doc: Y.Doc; provider: WebsocketProvider; editable: boolean };
const tools = [
  ["bold", "Bold", Bold, "Mod-b"],
  ["italic", "Italic", Italic, "Mod-i"],
  ["strike", "Strikethrough", Strikethrough, "Mod-Shift-x"],
  ["bullet", "Bullet list", List],
  ["ordered", "Numbered list", ListOrdered],
  ["task", "Task list", ListTodo],
  ["quote", "Blockquote", Quote],
  ["inline-code", "Inline code", Code, "Mod-e"],
  ["code-block", "Code block", SquareCode],
  ["table", "Table", Table],
  ["rule", "Horizontal rule", Minus],
] as const;
type Mode = "edit" | "preview" | "split";
export default function WikiSource({ connection }: { connection: WikiConnection }) {
  const host = useRef<HTMLDivElement>(null),
    view = useRef<EditorView | null>(null),
    undo = useRef<Y.UndoManager | null>(null);
  const [source, setSource] = useState(() => connection.doc.getText("markdown").toJSON()),
    [mode, setMode] = useState<Mode>(connection.editable ? "split" : "preview"),
    [active, setActive] = useState<string[]>([]),
    [heading, setHeading] = useState("0"),
    [history, setHistory] = useState({ undo: false, redo: false });
  const [link, setLink] = useState<"link" | "image" | null>(null),
    [url, setUrl] = useState(""),
    [label, setLabel] = useState(""),
    [error, setError] = useState<Error | null>(null);
  const preview = useDeferredValue(source);
  useEffect(() => {
    if (!host.current) return;
    const text = connection.doc.getText("markdown"),
      manager = new Y.UndoManager(text);
    undo.current = manager;
    const changed = () => setSource(text.toJSON());
    text.observe(changed);
    const updateHistory = () => setHistory({ undo: manager.canUndo(), redo: manager.canRedo() });
    manager.on("stack-item-added", updateHistory);
    manager.on("stack-item-popped", updateHistory);
    manager.on("stack-cleared", updateHistory);
    const format = (action: WikiFormat) => {
      if (!view.current || !connection.editable) return false;
      manager.stopCapturing();
      formatWiki(view.current, action);
      manager.stopCapturing();
      return true;
    };
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: text.toJSON(),
        extensions: [
          lineNumbers(),
          drawSelection(),
          highlightActiveLine(),
          EditorView.lineWrapping,
          syntaxHighlighting(defaultHighlightStyle),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          EditorState.readOnly.of(!connection.editable),
          EditorView.editable.of(connection.editable),
          EditorView.contentAttributes.of({
            role: "textbox",
            "aria-label": "Wiki content",
            "aria-multiline": "true",
            "aria-readonly": String(!connection.editable),
            spellcheck: "true",
          }),
          EditorView.theme({
            "&": {
              height: "100%",
              backgroundColor: "var(--color-surface)",
              color: "var(--color-foreground)",
            },
            ".cm-scroller": { overflow: "auto", fontFamily: "monospace", lineHeight: "1.7" },
            ".cm-content": { padding: "1rem" },
            ".cm-gutters": {
              backgroundColor: "var(--color-muted)",
              color: "var(--color-muted-foreground)",
              borderColor: "var(--color-border)",
            },
            ".cm-activeLine": { backgroundColor: "var(--color-accent)" },
            ".cm-cursor": { borderLeftColor: "var(--color-foreground)" },
            "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
              backgroundColor: "var(--color-accent)",
            },
          }),
          yCollab(text, connection.provider.awareness, { undoManager: manager }),
          Prec.highest(
            keymap.of(
              tools
                .filter((tool) => tool.length === 4)
                .map((tool) => ({ key: tool[3]!, run: () => format(tool[0]) })),
            ),
          ),
          keymap.of([...yUndoManagerKeymap, ...defaultKeymap, indentWithTab]),
          EditorView.updateListener.of((update) => {
            if (!update.selectionSet && !update.docChanged) return;
            const nodes = [];
            let node = syntaxTree(update.state).resolveInner(update.state.selection.main.head, -1);
            while (node) {
              nodes.push(node.name);
              if (!node.parent) break;
              node = node.parent;
            }
            setActive(nodes);
            setHeading(
              String(
                update.state.doc
                  .lineAt(update.state.selection.main.head)
                  .text.match(/^(#{1,6})\s/)?.[1]?.length ?? 0,
              ),
            );
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      view.current = null;
      undo.current = null;
      text.unobserve(changed);
      editor.destroy();
      manager.destroy();
    };
  }, [connection]);
  function apply(action: WikiFormat) {
    if (view.current && connection.editable) {
      undo.current?.stopCapturing();
      formatWiki(view.current, action);
      undo.current?.stopCapturing();
    }
  }
  function isActive(action: WikiFormat) {
    const names = {
      bold: "StrongEmphasis",
      italic: "Emphasis",
      strike: "Strikethrough",
      bullet: "BulletList",
      ordered: "OrderedList",
      task: "Task",
      quote: "Blockquote",
      "inline-code": "InlineCode",
      "code-block": "FencedCode",
      table: "Table",
      rule: "HorizontalRule",
    };
    return active.some((name) => name.includes(names[action]));
  }
  function switchMode(value: Mode) {
    setMode(value);
    requestAnimationFrame(() => {
      view.current?.requestMeasure();
      if (value !== "preview") view.current?.focus();
    });
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TooltipProvider>
        <div
          aria-label="Markdown formatting"
          role="toolbar"
          className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-surface p-2"
        >
          {mode !== "preview" && (
            <>
              {tools.map(([action, name, Icon, shortcut]) => (
                <Tooltip
                  key={action}
                  content={shortcut ? `${name} (${shortcut.replace("Mod", "Ctrl/⌘")})` : name}
                >
                  <Button
                    size="icon"
                    variant={isActive(action) ? "secondary" : "ghost"}
                    aria-label={name}
                    aria-pressed={isActive(action)}
                    aria-keyshortcuts={shortcut?.replace("Mod", "Control").replaceAll("-", "+")}
                    disabled={!connection.editable}
                    onClick={() => apply(action)}
                  >
                    <Icon aria-hidden="true" />
                  </Button>
                </Tooltip>
              ))}
              <SelectField
                label="Heading"
                value={heading}
                disabled={!connection.editable}
                options={[
                  { value: "0", label: "Paragraph" },
                  ...Array.from({ length: 6 }, (_, i) => ({
                    value: String(i + 1),
                    label: `H${i + 1}`,
                  })),
                ]}
                onValueChange={(level) => {
                  if (view.current) setWikiHeading(view.current, Number(level));
                }}
              />
              {(["link", "image"] as const).map((type) => (
                <Tooltip key={type} content={type === "image" ? "Image" : "Link"}>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={type === "image" ? "Insert image" : "Insert link"}
                    disabled={!connection.editable}
                    onClick={() => {
                      setLink(type);
                      setUrl("");
                      setLabel(
                        view.current?.state.sliceDoc(
                          view.current.state.selection.main.from,
                          view.current.state.selection.main.to,
                        ) ?? "",
                      );
                      setError(null);
                    }}
                  >
                    {type === "image" ? <Image aria-hidden="true" /> : <Link aria-hidden="true" />}
                  </Button>
                </Tooltip>
              ))}
              <Tooltip content="Undo (Ctrl/⌘ Z)">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Undo"
                  disabled={!connection.editable || !history.undo}
                  onClick={() => {
                    undo.current?.undo();
                    view.current?.focus();
                  }}
                >
                  <Undo2 aria-hidden="true" />
                </Button>
              </Tooltip>
              <Tooltip content="Redo (Ctrl/⌘ Shift Z)">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Redo"
                  disabled={!connection.editable || !history.redo}
                  onClick={() => {
                    undo.current?.redo();
                    view.current?.focus();
                  }}
                >
                  <Redo2 aria-hidden="true" />
                </Button>
              </Tooltip>
            </>
          )}
          <fieldset className="ml-auto flex gap-1" aria-label="Editor mode">
            {(["edit", "preview", "split"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={mode === value ? "secondary" : "ghost"}
                aria-pressed={mode === value}
                onClick={() => switchMode(value)}
              >
                {value === "edit" ? "Edit" : value === "preview" ? "Preview" : "Split"}
              </Button>
            ))}
          </fieldset>
        </div>
      </TooltipProvider>
      <div className={`wiki-panes ${mode === "split" ? "wiki-split" : ""}`}>
        <div className="wiki-source" hidden={mode === "preview"} ref={host} />
        {mode !== "edit" && (
          <div className="wiki-preview-pane">
            <WikiPreview source={preview} />
          </div>
        )}
      </div>
      {link && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setLink(null);
          }}
        >
          <DialogContent>
            <DialogTitle>{link === "image" ? "Insert image" : "Insert link"}</DialogTitle>
            <DialogDescription>
              Use a web URL. Embedded HTML and scripts are not allowed.
            </DialogDescription>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  if (view.current) insertWikiLink(view.current, url, label, link === "image");
                  setLink(null);
                } catch (cause) {
                  setError(cause instanceof Error ? cause : new Error("Invalid URL"));
                }
              }}
            >
              <ErrorMessage error={error} />
              <Field
                label="URL"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
              <Field
                label={link === "image" ? "Alternative text" : "Link text"}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
              <Button type="submit">Insert</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
