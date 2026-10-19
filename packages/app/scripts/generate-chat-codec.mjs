import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
const require = createRequire(import.meta.url);
const sdk = require.resolve("agora-chat");
const { version } = JSON.parse(await readFile(join(dirname(sdk), "package.json"), "utf8"));
if (version !== "1.4.0")
  throw new Error(
    "Review the static Chat codec against the upgraded Agora SDK before regenerating.",
  );
const source = await readFile(sdk, "utf8");
const marker = "Root.fromJSON(";
const start = source.indexOf(marker) + marker.length;
if (start < marker.length) throw new Error("Agora protocol schema was not found.");
let depth = 0,
  quoted = false,
  escaped = false,
  end = start;
for (; end < source.length; end++) {
  const character = source[end];
  if (quoted) {
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === '"') quoted = false;
    continue;
  }
  if (character === '"') quoted = true;
  else if (character === "{") depth++;
  else if (character === "}" && --depth === 0) {
    end++;
    break;
  }
}
// Evaluate only the installed SDK's data literal in an isolated build-time VM.
// Runtime code generation is disabled in the renderer and remains unnecessary.
const schema = runInNewContext(`(${source.slice(start, end)})`, Object.create(null), {
  timeout: 1000,
  contextCodeGeneration: { strings: false, wasm: false },
});
// The vendor uses protobufjs 7 JSON semantics: explicit scalar presence and
// packed repeated scalars. Newer protobufjs defaults otherwise for JSON input.
function preserveWireSemantics(namespace) {
  if (namespace.fields) {
    namespace.edition = "proto2";
    for (const field of Object.values(namespace.fields)) {
      if (field.rule === "repeated") field.options = { packed: true, ...field.options };
    }
  }
  for (const child of Object.values(namespace.nested ?? {})) preserveWireSemantics(child);
}
preserveWireSemantics(schema);
const temporary = await mkdtemp(join(tmpdir(), "lumo-chat-codec-"));
const output = fileURLToPath(
  new URL("../src/features/messenger/chat-codec.generated.js", import.meta.url),
);
const declarations = output.replace(/\.js$/, ".d.ts");
const banner =
  "// Generated from agora-chat@1.4.0 (ISC) by scripts/generate-chat-codec.mjs. Do not edit.\n";
const pbjs = require("protobufjs-cli/pbjs");
const run = (args) =>
  new Promise((resolve, reject) =>
    pbjs.main(args, (error, value) => (error ? reject(error) : resolve(value))),
  );
const compiled = join(temporary, "codec.js");
try {
  const input = join(temporary, "schema.json");
  await writeFile(input, JSON.stringify(schema));
  await run([
    "-t",
    "static-module",
    "-w",
    "es6",
    "--no-service",
    "--dependency",
    "protobufjs/minimal.js",
    "-o",
    compiled,
    input,
  ]);
  const code = (await readFile(compiled, "utf8"))
    .replace("import * as $protobuf", "import $protobuf")
    .replace(/\/\*eslint-disable[\s\S]*?\*\//g, "")
    .replace(/\/\*\*[\s\S]*?\*\//g, "")
    .replace(/\n\s*\n/g, "\n\n");
  const declaration = banner + "export const easemob: Record<string, unknown>;\n";
  if (process.argv.includes("--check")) {
    if (
      (await readFile(output, "utf8")) !== banner + code ||
      (await readFile(declarations, "utf8")) !== declaration
    )
      throw new Error("Chat codec is stale. Run pnpm --filter @lumo/app chat:generate.");
  } else {
    await writeFile(output, banner + code);
    await writeFile(declarations, declaration);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
