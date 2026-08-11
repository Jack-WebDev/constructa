# `constructa-schema`

Portable generator definitions, validation schemas, and related types shared by every Constructa interface.

Planned areas include definition versioning, primitive and composite definitions, validation results, and safe serialization. This package must remain independent of execution, UI, network, and persistence concerns.

## Portable data constraint

Portable generator definitions are JSON-only data. Supported values are strings, booleans, `null`, finite numbers other than negative zero, arrays, and plain object records whose properties are all JSON values.

Omit optional data by leaving the property out. `undefined` is not a portable value, including in object properties or array items. Values that JSON would coerce, execute, or silently omit are rejected, including functions, symbols, bigints, `NaN`, infinities, cyclic objects, sparse arrays, custom `toJSON` behavior, class instances, maps, sets, dates, accessors, symbol keys, and non-enumerable properties.

Use `isJsonValue`, `assertJsonValue`, or `findJsonValueError` to enforce this constraint before later schema-specific validation.

## Schema version

Complete portable definitions must include `schemaVersion: 1`. `CURRENT_SCHEMA_VERSION` identifies the version emitted by current Constructa tooling, and `SUPPORTED_SCHEMA_VERSIONS` lists the versions accepted by this package.

Use `isSchemaVersion`, `assertSchemaVersion`, `isVersionedDefinition`, `assertVersionedDefinition`, `findSchemaVersionValueFailure`, or `findSchemaVersionFailure` to reject missing or unsupported version markers with structured failures.

## Definition envelope

The canonical top-level generator definition document is:

```json
{
  "schemaVersion": 1,
  "type": "integer",
  "configuration": {
    "min": 1,
    "max": 100
  },
  "name": "Small integer",
  "description": "An integer in a bounded range."
}
```

`schemaVersion`, `type`, and `configuration` are required. `type` must be a non-empty string, and `configuration` must be a JSON object. `name` and `description` are optional strings.

Unknown top-level properties are rejected so all surfaces exchange one canonical document shape. Generator-specific data belongs inside `configuration`, where each generator can validate its own fields in later phases.

Use `isDefinitionEnvelope`, `assertDefinitionEnvelope`, `parseDefinitionEnvelope`, `safeParseDefinitionEnvelope`, or `findDefinitionEnvelopeFailure` to validate the complete envelope.

## Dependency boundary

This is the bottom of the domain dependency graph and has no Constructa runtime dependencies. In particular, it must not import core, generators, exporters, the SDK, applications, UI, environment, persistence, or transport code.
