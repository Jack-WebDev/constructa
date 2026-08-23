# `constructa-generators`

Built-in generator implementations for Constructa.

The first implementation set will include integer, boolean, choice, decimal, string, date, UUID, object, array, and template generators. Each generator should own its configuration validation, metadata, implementation, and tests while conforming to the common core contract.

## Integer

`integer({ min, max })` returns a portable definition whose output is inferred as `number`. Both safe-integer bounds are required and inclusive. `integerGenerator` uses the execution context's random source, and `registerIntegerGenerator(registry)` is available for advanced custom registries.

## Boolean

`boolean()` returns a portable definition whose output is inferred as `boolean`. It has no configuration and selects `false` and `true` with equal probability through the execution context's random source. `registerBooleanGenerator(registry)` is available for advanced custom registries.

## Dependency boundary

This package may import `constructa-core` for the generator contract and registration APIs, and `constructa-schema` for portable definitions. It must not import exporters, the SDK, applications, UI, environment, persistence, or transport code.
