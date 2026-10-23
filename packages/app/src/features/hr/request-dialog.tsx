import {
  approvalInputSchema,
  hrUploadSchema,
  leavePoliciesSchema,
  type Approval,
  type RequestDetails,
} from "@lumolynk/contracts/hr";
import { Button, ErrorMessage, Field, SelectField, Textarea } from "@lumolynk/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";

import { api, command } from "../../lib/api";
import { hrPath, hrQuery, allPeopleQuery } from "./hr-api";
import { HrDialog, HrForm, formString } from "./hr-ui";
const labels = {
  leave: "Leave",
  expense: "Expense reimbursement",
  purchase: "Purchase request",
  overtime: "Overtime",
  travel: "Business travel",
  advance: "Cash advance",
  general: "General request",
};
export function RequestDialog({
  workspaceId,
  open,
  onClose,
  initialType = "general",
  leaveTypes = [],
  initialApproval,
}: {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
  initialType?: keyof typeof labels;
  leaveTypes?: { id: string; name: string }[];
  initialApproval?: Approval;
}) {
  const [type, setType] = useState<keyof typeof labels>(
      initialApproval && initialApproval.details.type !== "attendance_correction"
        ? initialApproval.details.type
        : initialType,
    ),
    [draft, setDraft] = useState(Boolean(initialApproval)),
    [file, setFile] = useState<File | null>(null);
  const people = useQuery(allPeopleQuery(workspaceId));
  const client = useQueryClient();
  const createdId = useRef<string | null>(initialApproval?.id ?? null),
    uploadedFile = useRef<File | null>(null);
  const policies = useQuery(hrQuery(workspaceId, "/leave/policies", leavePoliciesSchema));
  const categories = leaveTypes.length
    ? leaveTypes
    : (policies.data?.policies.filter((p) => !p.archived) ?? []);
  const initialField = (name: string) => {
    const value = Object.entries(initialApproval?.details ?? {}).find(([key]) => key === name)?.[1];
    return typeof value === "string" || typeof value === "number" ? value : "";
  };
  const save = useMutation({
    mutationFn: async (data: FormData) => {
      const str = (name: string) => formString(data, name),
        amount = () => Number(str("amountMinor"));
      let details: RequestDetails;
      switch (type) {
        case "leave":
          details = {
            type,
            leaveTypeId: str("leaveTypeId"),
            startDate: str("startDate"),
            endDate: str("endDate"),
            halfDay: str("halfDay") === "true",
          };
          break;
        case "expense":
          details = {
            type,
            amountMinor: amount(),
            currency: str("currency"),
            date: str("date"),
            category: str("category"),
          };
          break;
        case "purchase":
          details = {
            type,
            amountMinor: amount(),
            currency: str("currency"),
            quantity: Number(str("quantity")),
            vendor: str("vendor"),
          };
          break;
        case "travel":
          details = {
            type,
            destination: str("destination"),
            startDate: str("startDate"),
            endDate: str("endDate"),
            amountMinor: amount(),
            currency: str("currency"),
          };
          break;
        case "advance":
          details = {
            type,
            amountMinor: amount(),
            currency: str("currency"),
            repaymentDate: str("repaymentDate") || null,
          };
          break;
        case "overtime":
          details = { type, date: str("date"), durationMinutes: Number(str("durationMinutes")) };
          break;
        default:
          details = { type: "general" };
      }
      const approverId = str("approverId");
      const input = approvalInputSchema.parse({
        subject: str("subject"),
        description: str("description"),
        priority: str("priority"),
        details,
        approverIds: approverId && approverId !== "default" ? [approverId] : [],
        draft: true,
      });
      if (createdId.current)
        await command(`${hrPath(workspaceId)}/requests/${createdId.current}`, "PUT", input);
      else {
        const result = await api(`${hrPath(workspaceId)}/requests`, z.object({ id: z.uuid() }), {
          method: "POST",
          body: input,
        });
        createdId.current = result.id;
      }
      const result = { id: createdId.current };
      if (file && uploadedFile.current !== file) {
        await uploadHrFile(workspaceId, "request", result.id, file);
        uploadedFile.current = file;
      }
      if (!draft)
        await command(`${hrPath(workspaceId)}/requests/${result.id}/action`, "POST", {
          action: "submit",
        });
      return result;
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["workspace", workspaceId, "hr"] });
      onClose();
    },
  });
  return (
    <HrDialog title="New request" open={open} onClose={onClose}>
      <HrForm
        busy={save.isPending}
        error={save.error}
        label={draft ? "Save draft" : "Submit request"}
        onSubmit={(data) => save.mutate(data)}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.entries(labels).map(([value, label]) => (
            <Button
              key={value}
              variant={type === value ? "primary" : "secondary"}
              onClick={() => setType(value as keyof typeof labels)}
            >
              {label}
            </Button>
          ))}
        </div>
        <Field
          name="subject"
          defaultValue={initialApproval?.subject}
          label="Subject"
          required
          maxLength={160}
        />
        <label htmlFor="hr-request-description" className="grid gap-2 text-sm">
          Reason / description
          <Textarea
            defaultValue={initialApproval?.description}
            id="hr-request-description"
            name="description"
            maxLength={5000}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            name="priority"
            defaultValue={initialApproval?.priority ?? "normal"}
            label="Priority"
            options={[
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
            ]}
          />
          <SelectField
            name="approverId"
            label="Approver (workspace policy takes precedence)"
            options={[
              { value: "default", label: "Use manager / workspace policy" },
              ...(people.data?.people ?? []).map((p) => ({ value: p.userId, label: p.name })),
            ]}
          />
          {type === "leave" && (
            <>
              <SelectField
                name="leaveTypeId"
                defaultValue={String(initialField("leaveTypeId")) || undefined}
                label="Leave category"
                options={categories.map((t) => ({ value: t.id, label: t.name }))}
              />
              <SelectField
                name="halfDay"
                label="Duration"
                options={[
                  { value: "false", label: "Full days" },
                  { value: "true", label: "Half day" },
                ]}
              />
            </>
          )}
          {(type === "leave" || type === "travel") && (
            <>
              <Field
                name="startDate"
                defaultValue={initialField("startDate")}
                label="Start date"
                type="date"
                required
              />
              <Field
                name="endDate"
                defaultValue={initialField("endDate")}
                label="End date"
                type="date"
                required
              />
            </>
          )}
          {["expense", "purchase", "travel", "advance"].includes(type) && (
            <>
              <Field
                name="amountMinor"
                defaultValue={initialField("amountMinor")}
                label="Amount in centavos / minor units"
                type="number"
                min={type === "travel" ? 0 : 1}
                step="1"
                required
              />
              <Field
                name="currency"
                label="Currency"
                defaultValue="PHP"
                pattern="[A-Z]{3}"
                required
              />
            </>
          )}
          {(type === "expense" || type === "overtime") && (
            <Field
              name="date"
              defaultValue={initialField("date")}
              label="Date"
              type="date"
              required
            />
          )}
          {type === "expense" && (
            <Field
              name="category"
              defaultValue={initialField("category")}
              label="Expense category"
              required
            />
          )}
          {type === "purchase" && (
            <>
              <Field
                name="quantity"
                label="Quantity"
                type="number"
                min="1"
                step="1"
                defaultValue="1"
                required
              />
              <Field name="vendor" defaultValue={initialField("vendor")} label="Vendor" />
            </>
          )}
          {type === "travel" && (
            <Field
              name="destination"
              defaultValue={initialField("destination")}
              label="Destination"
              required
            />
          )}
          {type === "advance" && (
            <Field
              name="repaymentDate"
              defaultValue={initialField("repaymentDate")}
              label="Planned repayment date"
              type="date"
            />
          )}
          {type === "overtime" && (
            <Field
              name="durationMinutes"
              defaultValue={initialField("durationMinutes")}
              label="Overtime minutes"
              type="number"
              min="1"
              max="1440"
              required
            />
          )}
        </div>
        <Field
          type="file"
          label="Attachment (PDF, PNG, JPEG or text; up to 10 MB)"
          accept=".pdf,.png,.jpg,.jpeg,.txt"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <SelectField
          label="Save as"
          value={draft ? "draft" : "submit"}
          onValueChange={(v) => setDraft(v === "draft")}
          options={[
            { value: "submit", label: "Submit for approval" },
            { value: "draft", label: "Draft" },
          ]}
        />
        <ErrorMessage error={people.error} />
      </HrForm>
    </HrDialog>
  );
}
export async function uploadHrFile(
  workspaceId: string,
  type: "request" | "task",
  targetId: string,
  file: File,
) {
  const buffer = await file.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  const checksum = btoa(String.fromCharCode(...digest));
  const upload = await api(
    `${hrPath(workspaceId)}/files/${type}/${targetId}/uploads`,
    hrUploadSchema,
    {
      method: "POST",
      body: { name: file.name, mimeType: file.type || "text/plain", size: file.size, checksum },
    },
  );
  const response = await fetch(upload.url, {
    method: "PUT",
    headers: { "content-type": file.type || "text/plain", "x-amz-checksum-sha256": checksum },
    body: file,
  });
  if (!response.ok) throw new Error("File upload failed. Try attaching it again.");
  await command(`${hrPath(workspaceId)}/files/${upload.id}/complete`);
}
