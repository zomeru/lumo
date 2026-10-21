import { idSchema } from "@lumo/contracts";
import { departmentInputSchema, employmentInputSchema, hrPageSchema } from "@lumo/contracts/hr";
import { hrDepartment, hrEmployee, membership, user } from "@lumo/database/schema";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { ApiContext } from "../../lib/context";
import { AppError, missing, parse } from "../../lib/errors";
import { auditHr, requireHrMember, type HrCore } from "./core";

export function peopleRoutes(core: HrCore) {
  const app = new Hono<ApiContext>();
  app.get("/people", async (c) => {
    const { q, offset, limit } = parse(hrPageSchema, c.req.query());
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        const rows = await ctx.tx
          .select({
            userId: user.id,
            name: user.name,
            image: user.image,
            role: membership.role,
            employeeCode: sql<string>`coalesce(${hrEmployee.employeeCode}, '')`,
            jobTitle: sql<string>`coalesce(${hrEmployee.jobTitle}, '')`,
            departmentId: hrEmployee.departmentId,
            department: sql<string>`coalesce(${hrDepartment.name}, '')`,
            managerId: hrEmployee.managerId,
            employmentType: sql<string>`coalesce(${hrEmployee.employmentType}, 'employee')`,
            status: sql<string>`coalesce(${hrEmployee.status}, 'active')`,
            hireDate: hrEmployee.hireDate,
            endDate: hrEmployee.endDate,
            location: sql<string>`coalesce(${hrEmployee.location}, '')`,
          })
          .from(membership)
          .innerJoin(user, eq(user.id, membership.userId))
          .leftJoin(
            hrEmployee,
            and(
              eq(hrEmployee.workspaceId, membership.workspaceId),
              eq(hrEmployee.userId, membership.userId),
            ),
          )
          .leftJoin(
            hrDepartment,
            and(
              eq(hrDepartment.workspaceId, membership.workspaceId),
              eq(hrDepartment.id, hrEmployee.departmentId),
            ),
          )
          .where(
            and(
              eq(membership.workspaceId, ctx.workspaceId),
              q
                ? or(
                    ilike(user.name, `%${q}%`),
                    ilike(hrEmployee.jobTitle, `%${q}%`),
                    ilike(hrDepartment.name, `%${q}%`),
                  )
                : undefined,
            ),
          )
          .orderBy(asc(user.name), asc(user.id))
          .offset(offset)
          .limit(limit + 1);
        return {
          people: rows.slice(0, limit),
          nextOffset: rows.length > limit ? offset + limit : null,
        };
      }),
    );
  });
  app.put("/people/:id", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      input = parse(employmentInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.people.manage");
      await requireHrMember(ctx, id);
      if (input.managerId) await requireHrMember(ctx, input.managerId);
      if (input.departmentId) {
        const [department] = await ctx.tx
          .select()
          .from(hrDepartment)
          .where(
            and(
              eq(hrDepartment.workspaceId, ctx.workspaceId),
              eq(hrDepartment.id, input.departmentId),
              eq(hrDepartment.archived, false),
            ),
          );
        if (!department) missing();
      }
      const employees = await ctx.tx
        .select()
        .from(hrEmployee)
        .where(eq(hrEmployee.workspaceId, ctx.workspaceId));
      const seen = new Set([id]);
      let manager = input.managerId;
      while (manager) {
        if (seen.has(manager))
          throw new AppError(
            409,
            "REPORTING_CYCLE",
            "A reporting relationship cannot contain a cycle.",
          );
        seen.add(manager);
        manager = employees.find((e) => e.userId === manager)?.managerId ?? null;
      }
      if (
        input.employeeCode &&
        employees.some((e) => e.userId !== id && e.employeeCode === input.employeeCode)
      )
        throw new AppError(409, "DUPLICATE_CODE", "Employee code is already in use.");
      await ctx.tx
        .insert(hrEmployee)
        .values({ workspaceId: ctx.workspaceId, userId: id, ...input })
        .onConflictDoUpdate({
          target: [hrEmployee.workspaceId, hrEmployee.userId],
          set: { ...input, updatedAt: new Date() },
        });
      await auditHr(ctx, "people.updated", id, {
        before: employees.find((e) => e.userId === id) ?? null,
        after: input,
      });
    });
    return c.json({ ok: true });
  });
  app.get("/departments", async (c) =>
    c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => ({
        departments: await ctx.tx
          .select({
            id: hrDepartment.id,
            name: hrDepartment.name,
            managerId: hrDepartment.managerId,
            archived: hrDepartment.archived,
            employeeCount: sql<number>`count(${hrEmployee.userId})::int`,
          })
          .from(hrDepartment)
          .leftJoin(
            hrEmployee,
            and(
              eq(hrEmployee.workspaceId, hrDepartment.workspaceId),
              eq(hrEmployee.departmentId, hrDepartment.id),
            ),
          )
          .where(eq(hrDepartment.workspaceId, ctx.workspaceId))
          .groupBy(hrDepartment.id)
          .orderBy(asc(hrDepartment.name)),
      })),
    ),
  );
  app.post("/departments", async (c) => {
    const input = parse(departmentInputSchema, await c.req.json());
    return c.json(
      await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
        await ctx.require("hr.departments.manage");
        if (input.managerId) await requireHrMember(ctx, input.managerId);
        const exists = await ctx.tx
          .select()
          .from(hrDepartment)
          .where(
            and(eq(hrDepartment.workspaceId, ctx.workspaceId), eq(hrDepartment.name, input.name)),
          );
        if (exists.length)
          throw new AppError(409, "DUPLICATE_DEPARTMENT", "Department name already exists.");
        const [row] = await ctx.tx
          .insert(hrDepartment)
          .values({ workspaceId: ctx.workspaceId, ...input })
          .returning();
        await auditHr(ctx, "department.created", row!.id, { after: input });
        return { id: row!.id };
      }),
      201,
    );
  });
  app.put("/departments/:id", async (c) => {
    const id = parse(idSchema, c.req.param("id")),
      input = parse(departmentInputSchema, await c.req.json());
    await core.run(c.get("workspaceId"), c.get("user").id, async (ctx) => {
      await ctx.require("hr.departments.manage");
      if (input.managerId) await requireHrMember(ctx, input.managerId);
      const rows = await ctx.tx
        .select()
        .from(hrDepartment)
        .where(eq(hrDepartment.workspaceId, ctx.workspaceId));
      const before = rows.find((d) => d.id === id);
      if (!before) missing();
      if (rows.some((d) => d.id !== id && d.name === input.name))
        throw new AppError(409, "DUPLICATE_DEPARTMENT", "Department name already exists.");
      await ctx.tx
        .update(hrDepartment)
        .set(input)
        .where(and(eq(hrDepartment.workspaceId, ctx.workspaceId), eq(hrDepartment.id, id)));
      await auditHr(ctx, "department.updated", id, { before, after: input });
    });
    return c.json({ ok: true });
  });
  return app;
}
