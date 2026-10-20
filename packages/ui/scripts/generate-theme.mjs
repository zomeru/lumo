import { mkdir, readFile, writeFile } from "node:fs/promises";

import { themes, tokens } from "../src/tokens.ts";
import { onlyofficeTheme } from "./onlyoffice-themes.mjs";

const variables = (values) =>
  Object.entries(values)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n");
const colors = Object.keys(themes.light)
  .map((key) => `  --color-${key}: var(--${key});`)
  .join("\n");
const css = `/* Generated from tokens.ts. Run theme:generate to update. */
:root, [data-theme="light"] {
  color-scheme: light;
${variables(themes.light)}
}
[data-theme="dark"] {
  color-scheme: dark;
${variables(themes.dark)}
}
@theme inline {
${colors}
}
@theme {
  --font-sans: ${tokens.fontFamily};
  --spacing: ${tokens.spacing}px;
  --spacing-control: ${tokens.control}px;
${Object.entries(tokens.radius)
  .map(([key, value]) => `  --radius-${key}: ${value}px;`)
  .join("\n")}
  --default-transition-duration: ${tokens.duration.fast}ms;
  --animate-enter: enter ${tokens.duration.normal}ms ease-out;
  @keyframes enter {
    from { opacity: 0; transform: translateY(-3px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
`;
const path = new URL("../src/theme.css", import.meta.url);
if (process.argv.includes("--check")) {
  const current = await readFile(path, "utf8");
  if (current.replace(/\s/g, "") !== css.replace(/\s/g, "")) {
    throw new Error("Theme is out of date. Run pnpm --filter @lumo/ui theme:generate.");
  }
} else {
  await writeFile(path, css);
}

const officeDirectory = new URL("../onlyoffice/", import.meta.url);
if (!process.argv.includes("--check")) await mkdir(officeDirectory, { recursive: true });
for (const [mode, palette] of Object.entries(themes)) {
  const officePath = new URL(`theme-lumo-${mode}.json`, officeDirectory);
  const theme = onlyofficeTheme(mode, palette);
  if (process.argv.includes("--check")) {
    const current = JSON.parse(await readFile(officePath, "utf8"));
    if (JSON.stringify(current) !== JSON.stringify(theme)) {
      throw new Error("Office theme is out of date. Run pnpm --filter @lumo/ui theme:generate.");
    }
  } else {
    await writeFile(officePath, JSON.stringify(theme, null, 2) + "\n");
  }
}
