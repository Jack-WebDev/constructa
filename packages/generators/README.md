# `constructa-generators`

Built-in generator implementations for Constructa.

The first implementation set will include integer, boolean, choice, decimal, string, date, UUID, object, array, and template generators. Each generator should own its configuration validation, metadata, implementation, and tests while conforming to the common core contract.

## Dependency boundary

This package may import `@constructa/core` for the generator contract and registration APIs, and `@constructa/schema` for portable definitions. It must not import exporters, the SDK, applications, UI, environment, persistence, or transport code.
