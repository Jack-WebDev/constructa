# `constructa-exporters`

Output serialization and export formats for generated data.

## Example

The package is intentionally a public extension point while its first export
formats are being introduced. Install it now with JSR; future format APIs will
be imported from this stable module path.

```ts
import "jsr:@constructa/exporters";
```

Planned formats include JSON, JSON Lines, CSV, and SQL. Exporters consume plain generated values and formatting options; they do not execute generators or contain schema, UI, and download behavior.

## Dependency boundary

This package has no Constructa runtime dependencies. The SDK may call exporters, but exporters must not import higher-level packages, core, schema, built-in generators, applications, UI, environment, persistence, or transport code.
