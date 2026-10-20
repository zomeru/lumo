import { fileOwnership } from "@lumo/contracts/files";
import { officeDetailSchema } from "@lumo/contracts/office";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  SelectField,
  Field,
  ErrorMessage,
  Loading,
  EmptyState,
} from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, ChevronRight, Plus, Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { api, command, sessionQuery } from "../../lib/api";
import { NewDocument } from "./new-document";
import { wikiPath, wikiQuery } from "./office-api";
import { OfficePage } from "./office-page";
export function WikiPage({ workspaceId, id }: { workspaceId: string; id?: string }) {
  const tree = useQuery(wikiQuery(workspaceId));
  const actor = useQuery(sessionQuery());
  const [creating, setCreating] = useState<{ parent: string | null } | null>(null),
    [managing, setManaging] = useState(false),
    [search, setSearch] = useState(""),
    [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const client = useQueryClient(),
    navigate = useNavigate();
  const [parent, setParent] = useState("root"),
    [position, setPosition] = useState(1);
  const pages = tree.data?.pages ?? [],
    page = pages.find((v) => v.item.id === id);
  const matching = new Set<string>();
  for (const candidate of pages) {
    if (!candidate.item.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
      continue;
    let next: string | null = candidate.item.id;
    while (next && !matching.has(next)) {
      matching.add(next);
      next = pages.find((v) => v.item.id === next)?.parentId ?? null;
    }
  }
  const operation = useMutation({
    mutationFn: async (type: "move" | "trash" | "copy") => {
      if (!id) return;
      if (type === "copy")
        return api(`${wikiPath(workspaceId)}/${id}/copy`, officeDetailSchema, {
          method: "POST",
          body: {},
        });
      if (type === "trash") return command(`${wikiPath(workspaceId)}/${id}`, "DELETE");
      return command(`${wikiPath(workspaceId)}/${id}`, "PATCH", {
        parentId: parent === "root" ? null : parent,
        position: position - 1,
      });
    },
    onSuccess: async () => {
      setManaging(false);
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      await navigate({ to: "/w/$workspaceId/wiki", params: { workspaceId } });
    },
  });
  function descendants(candidate: string): boolean {
    let next: string | null = candidate;
    const seen = new Set<string>();
    while (next && !seen.has(next)) {
      if (next === id) return true;
      seen.add(next);
      next = pages.find((v) => v.item.id === next)?.parentId ?? null;
    }
    return false;
  }
  function nodes(parentId: string | null, depth = 0): ReactNode {
    if (depth > 63) return null;
    return pages
      .filter((v) => v.parentId === parentId && matching.has(v.item.id))
      .map((v) => (
        <li key={v.item.id}>
          <div className="flex items-center">
            {pages.some((child) => child.parentId === v.item.id) && (
              <Button
                size="icon"
                variant="ghost"
                className="size-6 shrink-0"
                aria-label={`${collapsed.has(v.item.id) ? "Expand" : "Collapse"} ${v.item.name}`}
                aria-expanded={Boolean(search.trim()) || !collapsed.has(v.item.id)}
                onClick={() =>
                  setCollapsed((previous) => {
                    const next = new Set(previous);
                    if (next.has(v.item.id)) next.delete(v.item.id);
                    else next.add(v.item.id);
                    return next;
                  })
                }
              >
                <ChevronRight
                  aria-hidden="true"
                  className={collapsed.has(v.item.id) && !search.trim() ? undefined : "rotate-90"}
                />
              </Button>
            )}
            <Link
              to="/w/$workspaceId/wiki/$pageId"
              params={{ workspaceId, pageId: v.item.id }}
              className="block min-w-0 flex-1 truncate rounded px-2 py-1.5 text-sm hover:bg-muted aria-[current=page]:bg-accent"
              title={v.item.name}
            >
              {v.item.name.replace(/\.md$/i, "")}
            </Link>
            {actor.data && (
              <Badge className="shrink-0 text-[9px]">
                {fileOwnership(v.item.ownerId, actor.data.user.id)}
              </Badge>
            )}
          </div>
          {(search.trim() || !collapsed.has(v.item.id)) && (
            <ul className="ml-3 border-l pl-1">{nodes(v.item.id, depth + 1)}</ul>
          )}
        </li>
      ));
  }
  const ancestors = [];
  let current = page?.parentId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const ancestor = pages.find((v) => v.item.id === current);
    if (!ancestor) break;
    ancestors.unshift(ancestor);
    current = ancestor.parentId;
  }
  return (
    <section className="flex h-full min-h-0 flex-col sm:flex-row" aria-label="Wiki">
      <aside className="flex max-h-48 shrink-0 flex-col border-b sm:max-h-none sm:w-56 sm:border-r sm:border-b-0">
        <div className="flex items-center justify-between p-3">
          <h1 className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="size-4" aria-hidden="true" />
            Wiki
          </h1>
          <Button
            size="icon"
            aria-label="New Wiki page"
            onClick={() => setCreating({ parent: null })}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
        <div className="px-3 pb-2">
          <Field
            label="Search Wiki pages"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            maxLength={100}
          />
        </div>
        <ErrorMessage error={tree.error} />
        {tree.isPending ? (
          <Loading />
        ) : (
          <nav className="min-h-0 overflow-auto px-2 pb-4" aria-label="Wiki pages">
            <ul>{nodes(null)}</ul>
          </nav>
        )}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {id ? (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5 text-xs">
              <Link to="/w/$workspaceId/wiki" params={{ workspaceId }}>
                Wiki
              </Link>
              {ancestors.map((v) => (
                <Link
                  key={v.item.id}
                  to="/w/$workspaceId/wiki/$pageId"
                  params={{ workspaceId, pageId: v.item.id }}
                >
                  {" "}
                  / {v.item.name.replace(/\.md$/i, "")}
                </Link>
              ))}
              <span className="flex-1" />
              {page && page.item.permission !== "viewer" && (
                <Button size="sm" onClick={() => setCreating({ parent: id })}>
                  New child page
                </Button>
              )}
              {page?.item.canManage && (
                <Button
                  size="sm"
                  onClick={() => {
                    setParent(page.parentId ?? "root");
                    setPosition(page.position + 1);
                    setManaging(true);
                  }}
                >
                  <Settings2 aria-hidden="true" />
                  Manage page
                </Button>
              )}
            </div>
            <OfficePage key={id} workspaceId={workspaceId} id={id} paused={managing} />
          </>
        ) : (
          <div className="grid flex-1 place-content-center p-6">
            <EmptyState
              icon={<BookOpen aria-hidden="true" />}
              title="Your team’s knowledge, together"
            >
              Create pages and organize them into a shared Wiki.
            </EmptyState>
            <Button onClick={() => setCreating({ parent: null })}>Create a Wiki page</Button>
            <p className="mt-4 max-w-md text-xs text-muted-foreground">
              Pages are private until shared. Parent page access applies to child pages. To restore
              deleted pages, open their folder in Drive Trash.
            </p>
          </div>
        )}
      </div>
      {creating && (
        <NewDocument
          workspaceId={workspaceId}
          initialKind="wiki"
          parentPageId={creating.parent}
          close={() => setCreating(null)}
        />
      )}
      {managing && (
        <Dialog open onOpenChange={setManaging}>
          <DialogContent>
            <DialogTitle>Manage Wiki page</DialogTitle>
            <DialogDescription>
              The editor is closed while you manage this page. Other editors must close it before
              moving or deleting its subtree.
            </DialogDescription>
            <ErrorMessage error={operation.error} />
            <SelectField
              label="Parent page"
              value={parent}
              onValueChange={setParent}
              options={[
                { value: "root", label: "Wiki root" },
                ...pages
                  .filter((v) => !descendants(v.item.id) && v.item.permission !== "viewer")
                  .map((v) => ({ value: v.item.id, label: v.item.name })),
              ]}
            />
            <Field
              label="Position"
              type="number"
              min={1}
              max={100001}
              value={position}
              onChange={(event) =>
                setPosition(Math.max(1, Math.min(100001, Number(event.target.value) || 1)))
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => operation.mutate("move")} disabled={operation.isPending}>
                Move to parent
              </Button>
              <Button onClick={() => operation.mutate("copy")} disabled={operation.isPending}>
                Duplicate page
              </Button>
              <Button onClick={() => operation.mutate("trash")} disabled={operation.isPending}>
                Move subtree to Trash
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}
