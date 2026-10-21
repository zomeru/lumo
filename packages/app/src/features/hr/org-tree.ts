import type { Person } from "@lumo/contracts/hr";

/** Build a forest in linear time, detaching missing managers and one edge per cycle. */
export function buildOrgTree(people: Person[]) {
  const byId = new Map(people.map((person) => [person.userId, person]));
  const parent = new Map<string, string | null>();
  for (const person of byId.values())
    parent.set(
      person.userId,
      person.managerId && byId.has(person.managerId) ? person.managerId : null,
    );
  const done = new Set<string>();
  const invalid = new Set<string>();
  for (const id of byId.keys()) {
    const path = new Set<string>();
    let current: string | null = id;
    while (current && !done.has(current)) {
      if (path.has(current)) {
        parent.set(current, null);
        invalid.add(current);
        break;
      }
      path.add(current);
      current = parent.get(current) ?? null;
    }
    for (const visited of path) done.add(visited);
  }
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const id of byId.keys()) {
    const manager = parent.get(id);
    if (!manager) roots.push(id);
    else {
      const reports = children.get(manager) ?? [];
      reports.push(id);
      children.set(manager, reports);
    }
  }
  return { byId, parent, children, roots, invalid };
}
export function layoutOrgTree(
  tree: ReturnType<typeof buildOrgTree>,
  expanded: Set<string>,
  collapsed: Set<string>,
) {
  const nodes: { id: string; depth: number; x: number; y: number; open: boolean }[] = [];
  const widths = new Map<string, number>();
  const stack = tree.roots.toReversed().map((id) => ({ id, depth: 0 }));
  while (stack.length) {
    const item = stack.pop()!;
    const open = !collapsed.has(item.id) && (item.depth < 2 || expanded.has(item.id));
    nodes.push({ ...item, open, x: 0, y: item.depth * 156 + 24 });
    if (open)
      for (const id of (tree.children.get(item.id) ?? []).toReversed())
        stack.push({ id, depth: item.depth + 1 });
  }
  for (const node of nodes.toReversed())
    widths.set(
      node.id,
      Math.max(
        248,
        node.open
          ? (tree.children.get(node.id) ?? []).reduce((sum, id) => sum + (widths.get(id) ?? 0), 0)
          : 0,
      ),
    );
  const lefts = new Map<string, number>();
  let left = 12;
  for (const root of tree.roots) {
    lefts.set(root, left);
    left += widths.get(root) ?? 248;
  }
  let height = 180;
  for (const node of nodes) {
    const start = lefts.get(node.id) ?? 12;
    node.x = start + ((widths.get(node.id) ?? 248) - 224) / 2;
    height = Math.max(height, node.y + 132);
    let childLeft = start;
    if (node.open)
      for (const id of tree.children.get(node.id) ?? []) {
        lefts.set(id, childLeft);
        childLeft += widths.get(id) ?? 248;
      }
  }
  return { nodes, width: left + 12, height };
}
