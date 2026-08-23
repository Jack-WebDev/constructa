# `constructa-core`

UI-agnostic generator registration and execution engine for Constructa.

This package contains the core runtime responsible for registering, composing, and executing generators. It defines the fundamental behavior of the Constructa generation system without making assumptions about user interfaces, persistence, transport, or application environments.

## Responsibilities

Current APIs define trusted generator implementations, portable typed definitions, and engine-provided generation context services. Planned areas include:

* Generator registry
* Generator execution
* Generation context
* Seeded randomness
* Generator composition and lifecycle
* Structured errors

## Generator implementation contract

Use `defineGenerator()` for developer-authored executable implementations. An implementation declares a stable lowercase `type`, positive integer `version`, definition validator, optional dependency analysis hook, and `generate({ definition, context })` function. Validation returns schema `ValidationIssue` objects without imposing a validation-library dependency.

`GeneratorDefinition<Output>` carries output information only at compile time; emitted definitions remain plain JSON data. Factories should use `createGeneratorDefinition()` so literal fields are preserved and the resulting definition is portable. Implementations receive randomness and child generation through `GenerationContext`; they must not use global randomness or built-in-specific execution switches.

## Registry

`createRegistry()` is advanced infrastructure. Register trusted implementations explicitly with `register()`. Duplicate type IDs fail without changing registry state; `replace()` is the deliberate replacement path and requires the type to already be registered. `snapshot()` returns an immutable, type-sorted record of registered generator IDs and versions for execution infrastructure. Lookup and dispatch are separate later concerns.

## Dependency Boundary

`constructa-schema` is the only Constructa runtime dependency that `constructa-core` may depend on.

Core must not import or depend directly on:

* Built-in generators
* Exporters
* SDK
* Applications
* UI components
* Environment configuration
* Persistence or storage
* Transport or API code

This boundary keeps the generator engine portable and independent of higher-level Constructa packages and applications.
