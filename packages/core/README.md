# `@constructa/core`

UI-agnostic generator registration and execution engine.

Planned areas include the registry, executor, generation context, seeded randomness, composition lifecycle, and structured errors. The engine may consume `@constructa/schema`, but it must not depend on applications, UI, storage, or transport code.

## Dependency boundary

`@constructa/schema` is this package's only allowed Constructa runtime dependency. Core must not import built-in generators, exporters, the SDK, applications, UI, environment, persistence, or transport code.
