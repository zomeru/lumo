import { useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
export const hrSearchSchema = z.object({
  tab: z.string().max(40).optional().catch(undefined),
  role: z.enum(["owner", "admin", "moderator", "member"]).optional().catch(undefined),
  sort: z.enum(["name", "jobTitle", "department", "role"]).optional().catch(undefined),
  order: z.enum(["asc", "desc"]).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  offset: z.number().int().min(0).max(100000).optional().catch(undefined),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  status: z.string().max(30).optional().catch(undefined),
  departmentId: z.uuid().optional().catch(undefined),
  employeeId: z.uuid().optional().catch(undefined),
  approverId: z.uuid().optional().catch(undefined),
  requestType: z.string().max(30).optional().catch(undefined),
  fromDate: z.iso.date().optional().catch(undefined),
  toDate: z.iso.date().optional().catch(undefined),
});
type HrRoute =
  | "/w/$workspaceId/people"
  | "/w/$workspaceId/approvals"
  | "/w/$workspaceId/leave"
  | "/w/$workspaceId/attendance"
  | "/w/$workspaceId/payroll"
  | "/w/$workspaceId/hr-onboarding";
export function useHrTab(fallback: string, from: HrRoute) {
  const search = useSearch({ strict: false }),
    navigate = useNavigate({ from });
  return [
    search.tab ?? fallback,
    (tab: string) => {
      void navigate({ search: (previous) => ({ ...previous, tab, offset: 0 }), replace: true });
    },
  ] as const;
}
export function useHrFilter(from: HrRoute) {
  const search = useSearch({ strict: false }),
    navigate = useNavigate({ from });
  return {
    role: search.role,
    sort: search.sort,
    order: search.order,
    q: search.q ?? "",
    offset: search.offset ?? 0,
    month: search.month,
    status: search.status,
    departmentId: search.departmentId,
    employeeId: search.employeeId,
    approverId: search.approverId,
    requestType: search.requestType,
    fromDate: search.fromDate,
    toDate: search.toDate,
    setFilters: (filters: Partial<z.infer<typeof hrSearchSchema>>) => {
      void navigate({ search: (previous) => ({ ...previous, ...filters }), replace: true });
    },
    setQ: (q: string) => {
      void navigate({ search: (previous) => ({ ...previous, q, offset: 0 }), replace: true });
    },
    setOffset: (offset: number) => {
      void navigate({ search: (previous) => ({ ...previous, offset }), replace: true });
    },
    setMonth: (month: string) => {
      void navigate({ search: (previous) => ({ ...previous, month }), replace: true });
    },
    setStatus: (status: string) => {
      void navigate({ search: (previous) => ({ ...previous, status }), replace: true });
    },
  };
}

export function useHrMonth(from: HrRoute, timezone: string) {
  const filters = useHrFilter(from),
    [today] = useState(() => new Date());
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(today);
  const current = `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
  return { month: filters.month ?? current, setMonth: filters.setMonth };
}
