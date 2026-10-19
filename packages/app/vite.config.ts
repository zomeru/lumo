import { fileURLToPath, URL } from "node:url";

import { tanstackRouter, tanstackRouterGenerator } from "@tanstack/router-plugin/vite";
export function appRoutes(test = false) {
  const options = {
    target: "react" as const,
    routesDirectory: fileURLToPath(new URL("./src/routes", import.meta.url)),
    generatedRouteTree: fileURLToPath(new URL("./src/routeTree.gen.ts", import.meta.url)),
  };
  return test
    ? tanstackRouterGenerator(options)
    : tanstackRouter({ ...options, autoCodeSplitting: true });
}
