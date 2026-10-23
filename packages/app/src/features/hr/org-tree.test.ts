import type { Person } from "@lumolynk/contracts/hr";
import { expect, test } from "vitest";

import { buildOrgTree, layoutOrgTree } from "./org-tree";
const person = (userId: string, managerId: string | null = null) =>
  ({ userId, managerId, name: userId }) as Person;
test("builds multiple roots and detaches missing and circular managers", () => {
  const tree = buildOrgTree([
    person("lead"),
    person("report", "lead"),
    person("orphan", "missing"),
    person("a", "b"),
    person("b", "a"),
    person("self", "self"),
  ]);
  expect(tree.roots).toContain("lead");
  expect(tree.roots).toContain("orphan");
  expect(tree.invalid.size).toBe(2);
  const layout = layoutOrgTree(tree, new Set(), new Set());
  expect(new Set(layout.nodes.map((n) => n.id)).size).toBe(6);
  expect(layout.nodes.find((n) => n.id === "report")!.y).toBeGreaterThan(
    layout.nodes.find((n) => n.id === "lead")!.y,
  );
});
test("progressively renders deep hierarchies and collapses branches without losing data", () => {
  const tree = buildOrgTree(
    Array.from({ length: 5000 }, (_, i) => person(String(i), i ? String(i - 1) : null)),
  );
  expect(layoutOrgTree(tree, new Set(), new Set()).nodes).toHaveLength(3);
  expect(layoutOrgTree(tree, new Set(["2"]), new Set()).nodes).toHaveLength(4);
  expect(layoutOrgTree(tree, new Set(), new Set(["0"])).nodes).toHaveLength(1);
});
test("empty and duplicated data do not produce infinite or duplicate nodes", () => {
  expect(layoutOrgTree(buildOrgTree([]), new Set(), new Set()).nodes).toEqual([]);
  expect(
    layoutOrgTree(buildOrgTree([person("a"), person("a")]), new Set(), new Set()).nodes,
  ).toHaveLength(1);
});
