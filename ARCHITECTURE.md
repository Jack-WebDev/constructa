# Architecture

Constructa is organized around one constraint: a generator definition should behave the same way in every delivery surface.

## Dependency direction

```text
apps/web     apps/api     apps/cli
       \        |        /
        \       |       /
          packages/sdk
          /     |      \
         /      |       \
packages/core   |   packages/exporters
       |        |
       |   packages/generators
       |        |
       +--------+
            |
     packages/schema
```

Dependencies flow toward the bottom of the diagram. Lower-level packages must never import an application or a higher-level package.

## Package boundaries

### `constructa-schema`

Owns the portable, serializable generator-definition format and its validation types. It must not depend on the execution engine, a user interface, persistence, or network code.

### `constructa-core`

Owns generator registration, execution, context, composition primitives, and structured errors. It may depend on the schema but must remain independent of all applications.

### `constructa-generators`

Owns the built-in primitive and composite generator implementations. New types should register with the core instead of adding type-specific branches to the executor.

### `constructa-exporters`

Owns conversion of generated values into formats such as JSON, JSON Lines, CSV, and SQL. Generation and presentation concerns should not leak into this package.

### `constructa-sdk`

Provides the stable, developer-facing API. It composes the lower-level packages and is the preferred entry point for application and third-party consumers.

## Application boundaries

- `apps/web` owns the browser experience, playground, visual builder, and future account workflows.
- `apps/api` will expose remote generation and saved-generator operations. Its framework and persistence technology are intentionally undecided.
- `apps/cli` owns terminal input/output and delegates generation behavior to the SDK.

## Cross-cutting packages

- `packages/ui` contains reusable presentation components, not product or generator behavior.
- `packages/env` validates application environment variables.
- `packages/config` contains shared development configuration.

Avoid creating a generic `shared` package. Code should stay with the domain that owns it until a stable, specific boundary emerges.

## Package maturity

Future-facing packages are private placeholders until they have an implemented public contract, tests, documentation, build output, and registry metadata. See [RELEASING.md](RELEASING.md) before making one publishable.

## Testing direction

- Unit tests live beside the source they exercise.
- Contract tests should prove that every registered generator validates and executes through the same interface.
- Integration tests should verify package boundaries and composition.
- End-to-end tests belong to the application whose user journey they cover.
- Reusable examples belong in `examples/` and should use public APIs rather than package internals.
