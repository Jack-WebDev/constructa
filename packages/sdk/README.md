# `constructa-sdk`

Stable developer-facing API for configuring and running Constructa generators.

The SDK will assemble the core engine, built-in generators, and exporters behind a convenient public interface. Applications and external consumers should prefer this package over relying on internal implementation details.

## Example

Create an engine to generate typed values with all built-ins already
registered, without importing Constructa's internal packages directly.

```ts
import {
  createEngine,
  integer,
} from "jsr:@constructa/sdk";

const engine = createEngine();
const age = engine.generate(integer({ min: 18, max: 65 }), {
  seed: "example",
});
```

For ordinary one-off generation, use the package-level `generate()` function:

```ts
import { choice, generate } from "jsr:@constructa/sdk";

const role = generate(choice(["admin", "member"]), { seed: "example" });
// "admin" | "member"
```

`Infer<typeof definition>` captures a factory definition's generated value
type. It preserves `choice()` literals and recursively maps `object()` and
`array()` definitions. `safeParseDocument(value)` validates an untrusted,
versioned document against the SDK's built-in registry without executing it;
its failure result contains the shared structured errors and paths.
`parseDefinition`, `parseDocument`, `serializeDefinition`, and
`serializeDocument` are available as developer utilities; `createRegistry`,
`createExecutor`, `createEngine`, and `defineGenerator` remain advanced APIs.

`createEngine({ registry?, random?, limits? })` is available for advanced
customization. A supplied registry replaces the built-in registry and is
snapshotted when the engine is created; later registry mutations do not affect
the engine. Each engine instance is isolated.

## Dependency boundary

The SDK may import `constructa-schema`, `constructa-core`, `constructa-generators`, and `constructa-exporters`. It must remain independent of applications, UI, environment, persistence, and transport code so every delivery surface receives the same behavior.
