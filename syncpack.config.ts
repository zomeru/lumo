import type { RcFile } from "syncpack";

export default {
  source: ["package.json", "apps/*/package.json", "packages/*/package.json"],
  semverGroups: [{ label: "Pin external dependencies", range: "", dependencies: ["**"] }],
  versionGroups: [
    {
      label: "Local workspace packages",
      dependencies: ["@lumo/**"],
      dependencyTypes: ["!local"],
      pinVersion: "workspace:*",
    },
  ],
} satisfies RcFile;
