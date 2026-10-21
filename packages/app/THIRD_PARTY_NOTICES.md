# Agora Chat protocol codec

`src/features/messenger/chat-codec.generated.js` is generated from the protocol schema bundled in Agora Chat 1.4.0, published by Agora under the ISC license. It preserves that SDK's explicit scalar presence and packed repeated-field wire semantics. The SDK itself remains a pinned dependency.

The generated codec replaces runtime protobuf reflection compilation so Electron can enforce a script policy without `unsafe-eval`. Regenerate with `pnpm --filter @lumo/app chat:generate`; verify reproducibility with `pnpm --filter @lumo/app chat:check`. Review the schema, constructor integration and compatibility tests when upgrading the SDK. The generator fails on an unreviewed version.

The shared renderer Vite plugin also replaces the SDK's bundled `@protobufjs/inquire` helper with its browser fallback (`null`). This helper otherwise uses direct `eval` to look for optional Node modules such as `fs`, `buffer` and `long`; neither browser renderer exposes Node's `require`. This removes the build warning without adding indirect eval or relaxing CSP. The transform checks the exact 1.4.0 helper and fails when its implementation changes, so SDK upgrades require review. The Chat build test compiles the real dependency and exercises the result with runtime code generation disabled.

ISC License

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
