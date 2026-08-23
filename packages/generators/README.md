# `constructa-generators`

Built-in generator implementations for Constructa.

The first implementation set will include integer, boolean, choice, decimal, string, date, UUID, object, array, and template generators. Each generator should own its configuration validation, metadata, implementation, and tests while conforming to the common core contract.

## Integer

`integer({ min, max })` returns a portable definition whose output is inferred as `number`. Both safe-integer bounds are required and inclusive. `integerGenerator` uses the execution context's random source, and `registerIntegerGenerator(registry)` is available for advanced custom registries.

## Boolean

`boolean()` returns a portable definition whose output is inferred as `boolean`. It has no configuration and selects `false` and `true` with equal probability through the execution context's random source. `registerBooleanGenerator(registry)` is available for advanced custom registries.

## Choice

`choice(values)` accepts a non-empty array of portable JSON values and infers the union of its members, including array literals without `as const`. It selects a member through the execution context's unbiased integer source. `registerChoiceGenerator(registry)` is available for advanced custom registries.

## Decimal

`decimal({ min, max, precision })` returns a JavaScript `number` rounded with `Number#toFixed`; it is not arbitrary-precision decimal arithmetic. Bounds must be finite and inclusive. Precision is required and ranges from 0 through 15. `registerDecimalGenerator(registry)` is available for advanced custom registries.

## String

`string({ length, charset? })` returns a random character string. Length is required and ranges from 0 through 10,000. The explicit default charset is `alphanumeric`; `alphabetic`, `numeric`, `alphanumeric`, and `hex` are predefined, while any other non-empty string is used as a custom charset. `registerStringGenerator(registry)` is available for advanced custom registries.

## Date

`date({ min, max })` returns an inclusive `YYYY-MM-DD` ISO calendar-date string. Dates are validated canonically and generated with UTC calendar arithmetic, so results do not depend on the local timezone. `registerDateGenerator(registry)` is available for advanced custom registries.

## UUID

`uuid()` returns a canonical UUID v4 string. It obtains exactly 16 bytes from the execution context, sets the RFC 4122 version and variant bits, and is deterministic when the executor is seeded. `registerUuidGenerator(registry)` is available for advanced custom registries.

## Object

`object(fields)` composes named child definitions and infers a mapped object output from them. Each child is delegated through the execution engine using its field name as the path segment, so nested errors retain their full field path. `registerObjectGenerator(registry)` is available for advanced custom registries.

## Array

`array(item, { length })` creates one fixed-length array value and infers `Infer<typeof item>[]`. Length must be a non-negative safe integer no greater than 10,000. Array items are delegated through the execution engine using numeric index path segments; this is distinct from repeated root execution. `registerArrayGenerator(registry)` is available for advanced custom registries.

## Template

`template(source)` returns a string definition that interpolates object-local `{field}` and `{sibling.nested}` values. `{{` and `}}` emit literal braces. Only strings, finite numbers, booleans, and `null` can be interpolated; objects and arrays fail with `NON_SCALAR_REFERENCE`. Templates do not support expressions, transforms, or functions. `registerTemplateGenerator(registry)` is available for advanced custom registries.

## Dependency boundary

This package may import `constructa-core` for the generator contract and registration APIs, and `constructa-schema` for portable definitions. It must not import exporters, the SDK, applications, UI, environment, persistence, or transport code.
