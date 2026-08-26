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

`createEngine({ registry?, random?, limits? })` is available for advanced
customization. A supplied registry replaces the built-in registry and is
snapshotted when the engine is created; later registry mutations do not affect
the engine. Each engine instance is isolated.

## Dependency boundary

The SDK may import `constructa-schema`, `constructa-core`, `constructa-generators`, and `constructa-exporters`. It must remain independent of applications, UI, environment, persistence, and transport code so every delivery surface receives the same behavior.
