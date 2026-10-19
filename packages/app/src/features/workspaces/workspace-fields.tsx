import type { WorkspaceInput } from "@lumo/contracts";
import { Field, FormField, SelectField, Textarea } from "@lumo/ui";

const choices = (values: string[]) => values.map((value) => ({ value, label: value }));
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
        placeholder="e.g. Acme Studio"
      />
      <FormField label="Description">
        <Textarea
          name="description"
          maxLength={1000}
          defaultValue={value.description}
          placeholder="What brings your team together?"
        />
      </FormField>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <SelectField
          label="Industry"
          name="industry"
          defaultValue={value.industry ?? ""}
          placeholder="Choose an industry"
          options={[
            { value: "", label: "Choose an industry" },
            ...choices([
              "Technology",
              "Retail",
              "Education",
              "Healthcare",
              "Professional services",
              "Other",
            ]),
          ]}
        />
        <SelectField
          label="Company size"
          name="companySize"
          defaultValue={value.companySize ?? "just-me"}
          options={[
            { value: "just-me", label: "Just me" },
            { value: "2-10", label: "2–10 people" },
            { value: "11-50", label: "11–50 people" },
            { value: "51-200", label: "51–200 people" },
            { value: "201+", label: "201+ people" },
          ]}
        />
        <Field
          label="Time zone"
          name="timezone"
          defaultValue={value.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone}
          required
          maxLength={100}
          hint="Use an IANA zone, such as Asia/Manila."
        />
        <SelectField
          label="Currency"
          name="currency"
          defaultValue={value.currency ?? "USD"}
          options={choices(["USD", "CNY", "PHP", "EUR", "GBP", "SGD"])}
        />
      </div>
      <SelectField
        label="Workspace language"
        name="language"
        defaultValue={value.language ?? "en"}
        options={[
          { value: "en", label: "English" },
          { value: "zh", label: "中文" },
          { value: "fil", label: "Filipino" },
        ]}
      />
      <SelectField
        label="Visibility"
        name="visibility"
        defaultValue={personal ? "private" : (value.visibility ?? "private")}
        disabled={personal}
        options={[
          { value: "private", label: "Private — invitation required" },
          { value: "invite-only", label: "Invite-only — invitation required" },
          { value: "public", label: "Public — discoverable, anyone can join" },
        ]}
      />
      {personal && <input type="hidden" name="visibility" value="private" />}
      <small>
        Private and invite-only workspaces are hidden from discovery. Public content still requires
        membership.
      </small>
    </>
  );
}
