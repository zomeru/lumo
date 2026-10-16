import type { WorkspaceInput } from "@lumo/contracts";

import { Field, SelectField } from "@/components/ui";

export function WorkspaceFields({
  value = {},
  personal = false,
}: {
  value?: Partial<WorkspaceInput>;
  personal?: boolean;
}) {
  return (
    <>
      <Field
        label="Company or team name"
        name="name"
        required
        maxLength={100}
        defaultValue={value.name}
        placeholder="e.g. Bayanihan Foods Inc."
      />
      <Field
        label="Description"
        name="description"
        maxLength={1000}
        defaultValue={value.description}
        placeholder="What brings your team together?"
      />
      <div className="form-grid">
        <SelectField label="Industry" name="industry" defaultValue={value.industry ?? ""}>
          <option value="">Choose an industry</option>
          {[
            "Technology",
            "Retail",
            "Education",
            "Healthcare",
            "Professional services",
            "Other",
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </SelectField>
        <SelectField
          label="Company size"
          name="companySize"
          defaultValue={value.companySize ?? "just-me"}
        >
          <option value="just-me">Just me</option>
          <option value="2-10">2–10 people</option>
          <option value="11-50">11–50 people</option>
          <option value="51-200">51–200 people</option>
          <option value="201+">201+ people</option>
        </SelectField>
        <Field
          label="Time zone"
          name="timezone"
          defaultValue={value.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
          required
          maxLength={100}
          hint="Use an IANA zone, such as Asia/Manila."
        />
        <SelectField label="Currency" name="currency" defaultValue={value.currency ?? "USD"}>
          {["USD", "CNY", "PHP", "EUR", "GBP", "SGD"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </SelectField>
      </div>
      <SelectField label="Workspace language" name="language" defaultValue={value.language ?? "en"}>
        <option value="en">English</option>
        <option value="zh">中文</option>
        <option value="fil">Filipino</option>
      </SelectField>
      <SelectField
        label="Visibility"
        name="visibility"
        defaultValue={personal ? "private" : (value.visibility ?? "private")}
        disabled={personal}
      >
        <option value="private">Private — invitation required</option>
        <option value="invite-only">Invite-only — invitation required</option>
        <option value="public">Public — discoverable, anyone can join</option>
      </SelectField>
      {personal && <input type="hidden" name="visibility" value="private" />}
      <small>
        Private and invite-only workspaces are hidden from discovery. Public content still requires
        membership.
      </small>
    </>
  );
}
