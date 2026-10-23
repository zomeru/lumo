import type { Person } from "@lumolynk/contracts/hr";
import { Button, EmptyState, Field, cn } from "@lumolynk/ui";
import { Maximize, Minus, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { AppAvatar as Avatar } from "../../components/app-avatar";
import { buildOrgTree, layoutOrgTree } from "./org-tree";

export function OrgChart({
  people,
  onSelect,
}: {
  people: Person[];
  onSelect: (person: Person) => void;
}) {
  const tree = useMemo(() => buildOrgTree(people), [people]);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [collapsed, setCollapsed] = useState(new Set<string>());
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const layout = useMemo(
    () => layoutOrgTree(tree, expanded, collapsed),
    [tree, expanded, collapsed],
  );
  const positions = new Map(layout.nodes.map((node) => [node.id, node]));
  const matches = people.filter(
    (p) =>
      query.trim() &&
      `${p.name} ${p.jobTitle} ${p.department}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  function locate() {
    const match = matches[0];
    if (!match) return;
    const next = new Set(expanded),
      hidden = new Set(collapsed);
    let id: string | null = match.userId;
    while (id) {
      next.add(id);
      hidden.delete(id);
      id = tree.parent.get(id) ?? null;
    }
    setExpanded(next);
    setCollapsed(hidden);
    const target = layoutOrgTree(tree, next, hidden).nodes.find(
      (node) => node.id === match.userId,
    )!;
    viewport.current?.scrollTo({
      left: (target.x + 112) * zoom - viewport.current.clientWidth / 2,
      top: target.y * zoom - 80,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  if (!people.length) return <EmptyState title="No people in the organization yet" />;
  return (
    <section aria-label="Reporting hierarchy" className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <form
          className="flex flex-1 items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            locate();
          }}
        >
          <Field
            label="Find in organization"
            type="search"
            value={query}
            maxLength={100}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" disabled={!matches.length}>
            Locate
          </Button>
        </form>
        <Button
          size="icon"
          aria-label="Zoom out"
          disabled={zoom <= 0.5}
          onClick={() => setZoom((value) => Math.max(0.5, value - 0.1))}
        >
          <Minus aria-hidden="true" />
        </Button>
        <output className="w-12 text-center text-xs" aria-label="Chart zoom">
          {Math.round(zoom * 100)}%
        </output>
        <Button
          size="icon"
          aria-label="Zoom in"
          disabled={zoom >= 1.5}
          onClick={() => setZoom((value) => Math.min(1.5, value + 0.1))}
        >
          <Plus aria-hidden="true" />
        </Button>
        <Button
          onClick={() => {
            setZoom(
              Math.max(
                0.5,
                Math.min(
                  1,
                  (viewport.current?.clientWidth ?? 800) / layout.width,
                  (viewport.current?.clientHeight ?? 500) / layout.height,
                ),
              ),
            );
            viewport.current?.scrollTo({ left: 0, top: 0 });
          }}
        >
          <Maximize aria-hidden="true" />
          Fit to view
        </Button>
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {query
          ? `${matches.length} matching people. Use Locate to reveal the first match.`
          : "Drag the background or scroll to explore. Use Tab to reach profiles and reporting controls."}
      </p>
      {tree.children.size === 0 && (
        <p className="text-sm text-muted-foreground">
          No reporting relationships are defined yet. Workspace members appear as top-level nodes.
        </p>
      )}
      {tree.invalid.size > 0 && (
        <p role="alert" className="text-sm text-warning">
          Reporting cycle detected. Invalid links are omitted; ask HR to correct the manager
          assignments.
        </p>
      )}
      <section
        ref={viewport}
        aria-label="Organization chart canvas"
        className="h-[60dvh] min-h-80 overflow-auto rounded-lg border bg-muted/20 focus-visible:outline-2 focus-visible:outline-ring"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          drag.current = {
            x: event.clientX,
            y: event.clientY,
            left: event.currentTarget.scrollLeft,
            top: event.currentTarget.scrollTop,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current) {
            event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX;
            event.currentTarget.scrollTop = drag.current.top + drag.current.y - event.clientY;
          }
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div style={{ width: layout.width * zoom, height: layout.height * zoom }}>
          <div
            className="relative origin-top-left"
            style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}
          >
            <svg
              className="pointer-events-none absolute inset-0 text-primary/35"
              width={layout.width}
              height={layout.height}
              aria-hidden="true"
            >
              {layout.nodes.map((node) => {
                const parent = positions.get(tree.parent.get(node.id) ?? "");
                return parent ? (
                  <path
                    key={node.id}
                    d={`M ${parent.x + 112} ${parent.y + 108} V ${node.y - 24} H ${node.x + 112} V ${node.y}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                ) : null;
              })}
            </svg>
            {layout.nodes.map((node) => {
              const person = tree.byId.get(node.id)!,
                reports = tree.children.get(node.id) ?? [];
              return (
                <article
                  key={node.id}
                  className={cn(
                    "absolute h-[108px] w-56 rounded-lg border bg-surface shadow-xs",
                    matches.some((p) => p.userId === node.id) && "ring-2 ring-primary",
                  )}
                  style={{
                    left: node.x,
                    top: node.y,
                    contentVisibility: "auto",
                    containIntrinsicSize: "224px 108px",
                  }}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-t-lg px-3 pt-3 pb-1 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => onSelect(person)}
                    aria-label={`View profile: ${person.name}, ${person.jobTitle || "Workspace member"}`}
                  >
                    <Avatar name={person.name} src={person.image ?? undefined} size="sm" />
                    <span className="min-w-0">
                      <strong className="block truncate text-xs">{person.name}</strong>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {person.jobTitle || "Workspace member"}
                      </span>
                    </span>
                  </button>
                  <p className="truncate px-3 text-[11px] text-muted-foreground">
                    {person.department || "No department"}
                  </p>
                  <span className="sr-only">
                    Reports to:{" "}
                    {tree.byId.get(tree.parent.get(node.id) ?? "")?.name ??
                      (person.managerId && !tree.byId.has(person.managerId)
                        ? "Manager unavailable"
                        : "No manager assigned")}
                  </span>
                  {reports.length ? (
                    <button
                      type="button"
                      aria-expanded={node.open}
                      aria-label={`${node.open ? "Collapse" : "Expand"} reports for ${person.name}`}
                      className="mt-1 w-full rounded-b-lg border-t py-1 text-[10px] text-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                      onClick={() => {
                        setExpanded((previous) => new Set(previous).add(node.id));
                        setCollapsed((previous) => {
                          const next = new Set(previous);
                          if (node.open) next.add(node.id);
                          else next.delete(node.id);
                          return next;
                        });
                      }}
                    >
                      {node.open ? "−" : "+"} {reports.length} direct{" "}
                      {reports.length === 1 ? "report" : "reports"}
                    </button>
                  ) : (
                    <p className="px-3 pt-1 text-[10px] text-muted-foreground">
                      Individual contributor
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </section>
  );
}
