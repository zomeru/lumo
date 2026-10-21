import { fileURLToPath, URL } from "node:url";

import { tanstackRouter, tanstackRouterGenerator } from "@tanstack/router-plugin/vite";
import type { Plugin } from "vite";

export function appDependencies(): Plugin {
  return {
    name: "lumo:browser-dependencies",
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
    transform: {
      filter: { id: /[\\/]agora-chat[\\/]Agora-chat\.js$/ },
      handler(code) {
        // Agora Chat 1.4.0 bundles protobufjs's optional Node module probe.
        // Browser renderers have no require; preserve its null fallback without eval.
        const inquire =
          'function inquire(moduleName){try{var mod=eval("quire".replace(/^/,"re"))(moduleName);if(mod&&(mod.length||Object.keys(mod).length))return mod}catch(e){}return null}';
        const parts = code.split(inquire);
        if (parts.length !== 2)
          this.error("Review the Agora Chat browser shim against the installed SDK.");
        return { code: parts.join("function inquire(){return null}"), map: null };
      },
    },
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
