/* oxlint-disable jsx-a11y/prefer-tag-over-role -- A multiline textarea combobox needs a focus-preserving rich listbox; native select cannot render member avatars. */
import { messengerMembersSchema } from "@lumo/contracts/messenger";
import { ErrorMessage, Textarea, cn } from "@lumo/ui";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useId, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";

import { api } from "../../lib/api";
import { mentionSearch, updateMentionDraft, type MentionDraft } from "./mention-text";
import { messengerKey, messengerPath } from "./messenger-api";
import { MemberAvatar } from "./presence";

function caretPosition(input: HTMLTextAreaElement) {
  const mirror = document.createElement("div"),
    style = getComputedStyle(input);
  for (const property of [
    "font",
    "line-height",
    "letter-spacing",
    "padding",
    "border-width",
    "box-sizing",
    "word-break",
    "overflow-wrap",
    "tab-size",
  ])
    mirror.style.setProperty(property, style.getPropertyValue(property));
  Object.assign(mirror.style, {
    position: "fixed",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    width: `${input.clientWidth}px`,
    overflowWrap: "break-word",
    left: "-9999px",
  });
  mirror.textContent = input.value.slice(0, input.selectionStart);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  mirror.append(marker);
  document.body.append(mirror);
  const rect = input.getBoundingClientRect(),
    x = rect.left + marker.offsetLeft - input.scrollLeft,
    y = rect.top + marker.offsetTop - input.scrollTop;
  mirror.remove();
  return {
    left: Math.max(12, Math.min(innerWidth - 292, x)),
    top: Math.max(12, Math.min(innerHeight - 220, y + 24)),
  };
}
export function MentionInput({
  workspaceId,
  conversationId,
  draft,
  onDraft,
  onTyping,
  onSubmit,
  inputRef,
  ...props
}: Omit<ComponentProps<typeof Textarea>, "value" | "onChange" | "ref"> & {
  workspaceId: string;
  conversationId: string;
  draft: MentionDraft;
  onDraft: (draft: MentionDraft) => void;
  onTyping?: () => void;
  onSubmit?: () => void;
  inputRef?: { current: HTMLTextAreaElement | null };
}) {
  const localRef = useRef<HTMLTextAreaElement>(null),
    input = inputRef ?? localRef;
  const overlay = useRef<HTMLDivElement>(null),
    listId = useId();
  const [search, setSearch] = useState<ReturnType<typeof mentionSearch>>(null),
    [active, setActive] = useState(0),
    [position, setPosition] = useState({ left: 12, top: 12 }),
    [composing, setComposing] = useState(false);
  const members = useQuery({
    queryKey: [...messengerKey(workspaceId), "mention-members", conversationId, search?.q],
    queryFn: ({ signal }) =>
      api(
        `${messengerPath(workspaceId, conversationId)}/members?limit=20&q=${encodeURIComponent(search?.q ?? "")}`,
        messengerMembersSchema,
        { signal },
      ),
    enabled: !!search,
    retry: false,
  });
  const options = members.data?.members ?? [];
  const updateSearch = (node: HTMLTextAreaElement) => {
    if (composing) return;
    const caret = node.selectionStart;
    if (draft.mentions.some((mention) => caret >= mention.start && caret <= mention.end + 1)) {
      setSearch(null);
      return;
    }
    const match = mentionSearch(node.value, caret);
    if (match && draft.mentions.some((mention) => mention.start === match.start)) {
      setSearch(null);
      return;
    }
    setSearch(match);
    setActive(0);
    if (match) setPosition(caretPosition(node));
  };
  const choose = (member: (typeof options)[number]) => {
    if (!search || !input.current) return;
    const value = "@" + member.name,
      text = draft.text.slice(0, search.start) + value + " " + draft.text.slice(search.end);
    if (text.length > 4000 || draft.mentions.length >= 20) return;
    const next = updateMentionDraft(draft, text);
    onDraft({
      ...next,
      mentions: [
        ...next.mentions,
        {
          start: search.start,
          end: search.start + value.length,
          userId: member.userId,
          name: member.name,
        },
      ].sort((a, b) => a.start - b.start),
    });
    setSearch(null);
    onTyping?.();
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(
        search.start + value.length + 1,
        search.start + value.length + 1,
      );
    });
  };
  const highlights = draft.mentions.map((mention, index) => {
    const before = draft.text.slice(draft.mentions[index - 1]?.end ?? 0, mention.start);
    return (
      <Fragment key={`${mention.start}:${mention.userId}`}>
        {before}
        <mark className="rounded-sm bg-accent text-transparent">
          {draft.text.slice(mention.start, mention.end)}
        </mark>
      </Fragment>
    );
  });
  return (
    <div className="relative min-w-0">
      <div
        ref={overlay}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-md px-3 py-2 text-sm leading-5 whitespace-pre-wrap wrap-anywhere text-transparent"
      >
        {highlights}
        {draft.text.slice(draft.mentions.at(-1)?.end ?? 0)}
        {"\n"}
      </div>
      <Textarea
        {...props}
        ref={input}
        value={draft.text}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={!!search}
        aria-controls={search ? listId : undefined}
        aria-activedescendant={search && options[active] ? `${listId}-${active}` : undefined}
        className={cn("relative bg-transparent leading-5", props.className)}
        onChange={(event) => {
          onDraft(updateMentionDraft(draft, event.target.value));
          updateSearch(event.currentTarget);
          onTyping?.();
        }}
        onSelect={(event) => updateSearch(event.currentTarget)}
        onCompositionStart={() => {
          setComposing(true);
          setSearch(null);
        }}
        onCompositionEnd={(event) => {
          setComposing(false);
          const match = mentionSearch(
            event.currentTarget.value,
            event.currentTarget.selectionStart,
          );
          setSearch(match);
          if (match) setPosition(caretPosition(event.currentTarget));
        }}
        onScroll={(event) => {
          if (overlay.current) overlay.current.scrollTop = event.currentTarget.scrollTop;
          setSearch(null);
        }}
        onBlur={() => setSearch(null)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || composing) return;
          if (search) {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setSearch(null);
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setActive(
                (value) =>
                  (value + (event.key === "ArrowDown" ? 1 : -1) + Math.max(1, options.length)) %
                  Math.max(1, options.length),
              );
              return;
            }
            if ((event.key === "Enter" || event.key === "Tab") && options[active]) {
              event.preventDefault();
              choose(options[active]);
              return;
            }
          }
          if (search && event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            return;
          }
          if (event.key === "Enter" && !event.shiftKey && onSubmit) {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      {search &&
        createPortal(
          <div
            className="fixed z-50 w-70 max-w-[calc(100vw-24px)] rounded-lg border bg-elevated p-1 shadow-lg"
            style={position}
          >
            <div className="px-2 py-1 text-xs text-muted-foreground">
              Mention a conversation member
            </div>
            <div
              id={listId}
              role="listbox"
              aria-label="Mention suggestions"
              className="max-h-40 overflow-y-auto"
            >
              {options.map((member, index) => (
                <div
                  key={member.userId}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm",
                    index === active && "bg-accent text-accent-foreground",
                  )}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    choose(member);
                  }}
                >
                  <MemberAvatar
                    userId={member.userId}
                    name={member.name}
                    src={member.image ?? undefined}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate">{member.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {member.role} · {member.userId.slice(-4)}
                  </span>
                </div>
              ))}
            </div>
            {members.isPending && <p className="p-2 text-xs">Finding members…</p>}
            {!members.isPending && !options.length && !members.isError && (
              <p className="p-2 text-xs">No eligible members found.</p>
            )}
            {members.data?.nextOffset != null && (
              <p className="px-2 text-xs">Keep typing to narrow the results.</p>
            )}
            <ErrorMessage error={members.error} />
          </div>,
          document.body,
        )}
    </div>
  );
}
