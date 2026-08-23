# `constructa-schema`

Portable generator definitions, versioned generator documents, validation schemas, and related types shared by every Constructa interface.

## Portable data constraint

Documents and definitions are JSON-only data. Supported values are strings, booleans, `null`, finite numbers other than negative zero, arrays, and plain object records whose properties are all JSON values. Functions, symbols, bigints, `NaN`, infinities, cyclic objects, sparse arrays, custom `toJSON` behavior, class instances, maps, sets, dates, accessors, symbol keys, and non-enumerable properties are rejected.

## Definitions and documents

A `GeneratorDefinition` is executable generator data. It has a stable, non-empty `type` discriminator, with generator-specific fields at the same level:

```json
{ "type": "integer", "min": 1, "max": 100 }
```

A `GeneratorDocumentV1` wraps exactly one root definition and carries versioning and optional display metadata:

```json
{
  "schemaVersion": 1,
  "name": "Small integer",
  "description": "An integer in a bounded range.",
  "definition": { "type": "integer", "min": 1, "max": 100 }
}
```

`name` and `description` are optional strings; empty strings are preserved rather than normalized. Unknown document keys are rejected. Document metadata, ownership, visibility, and timestamps do not belong in generator definitions. The former `{ type, configuration }` envelope is rejected; move its generator fields directly into `definition`.

Use `parseDocument` to validate and obtain a `GeneratorDocumentV1`, or `safeParseDocument` and `findDocumentFailure` for structured failures. Use `isGeneratorDefinition` or `assertGeneratorDefinition` when validating an unwrapped definition.

## Dependency boundary

This is the bottom of the domain dependency graph and has no Constructa runtime dependencies.
