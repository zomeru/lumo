import { randomBytes } from "node:crypto";
import { fileURLToPath, URL } from "node:url";

import { appDependencies, appRoutes } from "@lumolynk/app/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const nonce = randomBytes(24).toString("base64");
export default defineConfig({
  main: {
    define: { "import.meta.env.LUMOLYNK_CSP_NONCE": JSON.stringify(nonce) },
    build: { externalizeDeps: false },
  },
  preload: {
    build: {
      externalizeDeps: false,
      rollupOptions: { output: { format: "cjs", entryFileNames: "index.cjs" } },
    },
  },
  renderer: {
    base: "/",
    html: { cspNonce: nonce },
    root: fromRoot("./src/renderer"),
    server: { host: "127.0.0.1", port: 5174, strictPort: true },
    plugins: [appRoutes(), appDependencies(), react(), tailwindcss()],
    build: { rollupOptions: { input: fromRoot("./src/renderer/index.html") } },
  },
});
