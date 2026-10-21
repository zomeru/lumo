import { canHr, type Person } from "@lumo/contracts/hr";
import { canInvite } from "@lumo/contracts/permissions";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Field,
  Loading,
  PageHeading,
  FilterBar,
  ViewTabs,
  SelectField,
} from "@lumo/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { workspaceQuery } from "../../lib/api";
import { HrAdmin } from "./hr-admin";
import {
  departmentsQuery,
  hrAccessQuery,
  allPeopleQuery,
  peopleQuery,
  useHrAction,
} from "./hr-api";
import { hrIcons } from "./hr-icons";
import { useHrTab, useHrFilter } from "./hr-search";
import { HrDialog, HrForm, formString } from "./hr-ui";
export function PeoplePage({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useHrTab("Directory", "/w/$workspaceId/people"),
    [selected, setSelected] = useState<Person | null>(null),
    [department, setDepartment] = useState<{
      id?: string;
      name: string;
      managerId: string | null;
      archived: boolean;
    } | null>(null);
  const filters = useHrFilter("/w/$workspaceId/people");
  const { q, setQ, offset, setOffset } = useHrFilter("/w/$workspaceId/people");
  const people = useQuery(
      peopleQuery(workspaceId, q, offset, filters.departmentId, filters.status),
    ),
    all = useQuery(allPeopleQuery(workspaceId)),
    departments = useQuery(departmentsQuery(workspaceId)),
    access = useQuery(hrAccessQuery(workspaceId)),
    ws = useQuery(workspaceQuery(workspaceId));
  const action = useHrAction(workspaceId);
  if (!access.data)
    return (
      <>
        <ErrorMessage error={access.error} />
        {access.isPending && <Loading />}
      </>
    );
  const manage = canHr(access.data, "hr.people.manage"),
    manageDepartments = canHr(access.data, "hr.departments.manage");
  const choices = [
    { value: "none", label: "None" },
    ...(all.data?.people ?? [])
      .filter((p) => p.userId !== selected?.userId)
      .map((p) => ({ value: p.userId, label: p.name })),
  ];
  return (
    <>
      <PageHeading
        icon={<hrIcons.people className="size-6" aria-hidden="true" />}
        eyebrow="People & HR"
        title="People"
        actions={
          ws.data && canInvite(ws.data.role) ? (
            <Button asChild variant="primary">
              <Link to="/w/$workspaceId/members" params={{ workspaceId }}>
                Invite people
              </Link>
            </Button>
          ) : null
        }
      >
        Your workspace directory and reporting relationships.
      </PageHeading>
      <ViewTabs
        tabs={[
          "Directory",
          "Org chart",
          "Departments",
          ...(canHr(access.data, "hr.approvals.manage") ||
          canHr(access.data, "hr.permissions.manage")
            ? ["HR administration"]
            : []),
        ]}
        value={tab}
        onChange={setTab}
      />
      <ErrorMessage error={people.error ?? departments.error ?? action.error} />
      {tab === "Directory" && (
        <>
          <Field
            label="Search people"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
            className="mb-5 max-w-md"
          />
          <FilterBar>
            <SelectField
              label="Directory department"
              value={filters.departmentId ?? "all"}
              onValueChange={(value) =>
                filters.setFilters({ departmentId: value === "all" ? undefined : value, offset: 0 })
              }
              options={[
                { value: "all", label: "All departments" },
                ...(departments.data?.departments ?? []).map((d) => ({
                  value: d.id,
                  label: d.name,
                })),
              ]}
            />
            <SelectField
              label="Employment status filter"
              value={filters.status ?? "all"}
              onValueChange={(status) => filters.setFilters({ status, offset: 0 })}
              options={[
                { value: "all", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "on_leave", label: "On leave" },
                { value: "terminated", label: "Terminated" },
              ]}
            />
          </FilterBar>
          {people.isPending ? (
            <Loading />
          ) : people.data?.people.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {people.data.people.map((p) => (
                <Card key={p.userId} className="flex items-start gap-3 p-4">
                  <Avatar name={p.name} src={p.image ?? undefined} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm">{p.name}</h2>
                    <p>{p.jobTitle || "Workspace member"}</p>
                    <small>
                      {p.department} {p.location}
                    </small>
                    <Badge>{p.status}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(p)}>
                      View profile
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No people match your search" />
          )}
          <div className="mt-4 flex gap-2">
            {offset > 0 && (
              <Button onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button>
            )}
            {people.data?.nextOffset != null && (
              <Button onClick={() => setOffset(people.data!.nextOffset!)}>Next</Button>
            )}
          </div>
        </>
      )}
      {tab === "Org chart" && <OrgChart people={all.data?.people ?? []} />}
      {tab === "Departments" && (
        <>
          <div className="mb-4">
            {manageDepartments && (
              <Button onClick={() => setDepartment({ name: "", managerId: null, archived: false })}>
                Add department
              </Button>
            )}
          </div>
          {departments.data?.departments.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {departments.data.departments.map((d) => (
                <Card key={d.id}>
                  <h2>{d.name}</h2>
                  <p>
                    {d.employeeCount} employees · {d.archived ? "Archived" : "Active"}
                  </p>
                  <p>
                    Manager:{" "}
                    {all.data?.people.find((p) => p.userId === d.managerId)?.name ?? "Unassigned"}
                  </p>
                  {manageDepartments && (
                    <Button size="sm" onClick={() => setDepartment(d)}>
                      Edit department
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="No departments yet" />
          )}
        </>
      )}
      {tab === "HR administration" && <HrAdmin workspaceId={workspaceId} access={access.data} />}
      <HrDialog
        title={selected?.name ?? "Employee profile"}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <HrForm
            readOnly={!manage}
            busy={action.isPending}
            error={action.error}
            onSubmit={(data) =>
              action.mutate(
                {
                  path: `/people/${selected.userId}`,
                  method: "PUT",
                  body: {
                    employeeCode: formString(data, "employeeCode"),
                    jobTitle: formString(data, "jobTitle"),
                    departmentId:
                      formString(data, "departmentId") === "none"
                        ? null
                        : formString(data, "departmentId"),
                    managerId:
                      formString(data, "managerId") === "none"
                        ? null
                        : formString(data, "managerId"),
                    employmentType: formString(data, "employmentType"),
                    status: formString(data, "status"),
                    hireDate: formString(data, "hireDate") || null,
                    endDate: formString(data, "endDate") || null,
                    location: formString(data, "location"),
                  },
                },
                { onSuccess: () => setSelected(null) },
              )
            }
          >
            <fieldset disabled={!manage} className="grid gap-4 sm:grid-cols-2">
              <Field
                name="employeeCode"
                label="Employee code"
                defaultValue={selected.employeeCode}
              />
              <Field name="jobTitle" label="Job title" defaultValue={selected.jobTitle} />
              <SelectField
                label="Department"
                name="departmentId"
                defaultValue={selected.departmentId ?? "none"}
                options={[
                  { value: "none", label: "No department" },
                  ...(departments.data?.departments ?? [])
                    .filter((d) => !d.archived || d.id === selected.departmentId)
                    .map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
              <SelectField
                label="Manager"
                name="managerId"
                defaultValue={selected.managerId ?? "none"}
                options={choices}
              />
              <SelectField
                label="Employment type"
                name="employmentType"
                defaultValue={selected.employmentType}
                options={["employee", "contractor", "intern"].map((value) => ({
                  value,
                  label: value,
                }))}
              />
              <SelectField
                label="Employment status"
                name="status"
                defaultValue={selected.status}
                options={["active", "on_leave", "terminated"].map((value) => ({
                  value,
                  label: value,
                }))}
              />
              <Field
                name="hireDate"
                label="Hire date"
                type="date"
                defaultValue={selected.hireDate ?? ""}
              />
              <Field
                name="endDate"
                label="End date"
                type="date"
                defaultValue={selected.endDate ?? ""}
              />
              <Field name="location" label="Work location" defaultValue={selected.location} />
            </fieldset>
            {!manage && <p>Employment information is managed by authorized HR staff.</p>}
          </HrForm>
        )}
      </HrDialog>
      <HrDialog title="Department" open={!!department} onClose={() => setDepartment(null)}>
        {department && (
          <HrForm
            busy={action.isPending}
            error={action.error}
            onSubmit={(data) =>
              action.mutate(
                {
                  path: department.id ? `/departments/${department.id}` : "/departments",
                  method: department.id ? "PUT" : "POST",
                  body: {
                    name: formString(data, "name"),
                    managerId:
                      formString(data, "managerId") === "none"
                        ? null
                        : formString(data, "managerId"),
                    archived: formString(data, "archived") === "true",
                  },
                },
                { onSuccess: () => setDepartment(null) },
              )
            }
          >
            <Field
              name="name"
              label="Department name"
              defaultValue={department.name}
              required
              maxLength={100}
            />
            <SelectField
              name="managerId"
              label="Department manager"
              defaultValue={department.managerId ?? "none"}
              options={choices}
            />
            <SelectField
              name="archived"
              label="Status"
              defaultValue={String(department.archived)}
              options={[
                { value: "false", label: "Active" },
                { value: "true", label: "Archived" },
              ]}
            />
          </HrForm>
        )}
      </HrDialog>
    </>
  );
}

function OrgChart({ people }: { people: Person[] }) {
  const visited = new Set<string>();
  function branch(person: Person, ancestors: Set<string>): ReactNode {
    if (ancestors.has(person.userId))
      return (
        <li key={`cycle:${person.userId}`} role="alert">
          Reporting cycle detected for {person.name}. Ask HR to correct the manager assignment.
        </li>
      );
    visited.add(person.userId);
    const next = new Set(ancestors);
    next.add(person.userId);
    const reports = people.filter((p) => p.managerId === person.userId);
    return (
      <li key={person.userId}>
        <Card className="mb-3 p-4">
          <strong>{person.name}</strong>
          <p>
            {person.jobTitle || "Workspace member"} · {person.department || "No department"}
          </p>
          <small>
            Reports to:{" "}
            {person.managerId
              ? (people.find((p) => p.userId === person.managerId)?.name ?? "Manager unavailable")
              : "No manager assigned"}
          </small>
          <p>Direct reports: {reports.map((p) => p.name).join(", ") || "None"}</p>
        </Card>
        {reports.length > 0 && (
          <ul className="ml-5 border-l pl-4">{reports.map((p) => branch(p, next))}</ul>
        )}
      </li>
    );
  }
  const roots = people.filter((p) => !p.managerId || !people.some((m) => m.userId === p.managerId));
  const nodes = roots.map((p) => branch(p, new Set()));
  for (const person of people)
    if (!visited.has(person.userId)) nodes.push(branch(person, new Set()));
  return (
    <section aria-label="Reporting hierarchy">
      <ul>{nodes}</ul>
    </section>
  );
}
