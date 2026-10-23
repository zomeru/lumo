import { type MessengerMessage } from "@lumolynk/contracts/messenger";
import { Button, ErrorMessage, Loading } from "@lumolynk/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";
import { useRef, useState } from "react";

import { getPlatform } from "../../platform";
import { attachmentPreviewQuery, downloadAttachment } from "./messenger-files";

type Attachment = MessengerMessage["attachments"][number];
export function MediaViewer({
  workspaceId,
  file,
  index,
  count,
  onPrevious,
  onNext,
}: {
  workspaceId: string;
  file: Attachment;
  index: number;
  count: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  // Opening reauthorizes even when a thumbnail already obtained a URL.
  const preview = useQuery({
    ...attachmentPreviewQuery(workspaceId, file.id),
    refetchOnMount: "always",
  });
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const resumeAt = useRef(0);
  const platform = getPlatform();
  const download = useMutation({ mutationFn: () => downloadAttachment(workspaceId, file.id) });
  const external = useMutation({
    mutationFn: async () => {
      if (platform?.openAttachment)
        await platform.openAttachment(
          `/api/v1/workspaces/${workspaceId}/messenger/attachments/${file.id}/preview`,
        );
    },
  });
  return (
    <>
      <div className="flex h-[min(55dvh,36rem)] min-h-36 min-w-0 items-center justify-center rounded-lg border bg-background">
        {preview.isPending ? (
          <Loading label="Loading media…" />
        ) : preview.isError || failed ? (
          <div className="grid justify-items-center gap-3 p-4 text-center">
            <ErrorMessage
              error={
                preview.error ??
                new Error("The media could not load. Retry the preview or download the original.")
              }
            />
            <Button
              disabled={preview.isFetching}
              onClick={() => {
                void preview.refetch().then((result) => {
                  if (!result.isError) {
                    setFailed(false);
                    setAttempt((value) => value + 1);
                  }
                });
              }}
            >
              Retry preview
            </Button>
          </div>
        ) : preview.data ? (
          file.mimeType.startsWith("video/") ? (
            // Uploaded videos do not supply caption tracks; preserve native playback controls.
            // oxlint-disable-next-line jsx-a11y/media-has-caption
            <video
              key={attempt}
              src={preview.data.url}
              controls
              tabIndex={0}
              playsInline
              preload="metadata"
              aria-label={`Video: ${file.name}`}
              className="h-full max-h-full w-full object-contain"
              onError={(event) => {
                resumeAt.current = event.currentTarget.currentTime;
                setFailed(true);
              }}
              onLoadedMetadata={(event) => {
                if (resumeAt.current > 0) event.currentTarget.currentTime = resumeAt.current;
              }}
            />
          ) : (
            <img
              key={attempt}
              src={preview.data.url}
              alt={file.name}
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain"
              onError={() => setFailed(true)}
            />
          )
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          aria-label="Previous attachment"
          disabled={index === 0}
          onClick={onPrevious}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          aria-label="Next attachment"
          disabled={index === count - 1}
          onClick={onNext}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
        <Button className="ml-auto" disabled={download.isPending} onClick={() => download.mutate()}>
          <Download aria-hidden="true" />
          Download
        </Button>
        {platform?.openAttachment ? (
          <Button
            disabled={external.isPending || !preview.data || preview.isError}
            onClick={() => external.mutate()}
          >
            <ExternalLink aria-hidden="true" />
            Open externally
          </Button>
        ) : preview.data && !preview.isError ? (
          <Button asChild>
            <a href={preview.data.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Open externally
            </a>
          </Button>
        ) : null}
      </div>
      <ErrorMessage error={download.error ?? external.error} />
    </>
  );
}
