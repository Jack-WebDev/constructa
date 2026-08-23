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

Use `parseDocument` to validate and obtain a `GeneratorDocumentV1`, or `safeParseDocument` for a non-throwing parse result. Use `isGeneratorDefinition` or `assertGeneratorDefinition` when validating an unwrapped definition.

## Validation issues

Validation APIs expose stable issues with a `code`, human-readable `message`, segment-based `path`, and optional JSON-safe `details`. A path is a `readonly (string | number)[]`: a property named `profile.age` remains the single segment `"profile.age"`, while an array item uses a numeric segment such as `0`.

Use `validateDocument` to receive every independent document issue in deterministic order, or `validateGeneratorDefinition` for a definition and its nested typed definitions. `parseDocument` and `safeParseDocument` use the first issue when a single parse result is required. Path rendering is intentionally left to the consuming interface.

## Structured errors

`ConstructaError` is the shared safe error model. Every error has a `kind` (`configuration`, `dependency`, `execution`, or `system`), an uppercase stable `code`, segment `path`, human-readable `message`, and optional JSON-safe `details`. Reserved codes include `INVALID_RANGE`, `EMPTY_CHOICE`, `INVALID_LENGTH`, `UNKNOWN_GENERATOR`, `REFERENCE_NOT_FOUND`, `CIRCULAR_REFERENCE`, `EXECUTION_FAILED`, and `UNSUPPORTED_SCHEMA_VERSION`.

Use `createConstructaError` for a known failure or `normalizeConstructaError` to wrap an unknown cause. Calling `toJSON()` returns only the safe error data; original causes are never serialized. Schema validation exceptions are categorized as configuration errors.

## Semantic generator metadata

`GeneratorMetadata` describes a generator without influencing execution. All fields are optional so third-party generators can provide only what they know: `typeId`, `displayName`, `description`, `category`, `outputCategory`, `documentationUrl`, and JSON-only `examples`.

Metadata IDs use lowercase stable identifiers (for example, `integer`, `numeric`, or `date-time`). `outputCategory` is a coarse preview hint only; it does not replace runtime validation or future TypeScript output inference. Presentation details—including React components, icons, CSS classes, controls, routes, and layout—are deliberately not part of this contract.

Use `isGeneratorMetadata`, `assertGeneratorMetadata`, or `validateGeneratorMetadata` to validate metadata.

## Dependency boundary

This is the bottom of the domain dependency graph and has no Constructa runtime dependencies.
