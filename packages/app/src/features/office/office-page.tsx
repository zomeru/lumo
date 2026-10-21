import { driveItemSchema } from "@lumo/contracts/drive";
import { fileOwnership } from "@lumo/contracts/files";
import { officeDetailSchema } from "@lumo/contracts/office";
import { formatDateTime } from "@lumo/shared/date-time";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ErrorMessage,
  Loading,
} from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, History, MoreHorizontal, Share2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { api, command, sessionQuery } from "../../lib/api";
import { getPlatform } from "../../platform";
import { DriveDialog, type DriveAction } from "../drive/drive-dialogs";
import { moduleRoutes, kindModules, moduleIcons } from "./file-modules";
import { officePath, officeQuery, versionsQuery, downloadVersion } from "./office-api";
const OnlyofficeEditor = lazy(() => import("./onlyoffice-editor"));
const WikiEditor = lazy(() => import("./wiki-editor"));
export function OfficePage({
  workspaceId,
  id,
  paused = false,
}: {
  workspaceId: string;
  id: string;
  paused?: boolean;
}) {
  const actor = useQuery(sessionQuery());
  const detail = useQuery(officeQuery(workspaceId, id)),
    client = useQueryClient();
  const [action, setAction] = useState<DriveAction | null>(null),
    [history, setHistory] = useState(false),
    [dirty, setDirty] = useState(false),
    [sharedError, setSharedError] = useState<Error | null>(null);
  const save = useMutation({
    mutationFn: () => command(`${officePath(workspaceId, id)}/save`),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["workspace", workspaceId, "office", id] }),
  });
  const share = useMutation({
    mutationFn: () => api(`${officePath(workspaceId, id)}/share-item`, driveItemSchema),
    onSuccess: (item) => setAction({ kind: "share", item }),
  });
  if (detail.isError)
    return (
      <div className="p-6">
        <h1>Document unavailable</h1>
        <ErrorMessage error={detail.error} />
        <p className="mt-3">Check your access or restore the file from Drive Trash.</p>
      </div>
    );
  if (!detail.data) return <Loading label="Loading document…" />;
  const doc = detail.data,
    item = doc.item,
    editing = item.permission !== "viewer";
  const ModuleIcon = moduleIcons[kindModules[doc.kind]];
  return (
    <section
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
      aria-label={doc.kind === "wiki" ? "Wiki page" : "Document"}
    >
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-surface px-3 py-2">
        <Button asChild variant="ghost" size="icon">
          <Link
            to={moduleRoutes[kindModules[doc.kind]]}
            params={{ workspaceId }}
            aria-label={`Back to ${doc.kind === "document" ? "Docs" : kindModules[doc.kind]}`}
          >
            <ArrowLeft aria-hidden="true" />
          </Link>
        </Button>
        <ModuleIcon aria-hidden="true" className="size-4 shrink-0" />
        <div className="min-w-24 flex-1">
          <button
            type="button"
            className="max-w-full truncate text-left text-sm font-semibold hover:underline"
            disabled={!editing}
            onClick={() => setAction({ kind: "rename", item })}
          >
            {item.name}
          </button>
          <output className="block text-[10px] text-muted-foreground">
            {doc.state === "error"
              ? "Save failed · last saved version retained"
              : dirty
                ? "Editing · waiting for a saved version"
                : `Version ${doc.version} · saved ${formatDateTime(doc.savedAt)}`}
          </output>
        </div>
        {actor.data && <Badge>{fileOwnership(item.ownerId, actor.data.user.id)}</Badge>}
        <Badge>{editing ? "Can edit" : "Read only"}</Badge>
        {editing && doc.kind !== "wiki" && (
          <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>
            Save version
          </Button>
        )}
        <Button size="sm" onClick={() => share.mutate()} loading={share.isPending}>
          <Share2 aria-hidden="true" />
          Share
        </Button>
        <Button size="icon" aria-label="Version history" onClick={() => setHistory(true)}>
          <History aria-hidden="true" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" aria-label="Document actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(doc.kind === "wiki"
              ? (["rename", "details"] as const)
              : (["rename", "move", "copy", "details", "trash"] as const)
            ).map((kind) => (
              <DropdownMenuItem
                key={kind}
                disabled={
                  kind === "rename" || kind === "trash"
                    ? !editing
                    : kind === "move" && !item.canManage
                }
                onSelect={() => setAction({ kind, item })}
              >
                {
                  {
                    rename: "Rename",
                    move: "Move to folder",
                    copy: "Make a copy",
                    details: "File details",
                    trash: "Move to Trash",
                  }[kind]
                }
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard
                  .writeText(
                    `${getPlatform()?.webOrigin ?? window.location.origin}/w/${workspaceId}/${kindModules[doc.kind]}/${id}`,
                  )
                  .catch(() =>
                    setSharedError(
                      new Error("Unable to copy the link. Copy the page address instead."),
                    ),
                  );
              }}
            >
              Copy link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <ErrorMessage error={save.error ?? share.error ?? sharedError} />
      {history || paused ? (
        <div className="p-6 text-sm text-muted-foreground">
          Editor closed. Changes already received by the collaboration service will finish saving.
        </div>
      ) : (
        <Suspense fallback={<Loading label="Loading editor…" />}>
          {doc.kind === "wiki" ? (
            <WikiEditor
              key={`${id}-${doc.generation}-${item.permission}`}
              workspaceId={workspaceId}
              id={id}
            />
          ) : (
            <OnlyofficeEditor
              key={`${id}-${doc.generation}-${item.permission}`}
              workspaceId={workspaceId}
              id={id}
              onDirty={setDirty}
              sessionKey={`${doc.generation}-${item.permission}`}
            />
          )}
        </Suspense>
      )}
      {action && (
        <DriveDialog
          key={`${action.kind}-${id}`}
          workspaceId={workspaceId}
          parentId={item.parentId}
          action={action}
          close={() => setAction(null)}
        />
      )}
      {history && (
        <VersionHistory
          workspaceId={workspaceId}
          id={id}
          canRestore={item.canManage}
          idle={doc.state === "idle"}
          close={() => {
            setHistory(false);
            setDirty(false);
          }}
        />
      )}
    </section>
  );
}
function VersionHistory({
  workspaceId,
  id,
  canRestore,
  idle,
  close,
}: {
  workspaceId: string;
  id: string;
  canRestore: boolean;
  idle: boolean;
  close: () => void;
}) {
  const versions = useQuery(versionsQuery(workspaceId, id)),
    client = useQueryClient();
  const restore = useMutation({
    mutationFn: (versionId: string) =>
      api(`${officePath(workspaceId, id)}/versions/${versionId}/restore`, officeDetailSchema, {
        method: "POST",
        body: {},
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      close();
    },
  });
  const download = useMutation({
    mutationFn: (versionId: string) => downloadVersion(workspaceId, id, versionId),
  });
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !restore.isPending) close();
      }}
    >
      <DialogContent>
        <DialogTitle>Version history</DialogTitle>
        <DialogDescription>
          Restore creates a new version. Close all editing sessions before restoring.
        </DialogDescription>
        <ErrorMessage error={versions.error ?? restore.error ?? download.error} />
        {!idle && (
          <p className="text-sm text-muted-foreground">
            Waiting for editors to close and the final save to finish…
          </p>
        )}
        {versions.isPending && <Loading />}
        <div className="grid max-h-[55dvh] gap-3 overflow-auto">
          {versions.data?.versions.map((v) => (
            <div className="flex flex-wrap items-center gap-3 border-b pb-3" key={v.id}>
              <div className="flex-1 text-sm">
                <strong>Version {v.number}</strong>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(v.createdAt)} · {v.actorName ?? "Collaboration service"} ·{" "}
                  {v.source}
                </p>
              </div>
              <Button size="sm" onClick={() => download.mutate(v.id)} disabled={download.isPending}>
                Download
              </Button>
              {canRestore && (
                <Button
                  size="sm"
                  onClick={() => restore.mutate(v.id)}
                  disabled={!idle || restore.isPending}
                >
                  Restore
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
