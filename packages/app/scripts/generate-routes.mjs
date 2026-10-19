import { fileURLToPath } from "node:url";

import { Generator, getConfig } from "@tanstack/router-generator";

// Use the supported ESM entry point. The upstream CLI loads CommonJS, whose
// router-core import cycle reads an uninitialized HMR export on Node.js.
const root = fileURLToPath(new URL("..", import.meta.url));
await new Generator({ root, config: getConfig({}, root) }).run();
