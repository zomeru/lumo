import { fileURLToPath, URL } from "node:url";

import { tanstackRouter, tanstackRouterGenerator } from "@tanstack/router-plugin/vite";
import type { Plugin } from "vite";

export function appDependencies(): Plugin {
  return {
    name: "lumolynk:browser-dependencies",
    config: () => ({
      build: {
        rolldownOptions: {
          output: {
            // Agora's ESM packages have initialization cycles across chunk boundaries.
            strictExecutionOrder: true,
            codeSplitting: {
              includeDependenciesRecursively: false,
              groups: [
                {
                  name: "agora-rtc",
                  test: /[\\/]node_modules[\\/](?:@agora-js[\\/]|agora-rtc-sdk-ng[\\/])/,
                  maxSize: 400_000,
                },
                {
                  name: "syntax-highlight",
                  test: /[\\/]node_modules[\\/]highlight\.js[\\/]/,
                  maxSize: 400_000,
                },
              ],
            },
          },
        },
      },
    }),
  };
}

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
