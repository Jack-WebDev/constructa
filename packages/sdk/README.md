# `@constructa/sdk`

Stable developer-facing API for configuring and running Constructa generators.

The SDK will assemble the core engine, built-in generators, and exporters behind a convenient public interface. Applications and external consumers should prefer this package over relying on internal implementation details.

## Dependency boundary

The SDK may import `@constructa/schema`, `@constructa/core`, `@constructa/generators`, and `@constructa/exporters`. It must remain independent of applications, UI, environment, persistence, and transport code so every delivery surface receives the same behavior.
