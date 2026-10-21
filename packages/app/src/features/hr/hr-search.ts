import { useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
export const hrSearchSchema = z.object({
  tab: z.string().max(40).optional().catch(undefined),
  q: z.string().max(100).optional().catch(undefined),
  offset: z.number().int().min(0).max(100000).optional().catch(undefined),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  status: z.string().max(30).optional().catch(undefined),
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
    q: search.q ?? "",
    offset: search.offset ?? 0,
    month: search.month,
    status: search.status,
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
