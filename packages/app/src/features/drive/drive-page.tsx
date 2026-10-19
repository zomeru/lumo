import type { DriveItem, DriveListInput, DriveUpload, DriveView } from "@lumo/contracts/drive";
import {
  Badge,
  Button,
  Checkbox,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorMessage,
  Field,
  Loading,
  PageHeading,
  Progress,
  SelectField,
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  cn,
  useToast,
} from "@lumo/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Download,
  File,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  Grid2X2,
  HardDrive,
  List,
  MoreHorizontal,
  Star,
  Upload,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { command } from "../../lib/api";
import { downloadDrive, drivePath, driveQuery, formatBytes } from "./drive-api";
import { DriveDialog, type DriveAction } from "./drive-dialogs";
import { uploadDriveFile } from "./upload";

type UploadJob = {
  id: string;
  file: File;
  parentId: string | null;
  controller: AbortController;
  session?: DriveUpload;
  progress: number;
  status: "queued" | "uploading" | "done" | "error" | "canceled";
  error?: Error;
  finalizeOnly?: boolean;
};
const views: { value: DriveView; label: string }[] = [
  { value: "my", label: "My Files" },
  { value: "recent", label: "Recent" },
  { value: "starred", label: "Starred" },
  { value: "shared", label: "Shared With Me" },
  { value: "trash", label: "Trash" },
];
function FileIcon({ item }: { item: DriveItem }) {
  const Icon =
    item.kind === "folder"
      ? Folder
      : item.mimeType.startsWith("image/")
        ? FileImage
        : item.mimeType.startsWith("text/") || item.mimeType === "application/pdf"
          ? FileText
          : File;
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}
export function DrivePage({
  workspaceId,
  search,
  navigate,
}: {
  workspaceId: string;
  search: DriveListInput;
  navigate: (patch: Partial<DriveListInput>) => void;
}) {
  const client = useQueryClient(),
    notify = useToast();
  const listing = useQuery(driveQuery(workspaceId, search));
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<string[]>([]),
    [action, setAction] = useState<DriveAction | null>(null);
  const [dragging, setDragging] = useState(false),
    [error, setError] = useState<Error | null>(null);
  const [uploads, setUploads] = useState<UploadJob[]>([]);
  const jobs = useRef(new Map<string, UploadJob>()),
    active = useRef(0),
    mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const parentId = search.parentId ?? null;
  const base = drivePath(workspaceId);
  const invalidate = () =>
    client.invalidateQueries({ queryKey: ["workspace", workspaceId, "drive"] });
  const mutation = useMutation({
    mutationFn: ({ path, method, body }: { path: string; method?: string; body?: unknown }) =>
      command(base + path, method, body),
    onSuccess: invalidate,
  });
  const download = useMutation({
    mutationFn: ({ ids, folder }: { ids: string[]; folder?: boolean }) =>
      downloadDrive(workspaceId, ids, folder),
    onSuccess: () => notify({ title: "Download started" }),
  });
  useEffect(() => {
    mounted.current = true;
    const currentJobs = jobs.current;
    return () => {
      mounted.current = false;
      for (const job of currentJobs.values()) {
        if (["queued", "uploading"].includes(job.status)) {
          job.controller.abort();
          if (job.session)
            void command(`${drivePath(workspaceId)}/${job.session.item.id}/cancel`).catch(() => {});
        }
      }
    };
  }, [workspaceId]);
  function publish() {
    if (mounted.current) setUploads([...jobs.current.values()]);
  }
  function drain() {
    while (active.current < 2) {
      const job = [...jobs.current.values()].find((v) => v.status === "queued");
      if (!job) return;
      active.current++;
      job.status = "uploading";
      publish();
      void uploadDriveFile({
        workspaceId,
        parentId: job.parentId,
        file: job.file,
        signal: job.controller.signal,
        previous: job.session,
        finalizeOnly: job.finalizeOnly,
        onInitialized: (session) => {
          job.session = session;
          publish();
        },
        onProgress: (percent) => {
          job.progress = percent;
          if (percent >= 97) job.finalizeOnly = true;
          publish();
        },
      })
        .then(() => {
          job.status = "done";
          if (mounted.current) notify({ title: "Upload complete", description: job.file.name });
        })
        .catch((cause: unknown) => {
          job.status = job.controller.signal.aborted ? "canceled" : "error";
          job.error = cause instanceof Error ? cause : new Error("Upload failed.");
          if (job.status === "canceled" && job.session)
            void command(`${base}/${job.session.item.id}/cancel`).catch(() => {});
        })
        .finally(() => {
          active.current--;
          publish();
          if (mounted.current) {
            void invalidate();
            drain();
          }
        });
    }
  }
  function enqueue(files: File[]) {
    setError(null);
    if (!listing.data?.canWrite || search.view === "trash") {
      setError(new Error("Choose a folder you can upload to."));
      return;
    }
    if (files.length > 100) {
      setError(new Error("Choose up to 100 files per upload."));
      return;
    }
    for (const file of files) {
      const id = crypto.randomUUID();
      jobs.current.set(id, {
        id,
        file,
        parentId,
        controller: new AbortController(),
        progress: 0,
        status: "queued",
      });
    }
    publish();
    drain();
  }
  function change(patch: Partial<DriveListInput>) {
    setSelected([]);
    navigate({ ...patch, offset: patch.offset ?? 0 });
  }
  function open(item: DriveItem) {
    if (item.kind === "folder") change({ parentId: item.id, q: "", offset: 0 });
    else setAction({ kind: "preview", item });
  }
  function menuItems(item: DriveItem, context = false) {
    const MenuItem = context ? ContextMenuItem : DropdownMenuItem;
    const editing = item.permission !== "viewer",
      trash = search.view === "trash";
    return (
      <>
        {!trash && (
          <>
            <MenuItem onSelect={() => open(item)}>
              {item.kind === "folder" ? "Open folder" : "Preview"}
            </MenuItem>
            <MenuItem
              disabled={download.isPending}
              onSelect={() => download.mutate({ ids: [item.id], folder: item.kind === "folder" })}
            >
              Download{item.kind === "folder" ? " as ZIP" : ""}
            </MenuItem>
            <MenuItem
              onSelect={() =>
                mutation.mutate({
                  path: `/${item.id}/star`,
                  method: "PUT",
                  body: { starred: !item.starred },
                })
              }
            >
              {item.starred ? "Remove star" : "Add star"}
            </MenuItem>
            <MenuItem onSelect={() => setAction({ kind: "share", item })}>
              Sharing & access
            </MenuItem>
            <MenuItem disabled={!editing} onSelect={() => setAction({ kind: "rename", item })}>
              Rename
            </MenuItem>
            <MenuItem disabled={!item.canManage} onSelect={() => setAction({ kind: "move", item })}>
              Move
            </MenuItem>
            <MenuItem onSelect={() => setAction({ kind: "copy", item })}>Make a copy</MenuItem>
            <MenuItem
              disabled={!editing}
              destructive
              onSelect={() => setAction({ kind: "trash", item })}
            >
              Move to Trash
            </MenuItem>
          </>
        )}
        {trash && (
          <>
            <MenuItem
              disabled={!item.canManage || item.status !== "ready"}
              onSelect={() => mutation.mutate({ path: `/${item.id}/restore` })}
            >
              Restore
            </MenuItem>
            <MenuItem
              disabled={!item.canManage}
              destructive
              onSelect={() => setAction({ kind: "purge", item })}
            >
              Delete permanently
            </MenuItem>
          </>
        )}
        <MenuItem onSelect={() => setAction({ kind: "details", item })}>Details</MenuItem>
      </>
    );
  }
  function controls(item: DriveItem) {
    return (
      <div className="flex items-center justify-end gap-1">
        {search.view !== "trash" && (
          <Button
            title={item.starred ? "Remove star" : "Add star"}
            aria-label={`${item.starred ? "Unstar" : "Star"} ${item.name}`}
            size="icon"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({
                path: `/${item.id}/star`,
                method: "PUT",
                body: { starred: !item.starred },
              })
            }
          >
            <Star aria-hidden="true" className={item.starred ? "fill-primary text-primary" : ""} />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={`Actions for ${item.name}`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">{menuItems(item)}</DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }
  function selection(item: DriveItem) {
    return (
      <Checkbox
        aria-label={`Select ${item.name}`}
        checked={selected.includes(item.id)}
        onCheckedChange={(checked) =>
          setSelected((v) => (checked ? [...v, item.id] : v.filter((id) => id !== item.id)))
        }
      />
    );
  }
  function fileName(item: DriveItem) {
    return (
      <button
        type="button"
        disabled={search.view === "trash" || item.status !== "ready"}
        className="block max-w-64 truncate text-left text-sm font-medium hover:text-primary hover:underline"
        onClick={() => open(item)}
      >
        {item.name}
      </button>
    );
  }
  const items = listing.data?.items ?? [];
  const picked = selected.filter((id) => items.some((v) => v.id === id));
  const canUpload = listing.data?.canWrite && search.view !== "trash";
  // Drag/drop supplements the keyboard-accessible Upload button.
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      aria-label="Drive"
      className="relative min-h-96"
      onDragOver={(event) => {
        event.preventDefault();
        if (canUpload) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        enqueue(Array.from(event.dataTransfer.files));
      }}
    >
      <PageHeading
        eyebrow="Your workspace, organized"
        title="Drive"
        actions={
          <>
            <Button onClick={() => setAction({ kind: "folder" })} disabled={!canUpload}>
              <FolderPlus aria-hidden="true" />
              New folder
            </Button>
            <Button variant="primary" disabled={!canUpload} onClick={() => input.current?.click()}>
              <Upload aria-hidden="true" />
              Upload
            </Button>
          </>
        }
      />
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        aria-label="Upload files"
        disabled={!canUpload}
        onChange={(event) => {
          enqueue(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Drive views" className="flex max-w-full flex-wrap gap-1.5">
          {views.map((view) => (
            <Button
              key={view.value}
              size="sm"
              variant={search.view === view.value ? "primary" : "ghost"}
              aria-current={search.view === view.value ? "page" : undefined}
              className="rounded-full"
              onClick={() => change({ view: view.value, parentId: undefined, q: "" })}
            >
              {view.label}
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Button
            title="List view"
            aria-label="List view"
            aria-pressed={layout === "list"}
            size="icon"
            variant={layout === "list" ? "secondary" : "ghost"}
            onClick={() => setLayout("list")}
          >
            <List aria-hidden="true" />
          </Button>
          <Button
            title="Grid view"
            aria-label="Grid view"
            aria-pressed={layout === "grid"}
            size="icon"
            variant={layout === "grid" ? "secondary" : "ghost"}
            onClick={() => setLayout("grid")}
          >
            <Grid2X2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Field
          label="Search files and folders"
          type="search"
          maxLength={100}
          value={search.q}
          onChange={(event) => change({ q: event.target.value })}
        />
        <SelectField
          label="File type"
          value={search.type}
          onValueChange={(type) => change({ type: type as DriveListInput["type"] })}
          options={[
            { value: "all", label: "All types" },
            { value: "folder", label: "Folders" },
            { value: "image", label: "Images" },
            { value: "pdf", label: "PDFs" },
            { value: "text", label: "Text files" },
            { value: "other", label: "Other files" },
          ]}
        />
        <SelectField
          label="Sort by"
          value={`${search.sort}:${search.direction}`}
          onValueChange={(value) => {
            const [sort, direction] = value.split(":");
            change({
              sort: sort as DriveListInput["sort"],
              direction: direction as DriveListInput["direction"],
            });
          }}
          options={[
            { value: "name:asc", label: "Name · A to Z" },
            { value: "name:desc", label: "Name · Z to A" },
            { value: "updatedAt:desc", label: "Last modified" },
            { value: "size:desc", label: "Size · largest first" },
            { value: "size:asc", label: "Size · smallest first" },
            { value: "type:asc", label: "File type" },
          ]}
        />
      </div>
      <ErrorMessage error={listing.error ?? mutation.error ?? download.error ?? error} />
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="Folder breadcrumbs" className="flex flex-wrap items-center gap-1 text-sm">
          <Button size="sm" variant="ghost" onClick={() => change({ parentId: undefined, q: "" })}>
            <HardDrive aria-hidden="true" />
            {views.find((v) => v.value === search.view)?.label}
          </Button>
          {listing.data?.breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="size-3 text-muted-foreground" aria-hidden="true" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => change({ parentId: crumb.id, q: "" })}
              >
                {crumb.name}
              </Button>
            </span>
          ))}
        </nav>
        {picked.length > 0 && search.view !== "trash" && (
          <Button
            size="sm"
            loading={download.isPending}
            onClick={() =>
              download.mutate({
                ids: picked,
                folder:
                  picked.length === 1 && items.find((v) => v.id === picked[0])?.kind === "folder",
              })
            }
          >
            <Download aria-hidden="true" />
            Download {picked.length} selected
          </Button>
        )}
      </div>
      {listing.isPending ? (
        <Loading label="Loading Drive…" />
      ) : listing.isError ? (
        <Button
          onClick={() => {
            void listing.refetch();
          }}
        >
          Retry loading files
        </Button>
      ) : !items.length ? (
        <EmptyState
          title={
            search.q
              ? "No matching files"
              : search.view === "trash"
                ? "Trash is empty"
                : "No files here yet"
          }
          icon={<HardDrive aria-hidden="true" />}
          className="min-h-56 border-solid"
        >
          {search.q
            ? "Try a different name or file type."
            : search.view === "trash"
              ? "Deleted items will appear here."
              : canUpload
                ? "Upload files or drag them onto this page."
                : "Files shared with you will appear here."}
        </EmptyState>
      ) : layout === "list" ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox
                  aria-label="Select all files on this page"
                  checked={picked.length === items.length}
                  onCheckedChange={(checked) => setSelected(checked ? items.map((v) => v.id) : [])}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Owner</TableHead>
              <TableHead className="hidden lg:table-cell">Last modified</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <ContextMenu key={item.id}>
                <ContextMenuTrigger asChild>
                  <TableRow data-selected={picked.includes(item.id)}>
                    <TableCell>{selection(item)}</TableCell>
                    <TableCell>
                      <div className="flex min-w-40 items-center gap-3">
                        <FileIcon item={item} />
                        <div className="min-w-0">
                          {fileName(item)}
                          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            {item.shared ? <Users className="size-3" aria-hidden="true" /> : null}
                            {item.kind === "folder" ? "Folder" : item.mimeType}
                            {item.status !== "ready" ? ` · ${item.status}` : ""}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs text-muted-foreground">{item.ownerName}</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <time className="text-xs text-muted-foreground" dateTime={item.updatedAt}>
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </time>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {item.kind === "folder" ? "—" : formatBytes(item.size)}
                    </TableCell>
                    <TableCell>{controls(item)}</TableCell>
                  </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent>{menuItems(item, true)}</ContextMenuContent>
              </ContextMenu>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <ContextMenu key={item.id}>
              <ContextMenuTrigger asChild>
                <article
                  className={cn(
                    "rounded-lg border bg-surface p-4 shadow-xs",
                    picked.includes(item.id) && "border-primary bg-accent/30",
                  )}
                >
                  <div className="mb-5 flex items-center justify-between">
                    {selection(item)}
                    {controls(item)}
                  </div>
                  <FileIcon item={item} />
                  <div className="mt-3">{fileName(item)}</div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    {item.shared && <Users className="size-3" aria-hidden="true" />}
                    {item.ownerName} · {item.kind === "folder" ? "Folder" : formatBytes(item.size)}
                  </p>
                </article>
              </ContextMenuTrigger>
              <ContextMenuContent>{menuItems(item, true)}</ContextMenuContent>
            </ContextMenu>
          ))}
        </div>
      )}
      {listing.data && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            {formatBytes(listing.data.totalSize)} used · {listing.data.totalFiles} files accessible
            to you
          </span>
          <div className="flex gap-2">
            {search.offset > 0 && (
              <Button
                size="sm"
                onClick={() => change({ offset: Math.max(0, search.offset - search.limit) })}
              >
                Previous
              </Button>
            )}
            {listing.data.nextOffset !== null && (
              <Button size="sm" onClick={() => change({ offset: listing.data!.nextOffset! })}>
                Next
              </Button>
            )}
          </div>
        </div>
      )}
      {uploads.length > 0 && (
        <aside aria-label="Uploads" className="mt-6 rounded-lg border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm">Uploads</h2>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                for (const [id, job] of jobs.current)
                  if (["done", "canceled"].includes(job.status)) jobs.current.delete(id);
                publish();
              }}
            >
              Clear finished
            </Button>
          </div>
          <div className="grid gap-4">
            {uploads.map((job) => (
              <div key={job.id} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm">{job.file.name}</span>
                  <Badge
                    variant={
                      job.status === "error"
                        ? "destructive"
                        : job.status === "done"
                          ? "success"
                          : "secondary"
                    }
                  >
                    {job.status === "uploading" && job.progress >= 97 ? "Verifying…" : job.status}
                  </Badge>
                  {job.status === "uploading" || job.status === "queued" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Cancel upload ${job.file.name}`}
                      onClick={() => {
                        job.controller.abort();
                        if (job.status === "queued") {
                          job.status = "canceled";
                          publish();
                        }
                      }}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  ) : job.status === "error" ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        job.controller = new AbortController();
                        job.status = "queued";
                        job.error = undefined;
                        publish();
                        drain();
                      }}
                    >
                      Retry upload
                    </Button>
                  ) : null}
                </div>
                {job.status === "uploading" && (
                  <Progress
                    aria-label={`Upload progress for ${job.file.name}`}
                    value={job.progress}
                  />
                )}
                {job.status === "error" && <ErrorMessage error={job.error} />}
              </div>
            ))}
          </div>
        </aside>
      )}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-accent/95">
          <div className="grid justify-items-center gap-3 text-primary">
            <Upload className="size-10" aria-hidden="true" />
            <strong>Drop files to upload</strong>
          </div>
        </div>
      )}
      {action && (
        <DriveDialog
          key={"item" in action ? `${action.kind}-${action.item.id}` : action.kind}
          workspaceId={workspaceId}
          parentId={parentId}
          action={action}
          close={() => setAction(null)}
        />
      )}
    </section>
  );
}
