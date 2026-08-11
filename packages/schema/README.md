# `constructa-schema`

Portable generator definitions, validation schemas, and related types shared by every Constructa interface.

Planned areas include definition versioning, primitive and composite definitions, validation results, and safe serialization. This package must remain independent of execution, UI, network, and persistence concerns.

## Portable data constraint

Portable generator definitions are JSON-only data. Supported values are strings, booleans, `null`, finite numbers other than negative zero, arrays, and plain object records whose properties are all JSON values.

Omit optional data by leaving the property out. `undefined` is not a portable value, including in object properties or array items. Values that JSON would coerce, execute, or silently omit are rejected, including functions, symbols, bigints, `NaN`, infinities, cyclic objects, sparse arrays, custom `toJSON` behavior, class instances, maps, sets, dates, accessors, symbol keys, and non-enumerable properties.

Use `isJsonValue`, `assertJsonValue`, or `findJsonValueError` to enforce this constraint before later schema-specific validation.

## Dependency boundary

This is the bottom of the domain dependency graph and has no Constructa runtime dependencies. In particular, it must not import core, generators, exporters, the SDK, applications, UI, environment, persistence, or transport code.
