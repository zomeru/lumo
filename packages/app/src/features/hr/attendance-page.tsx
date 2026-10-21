import {
  approvalsSchema,
  attendanceSchema,
  canHr,
  csvResultSchema,
  holidaysSchema,
  schedulesSchema,
} from "@lumo/contracts/hr";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Field,
  Loading,
  PageHeading,
  SelectField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@lumo/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "../../lib/api";
import { hrAccessQuery, hrPath, hrQuery, allPeopleQuery, useHrAction } from "./hr-api";
import { useHrTab } from "./hr-search";
import { HrDialog, HrForm, HrTabs, formString, saveCsv } from "./hr-ui";
export function AttendancePage({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useHrTab("My attendance", "/w/$workspaceId/attendance"),
    [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7)),
    [correction, setCorrection] = useState<string | null>(null),
    [schedule, setSchedule] = useState(false);
  const access = useQuery(hrAccessQuery(workspaceId)),
    people = useQuery(allPeopleQuery(workspaceId)),
    action = useHrAction(workspaceId);
  const path = `/attendance?month=${month}&team=${tab === "Team attendance"}`;
  const attendance = useQuery(hrQuery(workspaceId, path, attendanceSchema));
  const schedules = useQuery({
    ...hrQuery(workspaceId, "/schedules", schedulesSchema),
    enabled: tab === "Schedules",
  });
  const holidays = useQuery({
    ...hrQuery(workspaceId, "/holidays", holidaysSchema),
    enabled: tab === "Schedules",
  });
  const adjustments = useQuery({
    ...hrQuery(workspaceId, "/requests?type=attendance_correction&view=mine", approvalsSchema),
    enabled: tab === "Adjustments",
  });
  const waiting = useQuery({
    ...hrQuery(workspaceId, "/requests?type=attendance_correction&view=waiting", approvalsSchema),
    enabled: tab === "Adjustments",
  });
  const download = useMutation({
    mutationFn: async () => {
      const data = await api(
        `${hrPath(workspaceId)}/attendance/export?month=${month}&team=${tab === "Team attendance"}`,
        csvResultSchema,
      );
      saveCsv(data.filename, data.content);
    },
  });
  if (!access.data)
    return (
      <>
        <ErrorMessage error={access.error} />
        {access.isPending && <Loading />}
      </>
    );
  const timezone = access.data.timezone,
    format = (instant: string | null) =>
      instant
        ? new Date(instant).toLocaleTimeString(undefined, {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—";
  const data = attendance.data;
  return (
    <>
      <PageHeading eyebrow="People & HR" title="Attendance">
        Clock actions use server time. Times are displayed in {timezone}; late arrival counts after
        the schedule’s grace period.
      </PageHeading>
      <HrTabs
        tabs={[
          "My attendance",
          ...(access.data.hasReports || canHr(access.data, "hr.attendance.read_team")
            ? ["Team attendance"]
            : []),
          "Adjustments",
          ...(canHr(access.data, "hr.attendance.manage_policy") ? ["Schedules"] : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      <ErrorMessage error={attendance.error ?? action.error ?? download.error} />
      {(tab === "My attendance" || tab === "Team attendance") && (
        <>
          <div className="mb-5 grid gap-4 lg:grid-cols-3">
            {tab === "My attendance" && (
              <Card className="text-center">
                <p>
                  {data?.serverTime
                    ? new Date(data.serverTime).toLocaleDateString(undefined, {
                        timeZone: timezone,
                      })
                    : "Server clock"}
                </p>
                <time className="my-3 block text-3xl font-semibold">
                  {format(data?.serverTime ?? null)}
                </time>
                <Badge>{data?.state ?? "Loading"}</Badge>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {(data?.state === "out"
                    ? ["clock_in"]
                    : data?.state === "break"
                      ? ["end_break"]
                      : ["start_break", "clock_out"]
                  ).map((value) => (
                    <Button
                      key={value}
                      variant="primary"
                      disabled={!data || action.isPending}
                      onClick={() =>
                        action.mutate({
                          path: "/attendance/punch",
                          body: { action: value, idempotencyKey: crypto.randomUUID() },
                        })
                      }
                    >
                      {
                        {
                          clock_in: "Clock in",
                          clock_out: "Clock out",
                          start_break: "Start break",
                          end_break: "End break",
                        }[value]
                      }
                    </Button>
                  ))}
                </div>
              </Card>
            )}
            <div className="grid grid-cols-2 gap-3 lg:col-span-2">
              {[
                ["Days present", data?.metrics.daysPresent ?? 0],
                ["Late arrivals", data?.metrics.lateArrivals ?? 0],
                ["Hours worked", ((data?.metrics.workedMinutes ?? 0) / 60).toFixed(2)],
                ["Absences", data?.metrics.absences ?? 0],
              ].map(([label, value]) => (
                <Card key={label} className="p-4">
                  <p>{label}</p>
                  <strong className="text-2xl">{value}</strong>
                </Card>
              ))}
            </div>
          </div>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <Field
              type="month"
              label="Month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
              }}
            />
            <Button disabled={download.isPending || !data} onClick={() => download.mutate()}>
              Export CSV
            </Button>
          </div>
          {attendance.isPending ? (
            <Loading />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {[
                    ...(tab === "Team attendance" ? ["Person"] : []),
                    "Date",
                    "Scheduled",
                    "In",
                    "Out",
                    "Break",
                    "Worked",
                    "Late",
                    "Undertime",
                    "Overtime",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.days.map((d) => (
                  <TableRow key={`${d.userId}:${d.date}`}>
                    {tab === "Team attendance" && (
                      <TableCell>
                        {people.data?.people.find((p) => p.userId === d.userId)?.name ?? "Member"}
                      </TableCell>
                    )}
                    <TableCell>{d.date}</TableCell>
                    <TableCell>{d.scheduled}</TableCell>
                    <TableCell>{format(d.clockIn)}</TableCell>
                    <TableCell>{format(d.clockOut)}</TableCell>
                    <TableCell>{d.breakMinutes}m</TableCell>
                    <TableCell>{d.workedMinutes}m</TableCell>
                    <TableCell>
                      {d.lateMinutes}m {d.late ? "Late" : ""}
                    </TableCell>
                    <TableCell>{d.undertimeMinutes}m</TableCell>
                    <TableCell>
                      {d.overtimeMinutes}m ({d.approvedOvertimeMinutes} approved)
                    </TableCell>
                    <TableCell>
                      <Badge>{d.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {d.userId === access.data.userId && (
                        <Button size="sm" onClick={() => setCorrection(d.date)}>
                          Correct
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
      {tab === "Adjustments" && (
        <>
          <ErrorMessage error={adjustments.error ?? waiting.error} />
          <h2 className="mb-3">Waiting for review</h2>
          {waiting.data?.requests.length ? (
            waiting.data.requests.map((r) => (
              <Card key={r.id} className="mb-3">
                <h3>{r.subject}</h3>
                <p>{r.description}</p>
                <pre className="overflow-auto text-xs">{JSON.stringify(r.details, null, 2)}</pre>
                <div className="mt-3 flex gap-2">
                  {["approve", "reject"].map((value) => (
                    <Button
                      key={value}
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({ path: `/requests/${r.id}/action`, body: { action: value } })
                      }
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </Card>
            ))
          ) : (
            <EmptyState title="No corrections waiting" />
          )}
          <h2 className="mt-6 mb-3">My correction requests</h2>
          {adjustments.data?.requests.map((r) => (
            <Card key={r.id} className="mb-3">
              <strong>{r.subject}</strong>
              <Badge>{r.status}</Badge>
            </Card>
          ))}
        </>
      )}
      {tab === "Schedules" && (
        <>
          <Button className="mb-4" onClick={() => setSchedule(true)}>
            Assign work schedule
          </Button>
          <ErrorMessage error={schedules.error ?? holidays.error} />
          {schedules.data?.schedules.map((s) => (
            <Card key={s.id} className="mb-3">
              <strong>
                {people.data?.people.find((p) => p.userId === s.userId)?.name ?? "Member"}
              </strong>
              <p>
                Effective {s.effectiveFrom} · weekdays {s.weekdays.join(", ")} · grace{" "}
                {s.graceMinutes} minutes · {s.timezone}
              </p>
            </Card>
          ))}
          <h2 className="my-4">Workspace holidays</h2>
          <HrForm
            busy={action.isPending}
            error={action.error}
            label="Save holiday"
            onSubmit={(data) =>
              action.mutate({
                path: "/holidays",
                body: { date: formString(data, "date"), name: formString(data, "name") },
              })
            }
          >
            <Field label="Holiday date" name="date" type="date" required />
            <Field label="Holiday name" name="name" required />
          </HrForm>
          {holidays.data?.holidays.map((h) => (
            <p key={h.date} className="mt-3">
              {h.date} · {h.name}
            </p>
          ))}
        </>
      )}
      <HrDialog
        title="Request attendance correction"
        open={!!correction}
        onClose={() => setCorrection(null)}
      >
        <HrForm
          busy={action.isPending}
          error={action.error}
          label="Submit correction"
          onSubmit={(data) =>
            action.mutate(
              {
                path: "/requests",
                body: {
                  subject: `Attendance correction ${correction}`,
                  description: formString(data, "reason"),
                  details: {
                    type: "attendance_correction",
                    date: correction,
                    clockIn: new Date(`${formString(data, "clockIn")}Z`).toISOString(),
                    clockOut: new Date(`${formString(data, "clockOut")}Z`).toISOString(),
                    breakMinutes: Number(formString(data, "breakMinutes")),
                  },
                },
              },
              { onSuccess: () => setCorrection(null) },
            )
          }
        >
          <p>{correction} · original punches are preserved after review.</p>
          <Field label="Correct clock in (UTC)" name="clockIn" type="datetime-local" required />
          <Field label="Correct clock out (UTC)" name="clockOut" type="datetime-local" required />
          <Field
            label="Unpaid break minutes"
            name="breakMinutes"
            type="number"
            min="0"
            defaultValue="0"
            required
          />
          <Field label="Reason" name="reason" required />
        </HrForm>
      </HrDialog>
      <HrDialog
        title="Assign effective work schedule"
        open={schedule}
        onClose={() => setSchedule(false)}
      >
        <HrForm
          busy={action.isPending}
          error={action.error}
          onSubmit={(data) => {
            const minute = (name: string) => {
              const [hours, minutes] = formString(data, name).split(":").map(Number);
              return hours! * 60 + minutes!;
            };
            action.mutate(
              {
                path: "/schedules",
                body: {
                  userId: formString(data, "userId"),
                  effectiveFrom: formString(data, "effectiveFrom"),
                  weekdays: formString(data, "weekdays").split(",").map(Number),
                  startMinute: minute("start"),
                  endMinute: minute("end"),
                  breakMinutes: Number(formString(data, "breakMinutes")),
                  graceMinutes: Number(formString(data, "graceMinutes")),
                  paidBreaks: formString(data, "paidBreaks") === "true",
                },
              },
              { onSuccess: () => setSchedule(false) },
            );
          }}
        >
          <SelectField
            label="Employee"
            name="userId"
            options={(people.data?.people ?? []).map((p) => ({ value: p.userId, label: p.name }))}
          />
          <Field label="Effective date" name="effectiveFrom" type="date" required />
          <Field
            label="Workdays (0=Sunday, comma separated)"
            name="weekdays"
            defaultValue="1,2,3,4,5"
            required
          />
          <Field
            label="Start (workspace local time)"
            name="start"
            type="time"
            defaultValue="08:00"
            required
          />
          <Field
            label="End (earlier time means overnight)"
            name="end"
            type="time"
            defaultValue="17:00"
            required
          />
          <Field
            label="Scheduled break minutes"
            name="breakMinutes"
            type="number"
            min="0"
            defaultValue="60"
            required
          />
          <Field
            label="Grace minutes"
            name="graceMinutes"
            type="number"
            min="0"
            defaultValue="15"
            required
          />
          <SelectField
            label="Break policy"
            name="paidBreaks"
            options={[
              { value: "false", label: "Unpaid" },
              { value: "true", label: "Paid" },
            ]}
          />
        </HrForm>
      </HrDialog>
    </>
  );
}
