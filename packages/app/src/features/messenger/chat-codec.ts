import { easemob } from "./chat-codec.generated.js";
/** SDK 1.4.0 exposes a protobuf Root on its constructor prototype. Use the exact
 * bundled schema's build-time codecs so strict CSP never needs unsafe-eval. */
const staticRoot = {
  lookup(name: string): unknown {
    let value: unknown = { easemob };
    for (const part of name.split(".")) {
      if (!value || (typeof value !== "object" && typeof value !== "function"))
        throw new Error("Unsupported Chat protocol type. Regenerate the static codec.");
      value = (value as Record<string, unknown>)[part];
    }
    if (!value) throw new Error("Unsupported Chat protocol type. Regenerate the static codec.");
    return value;
  },
};
export function installStaticChatCodec(constructor: { prototype: object }) {
  (constructor.prototype as { root: unknown }).root = staticRoot;
}
