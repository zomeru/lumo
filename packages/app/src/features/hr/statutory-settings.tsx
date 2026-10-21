import {
  statutoryConfigurationInputSchema,
  statutoryConfigurationsSchema,
  type StatutoryConfigurationInput,
} from "@lumo/contracts/payroll";
import { formatDateTime } from "@lumo/shared/date-time";
import {
  Badge,
  Button,
  Card,
  Checkbox,
  FormField,
  ErrorMessage,
  Field,
  Loading,
  SelectField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lumo/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { hrQuery, useHrAction } from "./hr-api";
import { HrForm } from "./hr-ui";

type Rules = StatutoryConfigurationInput;
type Policy = Pick<
  Rules["sss"],
  "enabled" | "exemptionReason" | "rounding" | "collection" | "salaryBasis"
>;
const roundingOptions = [
  { value: "nearest_centavo", label: "Nearest centavo (half away from zero)" },
  { value: "up_centavo", label: "Round up to centavo" },
  { value: "down_centavo", label: "Round down to centavo" },
];
function NumericField({
  label,
  value,
  onChange,
  percent = false,
  nullable = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  percent?: boolean;
  nullable?: boolean;
}) {
  return (
    <Field
      label={label}
      type="number"
      inputMode="decimal"
      min="0"
      max={percent ? "100" : "10000000000"}
      step="0.01"
      required={!nullable}
      defaultValue={value === null ? "" : (value / 100).toFixed(2)}
      hint={nullable ? "Leave blank for no cap / open upper bound." : undefined}
      onChange={(event) => {
        const text = event.target.value;
        // Conversion only; all contribution arithmetic and validation run on the server.
        const [whole, fraction] = Number(text).toFixed(2).split(".");
        onChange(nullable && !text ? null : Number(whole) * 100 + Number(fraction));
      }}
    />
  );
}
function PolicyFields({
  label,
  policy,
  onChange,
  tax = false,
}: {
  label: string;
  policy: Policy;
  onChange: (policy: Policy) => void;
  tax?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label={`${label} calculation`}
        value={String(policy.enabled)}
        options={[
          { value: "true", label: "Enabled" },
          { value: "false", label: "Disabled with documented legal basis" },
        ]}
        onValueChange={(value) => onChange({ ...policy, enabled: value === "true" })}
      />
      <SelectField
        label={`${label} rounding`}
        value={policy.rounding}
        options={roundingOptions}
        onValueChange={(value) => onChange({ ...policy, rounding: value as Policy["rounding"] })}
      />
      {!tax && (
        <>
          <SelectField
            label={`${label} salary basis`}
            value={policy.salaryBasis}
            options={[
              { value: "monthly_basic", label: "Monthly basic salary" },
              { value: "monthly_compensation", label: "Monthly salary plus allowances" },
              { value: "period_remuneration", label: "Actual remuneration for the month" },
            ]}
            onValueChange={(value) =>
              onChange({ ...policy, salaryBasis: value as Policy["salaryBasis"] })
            }
          />
          <SelectField
            label={`${label} semimonthly collection`}
            value={policy.collection}
            options={[
              { value: "split", label: "Split monthly total across both cutoffs" },
              { value: "second_cutoff", label: "Collect at month-end / final cutoff" },
            ]}
            onValueChange={(value) =>
              onChange({ ...policy, collection: value as Policy["collection"] })
            }
          />
        </>
      )}
      {!policy.enabled && (
        <Field
          className="sm:col-span-2"
          label={`${label} legal exemption reason`}
          value={policy.exemptionReason}
          minLength={10}
          maxLength={500}
          required
          onChange={(event) => onChange({ ...policy, exemptionReason: event.target.value })}
        />
      )}
    </div>
  );
}
function EditableRows<T extends Record<string, number | null>>({
  label,
  rows,
  columns,
  emptyRow,
  onChange,
}: {
  label: string;
  rows: T[];
  columns: { key: keyof T & string; label: string; percent?: boolean; nullable?: boolean }[];
  emptyRow: T;
  onChange: (rows: T[]) => void;
}) {
  const [keys, setKeys] = useState(() => rows.map(() => crypto.randomUUID()));
  return (
    <details className="mt-4 min-w-0 rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        {label} ({rows.length} rows)
      </summary>
      <p className="my-3 text-xs">
        Amounts are PHP; upper bounds are exclusive. Salary tables must cover zero through an open
        final bracket. Review new rows before saving.
      </p>
      <Table className="min-w-[42rem]">
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key}>{column.label}</TableHead>
            ))}
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={keys[index]}>
              {columns.map((column) => (
                <TableCell key={column.key} className="min-w-36">
                  <NumericField
                    label={`${label} row ${index + 1} ${column.label}`}
                    value={row[column.key]!}
                    percent={column.percent}
                    nullable={column.nullable}
                    onChange={(value) =>
                      onChange(
                        rows.map((r, i) => (i === index ? { ...r, [column.key]: value } : r)),
                      )
                    }
                  />
                </TableCell>
              ))}
              <TableCell>
                <Button
                  type="button"
                  size="sm"
                  aria-label={`Remove ${label} row ${index + 1}`}
                  disabled={rows.length === 1}
                  onClick={() => {
                    setKeys(keys.filter((_, i) => i !== index));
                    onChange(rows.filter((_, i) => i !== index));
                  }}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button
        className="mt-3"
        type="button"
        size="sm"
        disabled={rows.length >= 100}
        onClick={() => {
          setKeys([...keys, crypto.randomUUID()]);
          onChange([...rows, { ...emptyRow }]);
        }}
      >
        Add {label} row
      </Button>
    </details>
  );
}
function Sources({
  sources,
  onChange,
}: {
  sources: Rules["sources"];
  onChange: (value: Rules["sources"]) => void;
}) {
  const [keys, setKeys] = useState(() => sources.map(() => crypto.randomUUID()));
  return (
    <fieldset className="grid min-w-0 gap-3 rounded-lg border p-4">
      <legend className="px-1 font-medium text-foreground">
        Official sources and review evidence
      </legend>
      {sources.map((source, index) => (
        <div key={keys[index]} className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <Field
            label={`Source ${index + 1} title`}
            required
            maxLength={200}
            value={source.title}
            onChange={(event) =>
              onChange(
                sources.map((s, i) => (i === index ? { ...s, title: event.target.value } : s)),
              )
            }
          />
          <Field
            label={`Source ${index + 1} HTTPS URL`}
            type="url"
            required
            value={source.url}
            onChange={(event) =>
              onChange(sources.map((s, i) => (i === index ? { ...s, url: event.target.value } : s)))
            }
          />
          <Button
            type="button"
            disabled={sources.length === 1}
            onClick={() => {
              setKeys(keys.filter((_, i) => i !== index));
              onChange(sources.filter((_, i) => i !== index));
            }}
            aria-label={`Remove source ${index + 1}`}
          >
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        className="justify-self-start"
        disabled={sources.length >= 20}
        onClick={() => {
          setKeys([...keys, crypto.randomUUID()]);
          onChange([...sources, { title: "", url: "" }]);
        }}
      >
        Add source
      </Button>
    </fieldset>
  );
}
function StatutoryEditor({
  initial,
  workspaceId,
  onDone,
}: {
  initial: Rules;
  workspaceId: string;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<Rules>(() => structuredClone(initial)),
    [error, setError] = useState<Error | null>(null);
  const action = useHrAction(workspaceId);
  const set = <K extends keyof Rules>(key: K, value: Rules[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const number = <K extends "sss" | "pagibig" | "philhealth">(
    group: K,
    key: keyof Rules[K],
    label: string,
    percent = false,
    nullable = false,
  ) => (
    <NumericField
      key={String(key)}
      label={label}
      value={draft[group][key] as number | null}
      percent={percent}
      nullable={nullable}
      onChange={(value) => set(group, { ...draft[group], [key]: value })}
    />
  );
  return (
    <HrForm
      busy={action.isPending}
      error={error ?? action.error}
      label="Save statutory configuration"
      onSubmit={(data) => {
        const parsed = statutoryConfigurationInputSchema.safeParse({
          ...draft,
          confirmed: data.get("confirmed") === "on",
        });
        if (!parsed.success) {
          setError(
            new Error(
              parsed.error.issues
                .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
                .join("\n"),
            ),
          );
          return;
        }
        setError(null);
        action.mutate(
          { path: "/payroll/statutory-configurations", body: parsed.data },
          { onSuccess: onDone },
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Configuration name"
          value={draft.label}
          required
          maxLength={120}
          onChange={(event) => set("label", event.target.value)}
        />
        <Field
          label="Statutory effective date"
          type="date"
          value={draft.effectiveFrom}
          required
          hint="First day of a month; existing versions remain in history."
          onChange={(event) => set("effectiveFrom", event.target.value)}
        />
        <Field
          label="Statutory review valid through"
          type="date"
          value={draft.validThrough}
          required
          onChange={(event) => set("validThrough", event.target.value)}
        />
        <Field
          label="Statutory change reason"
          value={draft.reason}
          required
          minLength={10}
          maxLength={1000}
          onChange={(event) => set("reason", event.target.value)}
        />
      </div>
      <fieldset className="min-w-0 rounded-lg border p-4">
        <legend className="px-1 font-semibold text-foreground">SSS</legend>
        <PolicyFields
          label="SSS"
          policy={draft.sss}
          onChange={(policy) => set("sss", { ...draft.sss, ...policy })}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {number("sss", "employeeBps", "SSS employee rate (%)", true)}
          {number("sss", "employerBps", "SSS employer rate (%)", true)}
          {number("sss", "mpfEmployeeBps", "SSS MPF employee rate (%)", true)}
          {number("sss", "mpfEmployerBps", "SSS MPF employer rate (%)", true)}
          {number("sss", "minimumCreditMinor", "SSS minimum monthly salary credit (PHP)")}
          {number("sss", "maximumCreditMinor", "SSS maximum monthly salary credit (PHP)")}
          {number("sss", "regularCreditCapMinor", "SSS regular credit cap (PHP)")}
          <SelectField
            label="Employer Employees’ Compensation"
            value={String(draft.sss.ecEnabled)}
            options={[
              { value: "true", label: "Use each bracket’s EC amount" },
              { value: "false", label: "No EC component" },
            ]}
            onValueChange={(value) => set("sss", { ...draft.sss, ecEnabled: value === "true" })}
          />
        </div>
        <EditableRows
          label="SSS brackets"
          rows={draft.sss.brackets}
          onChange={(brackets) => set("sss", { ...draft.sss, brackets })}
          emptyRow={{ fromMinor: 0, toMinor: null, salaryCreditMinor: 0, ecMinor: 0 }}
          columns={[
            { key: "fromMinor", label: "Salary from (PHP)" },
            { key: "toMinor", label: "Salary below (PHP)", nullable: true },
            { key: "salaryCreditMinor", label: "Salary credit (PHP)" },
            { key: "ecMinor", label: "Employer EC (PHP)" },
          ]}
        />
      </fieldset>
      <fieldset className="min-w-0 rounded-lg border p-4">
        <legend className="px-1 font-semibold text-foreground">Pag-IBIG</legend>
        <PolicyFields
          label="Pag-IBIG"
          policy={draft.pagibig}
          onChange={(policy) => set("pagibig", { ...draft.pagibig, ...policy })}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {number("pagibig", "compensationCapMinor", "Pag-IBIG compensation cap (PHP)")}
          {number(
            "pagibig",
            "employeeCapMinor",
            "Pag-IBIG employee contribution cap (PHP)",
            false,
            true,
          )}
          {number(
            "pagibig",
            "employerCapMinor",
            "Pag-IBIG employer contribution cap (PHP)",
            false,
            true,
          )}
        </div>
        <EditableRows
          label="Pag-IBIG brackets"
          rows={draft.pagibig.brackets}
          onChange={(brackets) => set("pagibig", { ...draft.pagibig, brackets })}
          emptyRow={{ fromMinor: 0, toMinor: null, employeeBps: 0, employerBps: 0 }}
          columns={[
            { key: "fromMinor", label: "Salary from (PHP)" },
            { key: "toMinor", label: "Salary below (PHP)", nullable: true },
            { key: "employeeBps", label: "Employee rate (%)", percent: true },
            { key: "employerBps", label: "Employer rate (%)", percent: true },
          ]}
        />
      </fieldset>
      <fieldset className="min-w-0 rounded-lg border p-4">
        <legend className="px-1 font-semibold text-foreground">PhilHealth</legend>
        <PolicyFields
          label="PhilHealth"
          policy={draft.philhealth}
          onChange={(policy) => set("philhealth", { ...draft.philhealth, ...policy })}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {number("philhealth", "totalBps", "PhilHealth total premium rate (%)", true)}
          {number("philhealth", "employeeShareBps", "PhilHealth employee share (%)", true)}
          {number("philhealth", "employerShareBps", "PhilHealth employer share (%)", true)}
          {number("philhealth", "floorMinor", "PhilHealth salary floor (PHP)")}
          {number("philhealth", "ceilingMinor", "PhilHealth salary ceiling (PHP)")}
          {number(
            "philhealth",
            "premiumCapMinor",
            "PhilHealth total premium cap (PHP)",
            false,
            true,
          )}
        </div>
      </fieldset>
      <fieldset className="min-w-0 rounded-lg border p-4">
        <legend className="px-1 font-semibold text-foreground">BIR withholding</legend>
        <PolicyFields
          label="BIR"
          tax
          policy={{ ...draft.bir, collection: "split", salaryBasis: "monthly_basic" }}
          onChange={({ enabled, exemptionReason, rounding }) =>
            set("bir", { ...draft.bir, enabled, exemptionReason, rounding })
          }
        />
        {(["monthly", "semimonthly"] as const).map((frequency) => (
          <EditableRows
            key={frequency}
            label={`BIR ${frequency}`}
            rows={draft.bir[frequency]}
            onChange={(rows) => set("bir", { ...draft.bir, [frequency]: rows })}
            emptyRow={{ thresholdMinor: 0, fixedMinor: 0, bps: 0 }}
            columns={[
              { key: "thresholdMinor", label: "Taxable threshold (PHP)" },
              { key: "fixedMinor", label: "Fixed tax (PHP)" },
              { key: "bps", label: "Marginal rate (%)", percent: true },
            ]}
          />
        ))}
      </fieldset>
      <Sources sources={draft.sources} onChange={(sources) => set("sources", sources)} />
      <FormField label="I reviewed the official sources, legal applicability, rates and brackets for this configuration">
        <Checkbox name="confirmed" required />
      </FormField>
      <p className="text-xs">
        Saving returns affected open runs to draft. Finalized periods require a subsequent-period
        correction. A separate reviewer still verifies payroll before release.
      </p>
      <Button
        type="button"
        disabled={action.isPending}
        className="justify-self-start"
        onClick={onDone}
      >
        Cancel configuration
      </Button>
    </HrForm>
  );
}
export function StatutorySettingsPanel({ workspaceId }: { workspaceId: string }) {
  const query = useQuery(
    hrQuery(workspaceId, "/payroll/statutory-configurations", statutoryConfigurationsSchema),
  );
  const [draft, setDraft] = useState<Rules | null>(null),
    [editorKey, setEditorKey] = useState(0);
  const edit = (value: Rules) => {
    const { label, validThrough, sources, sss, pagibig, philhealth, bir } = value;
    setDraft({
      label,
      validThrough,
      sources,
      sss,
      pagibig,
      philhealth,
      bir,
      effectiveFrom: "",
      reason: "",
      confirmed: true,
    });
    setEditorKey((key) => key + 1);
  };
  return (
    <Card>
      <h2>Philippine statutory configuration</h2>
      <p className="my-3">
        Configure effective SSS, Pag-IBIG, PhilHealth and BIR rules. Payroll calculates employee
        deductions and employer liabilities from the saved version for its period.
      </p>
      <ErrorMessage error={query.error} />
      {query.isPending && <Loading />}
      {query.data && (
        <>
          {!query.data.configurations.length && (
            <p className="mb-3 text-sm">
              No saved statutory configuration. Review the source template and save an applicable
              version before generating payroll.
            </p>
          )}
          {draft ? (
            <StatutoryEditor
              key={editorKey}
              initial={draft}
              workspaceId={workspaceId}
              onDone={() => setDraft(null)}
            />
          ) : (
            <Button
              type="button"
              className="mb-4"
              onClick={() => edit(query.data.configurations[0] ?? query.data.template)}
            >
              Configure statutory contributions
            </Button>
          )}
          <h3 className="mt-4 mb-2 text-sm font-semibold text-foreground">Configuration history</h3>
          {query.data.configurations.map((configuration) => (
            <details className="mb-3 rounded-lg border p-3" key={configuration.id}>
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                {configuration.effectiveFrom} · {configuration.label}
              </summary>
              <Badge>Immutable version</Badge>
              <p className="my-2 text-xs">
                Reviewed through {configuration.validThrough} · {configuration.reason}
              </p>
              <p className="text-xs">
                Saved {formatDateTime(configuration.createdAt)} · Reference {configuration.id}
              </p>
              <dl className="my-3 grid gap-1 text-xs">
                <div>
                  <dt className="inline font-medium">SSS: </dt>
                  <dd className="inline">
                    {configuration.sss.enabled
                      ? `${configuration.sss.employeeBps / 100}% employee / ${configuration.sss.employerBps / 100}% employer; ${configuration.sss.brackets.length} brackets`
                      : configuration.sss.exemptionReason}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium">Pag-IBIG: </dt>
                  <dd className="inline">
                    {configuration.pagibig.enabled
                      ? `${configuration.pagibig.brackets.length} contribution brackets`
                      : configuration.pagibig.exemptionReason}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium">PhilHealth: </dt>
                  <dd className="inline">
                    {configuration.philhealth.enabled
                      ? `${configuration.philhealth.totalBps / 100}% total premium`
                      : configuration.philhealth.exemptionReason}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium">BIR: </dt>
                  <dd className="inline">
                    {configuration.bir.enabled
                      ? "Monthly and semimonthly tables"
                      : configuration.bir.exemptionReason}
                  </dd>
                </div>
              </dl>
              {configuration.sources.map((source) => (
                <p key={source.url}>
                  <a
                    className="text-xs text-primary underline"
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.title}
                  </a>
                </p>
              ))}
              <Button type="button" size="sm" className="mt-3" onClick={() => edit(configuration)}>
                Use as new configuration draft
              </Button>
            </details>
          ))}
        </>
      )}
    </Card>
  );
}
