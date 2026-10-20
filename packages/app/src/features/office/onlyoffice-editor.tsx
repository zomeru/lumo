import { officeEditorSchema } from "@lumo/contracts/office";
import { Button, ErrorMessage, Loading } from "@lumo/ui";
import type { Config } from "@onlyoffice/doceditor-types";
import { DocumentEditor } from "@onlyoffice/document-editor-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../../lib/api";
import { officePath } from "./office-api";
export default function OnlyofficeEditor({
  workspaceId,
  id,
  onDirty,
  sessionKey,
}: {
  workspaceId: string;
  id: string;
  onDirty: (value: boolean) => void;
  sessionKey: string;
}) {
  const [error, setError] = useState<Error | null>(null),
    [ready, setReady] = useState(false),
    [warning, setWarning] = useState<Error | null>(null);
  const config = useQuery({
    queryKey: ["workspace", workspaceId, "office", id, "editor", sessionKey],
    queryFn: ({ signal }) =>
      api(`${officePath(workspaceId, id)}/editor-config`, officeEditorSchema, {
        method: "POST",
        body: {},
        signal,
      }),
    retry: false,
    gcTime: 0,
    staleTime: "static",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (config.isError || error)
    return (
      <div className="grid gap-4 p-6">
        <ErrorMessage error={config.error ?? error} />
        <p>
          Your saved versions remain available in history and Drive. Check your connection or ask
          your workspace administrator to check the document service.
        </p>
        <Button
          onClick={() => {
            setError(null);
            setReady(false);
            void config.refetch();
          }}
        >
          Retry editor
        </Button>
      </div>
    );
  if (!config.data) return <Loading label="Connecting to document service…" />;
  const events: Config["events"] = {
    onDocumentReady: () => setReady(true),
    onDocumentStateChange: (event) => onDirty(Boolean(event.data)),
    onError: (event) =>
      setError(
        new Error(
          `The document service reported a problem (${event.data?.errorCode ?? "unknown"}). Check the save status before closing.`,
        ),
      ),
    onWarning: () =>
      setWarning(
        new Error(
          "The document service could not complete this operation. Your last saved version is retained.",
        ),
      ),
  };
  return (
    <div className="relative h-full min-h-0 flex-1" aria-label="Office editor" aria-busy={!ready}>
      {warning && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-surface p-3">
          <ErrorMessage error={warning} />
          <Button size="sm" onClick={() => setWarning(null)}>
            Dismiss
          </Button>
        </div>
      )}
      {!ready && (
        <div className="absolute inset-x-0 top-0 z-10 bg-surface p-3">
          <Loading label="Opening document…" />
        </div>
      )}
      <DocumentEditor
        id={`office-${id}`}
        documentServerUrl={config.data.documentServerUrl}
        config={{ ...config.data.config, width: "100%", height: "100%", events }}
        onLoadComponentError={() =>
          setError(
            new Error("Unable to load the document service. Check your connection and retry."),
          )
        }
      />
    </div>
  );
}
