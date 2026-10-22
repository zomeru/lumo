import {
  attachmentFormat,
  isMessengerMedia,
  type MessengerMessage,
} from "@lumo/contracts/messenger";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  ErrorMessage,
} from "@lumo/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatBytes } from "../drive/drive-api";
import { MediaViewer } from "./media-viewer";
import { attachmentPreviewQuery, downloadAttachment } from "./messenger-files";

type Attachment = MessengerMessage["attachments"][number];
const icons = {
  image: FileImage,
  video: FileVideo,
  pdf: FileText,
  text: FileText,
  document: FileText,
  sheet: FileSpreadsheet,
  presentation: Presentation,
  archive: FileArchive,
};
function FileIcon({ file }: { file: Attachment }) {
  const format = attachmentFormat(file.mimeType),
    Icon = format ? icons[format.kind] : File;
  return (
    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">
      <Icon className="size-5" aria-hidden="true" />
    </span>
  );
}
function AttachmentCard({
  workspaceId,
  file,
  onPreview,
}: {
  workspaceId: string;
  file: Attachment;
  onPreview: (trigger: HTMLButtonElement) => void;
}) {
  const root = useRef<HTMLLIElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [failed, setFailed] = useState(false);
  const media = isMessengerMedia(file.mimeType);
  useEffect(() => {
    if (!media || visible || !root.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [media, visible]);
  const preview = useQuery({
    ...attachmentPreviewQuery(workspaceId, file.id),
    enabled: media && visible,
  });
  const download = useMutation({ mutationFn: () => downloadAttachment(workspaceId, file.id) });
  const format = attachmentFormat(file.mimeType);
  return (
    <li ref={root} className="min-w-0 max-w-sm overflow-hidden rounded-lg border bg-surface">
      {media && (
        <button
          type="button"
          aria-label={`Preview ${file.name}`}
          className="relative flex h-36 w-full items-center justify-center bg-muted/50 focus-visible:outline-offset-[-3px]"
          onClick={(event) => onPreview(event.currentTarget)}
        >
          {preview.data && !preview.isError && !failed ? (
            file.mimeType.startsWith("video/") ? (
              <video
                src={preview.data.url}
                muted
                playsInline
                preload="metadata"
                tabIndex={-1}
                aria-hidden="true"
                className="pointer-events-none h-full w-full object-contain"
                onError={() => setFailed(true)}
              />
            ) : (
              <img
                src={preview.data.url}
                alt={`${file.name} thumbnail`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
                onError={() => setFailed(true)}
              />
            )
          ) : (
            <FileIcon file={file} />
          )}
          <span className="absolute right-2 bottom-2 rounded-md border bg-surface/95 px-2 py-1 text-xs text-foreground">
            {failed || preview.isError
              ? "Preview unavailable"
              : file.mimeType.startsWith("video/")
                ? "Play video"
                : "View image"}
          </span>
        </button>
      )}
      <div className="flex min-w-0 items-start gap-2 p-3">
        <FileIcon file={file} />
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium" title={file.name}>
            {file.name}
          </span>
          <span className="block text-xs text-muted-foreground">
            {format?.label ?? file.mimeType} · {formatBytes(file.size)}
          </span>
          <Button
            size="sm"
            variant="link"
            className="max-w-full justify-start"
            aria-label={`${file.name} · Download`}
            disabled={download.isPending}
            onClick={() => download.mutate()}
          >
            Download
          </Button>
          <small>Unscanned file</small>
        </div>
      </div>
      <ErrorMessage error={download.error} />
    </li>
  );
}
/** Gallery scope is this message's attachments; URLs always come from the authorized API. */
export function AttachmentList({
  workspaceId,
  files,
}: {
  workspaceId: string;
  files: Attachment[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const media = files.filter((file) => isMessengerMedia(file.mimeType));
  const index = media.findIndex((file) => file.id === selected),
    file = media[index];
  if (!files.length) return null;
  return (
    <>
      <ul aria-label="Attachments" className="mt-2 grid min-w-0 gap-2">
        {files.map((file) => (
          <AttachmentCard
            key={file.id}
            workspaceId={workspaceId}
            file={file}
            onPreview={(element) => {
              trigger.current = element;
              setSelected(file.id);
            }}
          />
        ))}
      </ul>
      <Dialog
        open={!!file}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        {file && (
          <DialogContent
            className="max-h-[92dvh] max-w-5xl gap-3 p-4"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              trigger.current?.focus();
            }}
            onKeyDown={(event) => {
              if (
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                (event.target instanceof Element && event.target.closest("video,input,textarea"))
              )
                return;
              const next =
                event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : -1;
              if (media[next]) {
                event.preventDefault();
                setSelected(media[next]!.id);
              }
            }}
          >
            <DialogTitle className="break-all">{file.name}</DialogTitle>
            <DialogDescription>
              {attachmentFormat(file.mimeType)?.label} · {formatBytes(file.size)} · {index + 1} of{" "}
              {media.length}
            </DialogDescription>
            <MediaViewer
              key={file.id}
              workspaceId={workspaceId}
              file={file}
              index={index}
              count={media.length}
              onPrevious={() => setSelected(media[index - 1]!.id)}
              onNext={() => setSelected(media[index + 1]!.id)}
            />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
