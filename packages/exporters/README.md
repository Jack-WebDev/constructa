# `constructa-exporters`

Output serialization and export formats for generated data.

Planned formats include JSON, JSON Lines, CSV, and SQL. Exporters consume plain generated values and formatting options; they do not execute generators or contain schema, UI, and download behavior.

## Dependency boundary

This package has no Constructa runtime dependencies. The SDK may call exporters, but exporters must not import higher-level packages, core, schema, built-in generators, applications, UI, environment, persistence, or transport code.
