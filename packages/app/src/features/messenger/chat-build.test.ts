import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

import type AgoraChat from "agora-chat";
import { build } from "vite";
import { expect, test } from "vitest";

import { appDependencies } from "../../../vite.config";
import { installStaticChatCodec } from "./chat-codec";

test("Chat's browser build initializes and creates messages under CSP without eval warnings", async () => {
  const warnings: string[] = [];
  const result = await build({
    configFile: false,
    logLevel: "silent",
    plugins: [appDependencies()],
    build: {
      write: false,
      minify: true,
      lib: {
        entry: createRequire(import.meta.url).resolve("agora-chat"),
        formats: ["cjs"],
      },
      rolldownOptions: {
        preserveEntrySignatures: "allow-extension",
        onwarn(warning) {
          if (warning.code) warnings.push(warning.code);
        },
      },
    },
  });
  const bundles = Array.isArray(result) ? result : [result];
  const chunks = bundles.flatMap((bundle) => {
    if (!("output" in bundle)) throw new Error("Expected a browser bundle.");
    return bundle.output.filter((entry) => entry.type === "chunk");
  });
  expect(chunks).toHaveLength(1);
  expect(warnings).not.toContain("EVAL");
  const context = {
    module: { exports: {} as typeof AgoraChat | { default: typeof AgoraChat } },
    self: window,
    window,
    document,
    navigator,
    location,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  runInNewContext(chunks[0]!.code, context, {
    timeout: 5000,
    contextCodeGeneration: { strings: false, wasm: false },
  });
  const imported = context.module.exports;
  const sdk = "connection" in imported ? imported : imported.default;
  if (!sdk) throw new Error("Expected the Chat SDK export.");
  sdk.logger.disableAll();
  installStaticChatCodec(sdk.connection);
  expect(
    sdk.message.create({ type: "txt", chatType: "groupChat", to: "group", msg: "hello" }),
  ).toMatchObject({ type: "txt", chatType: "groupChat", to: "group", msg: "hello" });
});
