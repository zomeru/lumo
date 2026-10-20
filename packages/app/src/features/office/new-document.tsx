import { officeDetailSchema, type OfficeKind } from "@lumo/contracts/office";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Field,
  SelectField,
  ErrorMessage,
} from "@lumo/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { api } from "../../lib/api";
import { officeLocation, moduleIcons, kindModules } from "./file-modules";
import { officePath } from "./office-api";
const documentKinds = [
  { value: "document", label: "Document" },
  { value: "sheet", label: "Spreadsheet" },
  { value: "slide", label: "Presentation" },
  { value: "wiki", label: "Wiki page" },
] as const;
export function NewDocument({
  workspaceId,
  parentId = null,
  parentPageId = null,
  initialKind = "document",
  close,
  allowTypeSelection = false,
}: {
  workspaceId: string;
  parentId?: string | null;
  parentPageId?: string | null;
  initialKind?: OfficeKind;
  close: () => void;
  allowTypeSelection?: boolean;
}) {
  const [name, setName] = useState("Untitled"),
    [kind, setKind] = useState<OfficeKind>(initialKind);
  const client = useQueryClient(),
    navigate = useNavigate();
  const create = useMutation({
    mutationFn: () =>
      api(officePath(workspaceId), officeDetailSchema, {
        method: "POST",
        body: { name, kind, parentId, parentPageId },
      }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      close();
      await navigate(officeLocation(workspaceId, result.item.id, result.kind));
    },
  });
  const Icon = moduleIcons[kindModules[kind]];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !create.isPending) close();
      }}
    >
      <DialogContent>
        <DialogTitle className="flex items-center gap-2">
          <Icon className="size-5" aria-hidden="true" />
          New {documentKinds.find((v) => v.value === kind)?.label.toLowerCase()}
        </DialogTitle>
        <DialogDescription>
          Create a private file. Share it with your team when ready.
        </DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <ErrorMessage error={create.error} />
          <Field
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={235}
          />
          {allowTypeSelection && !parentPageId && (
            <SelectField
              label="Type"
              value={kind}
              options={[...documentKinds]}
              onValueChange={(value) => {
                const found = documentKinds.find((v) => v.value === value);
                if (found) setKind(found.value);
              }}
            />
          )}
          <Button
            type="submit"
            variant="primary"
            loading={create.isPending}
            disabled={!name.trim()}
          >
            Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
