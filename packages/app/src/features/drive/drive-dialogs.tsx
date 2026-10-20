import {
  driveItemSchema,
  driveSharesSchema,
  driveUrlSchema,
  type DriveItem,
} from "@lumo/contracts/drive";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  ErrorMessage,
  Field,
  Loading,
  SelectField,
} from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Folder, HardDrive } from "lucide-react";
import { useEffect, useState } from "react";

import { api, command, membersQuery } from "../../lib/api";
import { downloadDrive, drivePath, driveQuery, formatBytes } from "./drive-api";

export type DriveAction =
  | {
      kind: "rename" | "move" | "copy" | "share" | "preview" | "details" | "trash" | "purge";
      item: DriveItem;
    }
  | { kind: "folder" };
export function DriveDialog({
  workspaceId,
  parentId,
  action,
  close,
}: {
  workspaceId: string;
  parentId: string | null;
  action: DriveAction;
  close: () => void;
}) {
  const client = useQueryClient();
  const item = "item" in action ? action.item : undefined;
  const [name, setName] = useState(
    action.kind === "copy" ? `${item?.name} (copy)` : (item?.name ?? ""),
  );
  const [target, setTarget] = useState<string | null>(parentId);
  const [history, setHistory] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "My Files" },
  ]);
  const picking = action.kind === "move" || action.kind === "copy";
  const folders = useQuery({
    ...driveQuery(workspaceId, { parentId: target ?? undefined, type: "folder", limit: 100 }),
    enabled: picking,
  });
  const [folderSearch, setFolderSearch] = useState("");
  const found = useQuery({
    ...driveQuery(workspaceId, { q: folderSearch, type: "folder", limit: 100 }),
    enabled: picking && Boolean(folderSearch),
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const base = drivePath(workspaceId);
      if (action.kind === "folder")
        return api(`${base}/folders`, driveItemSchema, {
          method: "POST",
          body: { name, parentId },
        });
      if (!item) return;
      if (action.kind === "rename")
        return api(`${base}/${item.id}`, driveItemSchema, { method: "PATCH", body: { name } });
      if (action.kind === "move")
        return api(`${base}/${item.id}`, driveItemSchema, {
          method: "PATCH",
          body: { parentId: target },
        });
      if (action.kind === "copy")
        return api(`${base}/${item.id}/copy`, driveItemSchema, {
          method: "POST",
          body: { parentId: target, name },
        });
      if (action.kind === "trash") return command(`${base}/${item.id}`, "DELETE");
      if (action.kind === "purge") return command(`${base}/${item.id}/permanent`, "DELETE");
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      close();
    },
  });
  const titles = {
    folder: "New folder",
    rename: "Rename",
    move: "Move to folder",
    copy: "Make a copy",
    share: "Share",
    preview: "Preview",
    details: "File details",
    trash: "Move to Trash",
    purge: "Delete permanently",
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) close();
      }}
    >
      <DialogContent className={action.kind === "preview" ? "max-w-4xl" : undefined}>
        <DialogTitle>
          {titles[action.kind]}
          {item ? ` · ${item.name}` : ""}
        </DialogTitle>
        <DialogDescription>
          {action.kind === "trash"
            ? "This item and its contents will stay in Trash until permanently deleted."
            : action.kind === "purge"
              ? "This permanently removes the item and its contents. This action cannot be undone."
              : action.kind === "share"
                ? "Share privately with people in this workspace. Folder access applies to its contents."
                : action.kind === "preview"
                  ? "Preview supported file contents. Download the original for full access."
                  : "Manage files securely in your workspace."}
        </DialogDescription>
        {action.kind === "share" && item ? (
          <ShareForm workspaceId={workspaceId} item={item} />
        ) : action.kind === "preview" && item ? (
          <Preview workspaceId={workspaceId} item={item} />
        ) : action.kind === "details" && item ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
            {Object.entries({
              Owner: item.ownerName,
              Type: item.kind === "folder" ? "Folder" : item.mimeType,
              Size: formatBytes(item.size),
              Access: item.permission,
              Status: item.status,
              Original: item.originalName,
              Created: new Date(item.createdAt).toLocaleString(),
              Modified: new Date(item.updatedAt).toLocaleString(),
              "File reference": item.id,
              Checksum: item.checksum ?? "—",
            }).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-all">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            {["folder", "rename", "copy"].includes(action.kind) && (
              <Field
                label="Name"
                required
                maxLength={240}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
            {picking && (
              <>
                <Field
                  label="Find a destination folder"
                  type="search"
                  value={folderSearch}
                  onChange={(event) => setFolderSearch(event.target.value)}
                  maxLength={100}
                />
                <nav aria-label="Destination folder" className="flex flex-wrap gap-1 text-sm">
                  {history.map((crumb, index) => (
                    <Button
                      key={crumb.id ?? "root"}
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTarget(crumb.id);
                        setHistory((v) => v.slice(0, index + 1));
                        setFolderSearch("");
                      }}
                    >
                      {crumb.name}
                      <ChevronRight aria-hidden="true" />
                    </Button>
                  ))}
                </nav>
                <ErrorMessage error={folders.error ?? found.error} />
                <div className="max-h-56 overflow-y-auto rounded-lg border p-2">
                  {(folderSearch ? found.data : folders.data)?.items
                    .filter((folder) => folder.id !== item?.id && folder.permission !== "viewer")
                    .map((folder) => (
                      <Button
                        key={folder.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                          setTarget(folder.id);
                          setHistory((v) => [...v, { id: folder.id, name: folder.name }]);
                          setFolderSearch("");
                        }}
                      >
                        <Folder aria-hidden="true" />
                        {folder.name}
                      </Button>
                    ))}
                  {folders.isPending ? (
                    <Loading label="Loading folders…" />
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Choose a folder, or save in the current destination.
                    </p>
                  )}
                </div>
                <p className="text-sm">
                  Destination:{" "}
                  {target
                    ? (folders.data?.breadcrumbs.at(-1)?.name ?? "Selected folder")
                    : "My Files"}
                </p>
              </>
            )}
            <ErrorMessage error={mutation.error} />
            <div className="flex justify-end gap-2">
              <Button disabled={mutation.isPending} onClick={close}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={mutation.isPending}
                variant={
                  action.kind === "trash" || action.kind === "purge" ? "destructive" : "primary"
                }
              >
                {titles[action.kind]}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShareForm({ workspaceId, item }: { workspaceId: string; item: DriveItem }) {
  const client = useQueryClient();
  const base = `${drivePath(workspaceId)}/${item.id}/shares`;
  const shares = useQuery({
    queryKey: ["workspace", workspaceId, "drive", "shares", item.id],
    queryFn: ({ signal }) => api(base, driveSharesSchema, { signal }),
  });
  const [q, setQ] = useState(""),
    [memberId, setMemberId] = useState(""),
    [permission, setPermission] = useState("viewer");
  const members = useQuery(membersQuery(workspaceId, q));
  const mutation = useMutation({
    mutationFn: ({ id, permission }: { id: string; permission: "viewer" | "editor" | null }) =>
      command(
        permission ? base : `${base}/${id}`,
        permission ? "PUT" : "DELETE",
        permission ? { userId: id, permission } : {},
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      setMemberId("");
    },
  });
  return (
    <div className="grid gap-4">
      <p className="flex items-center justify-between text-sm">
        {item.ownerName}
        <Badge>Owner</Badge>
      </p>
      <ErrorMessage error={shares.error ?? members.error ?? mutation.error} />
      {shares.isPending && <Loading label="Loading access…" />}
      {shares.data?.shares.map((grant) => (
        <div
          key={`${grant.userId}-${grant.inheritedFrom}`}
          className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm"
        >
          <span className="min-w-0 flex-1 truncate">
            {grant.name}
            {grant.inheritedFrom ? <small>Inherited from a parent folder</small> : null}
          </span>
          {item.canManage && !grant.inheritedFrom ? (
            <>
              <SelectField
                label={`Access for ${grant.name}`}
                value={grant.permission}
                disabled={mutation.isPending}
                options={[
                  { value: "viewer", label: "Viewer" },
                  { value: "editor", label: "Editor" },
                ]}
                onValueChange={(value) =>
                  mutation.mutate({
                    id: grant.userId,
                    permission: value === "editor" ? "editor" : "viewer",
                  })
                }
              />
              <Button
                size="sm"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ id: grant.userId, permission: null })}
              >
                Revoke
              </Button>
            </>
          ) : (
            <Badge>{grant.permission}</Badge>
          )}
        </div>
      ))}
      {item.canManage && (
        <form
          className="grid gap-3 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (memberId)
              mutation.mutate({
                id: memberId,
                permission: permission === "editor" ? "editor" : "viewer",
              });
          }}
        >
          <Field
            label="Search workspace members"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setMemberId("");
            }}
            maxLength={100}
          />
          <SelectField
            label="Member"
            value={memberId}
            onValueChange={setMemberId}
            options={(members.data?.members ?? [])
              .filter((v) => v.userId !== item.ownerId)
              .map((v) => ({ value: v.userId, label: v.name }))}
            placeholder="Select a member"
          />
          <SelectField
            label="Permission"
            value={permission}
            onValueChange={setPermission}
            options={[
              { value: "viewer", label: "Viewer · view and download" },
              { value: "editor", label: "Editor · view, upload and edit" },
            ]}
          />
          <Button type="submit" variant="primary" disabled={!memberId} loading={mutation.isPending}>
            Share
          </Button>
        </form>
      )}
    </div>
  );
}

function Preview({ workspaceId, item }: { workspaceId: string; item: DriveItem }) {
  const [error, setError] = useState<Error | null>(null),
    [text, setText] = useState<string | null>(null);
  const textType = item.mimeType.startsWith("text/") || item.mimeType === "application/json";
  const supported = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
  ].includes(item.mimeType);
  const preview = useQuery({
    queryKey: ["workspace", workspaceId, "drive", "preview", item.id],
    queryFn: ({ signal }) =>
      api(`${drivePath(workspaceId)}/${item.id}/preview`, driveUrlSchema, {
        method: "POST",
        body: {},
        signal,
      }),
    enabled: supported,
    gcTime: 0,
    retry: false,
  });
  useEffect(() => {
    if (!textType || !preview.data) return;
    const controller = new AbortController();
    void fetch(preview.data.url, {
      headers: { Range: "bytes=0-262143" },
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the preview.");
        return response.text();
      })
      .then(setText)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause : new Error("Unable to load the preview."));
      });
    return () => controller.abort();
  }, [preview.data, textType]);
  return (
    <div className="grid gap-4">
      <ErrorMessage error={preview.error ?? error} />
      {!supported ? (
        <div className="grid justify-items-center gap-3 py-8 text-muted-foreground">
          <HardDrive className="size-10" aria-hidden="true" />
          <p>No preview available for this file type.</p>
        </div>
      ) : preview.isPending ? (
        <Loading label="Loading preview…" />
      ) : preview.data ? (
        textType ? (
          text === null ? (
            <Loading label="Loading text…" />
          ) : (
            <>
              <pre className="max-h-[55dvh] overflow-auto rounded-md border bg-muted/30 p-4 text-xs whitespace-pre-wrap">
                {text}
              </pre>
              {item.size > 262144 && (
                <p className="text-xs text-muted-foreground">
                  Showing the first 256 KB. Download to read the full file.
                </p>
              )}
            </>
          )
        ) : item.mimeType === "application/pdf" ? (
          <iframe
            title={`Preview of ${item.name}`}
            src={preview.data.url}
            sandbox=""
            referrerPolicy="no-referrer"
            className="h-[60dvh] w-full rounded-md border"
          />
        ) : (
          <img
            src={preview.data.url}
            alt={item.name}
            referrerPolicy="no-referrer"
            className="max-h-[60dvh] w-full rounded-md object-contain"
          />
        )
      ) : null}
      <Button
        onClick={() => {
          void downloadDrive(workspaceId, [item.id]).catch((cause: unknown) =>
            setError(cause instanceof Error ? cause : new Error("Download failed.")),
          );
        }}
      >
        Download original · {formatBytes(item.size)}
      </Button>
    </div>
  );
}
