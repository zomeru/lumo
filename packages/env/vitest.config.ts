import { defineProject } from "vitest/config";
export default defineProject({ test: { name: "env", include: ["src/**/*.test.ts"] } });
