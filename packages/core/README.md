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

`GeneratorDefinition<Output>` carries output information only at compile time; emitted definitions remain plain JSON data. Factories should use `createGeneratorDefinition()` so literal fields are preserved and the resulting definition is portable. Implementations receive a frozen `GenerationContext` capability view: validated random draws, the current definition path, and typed `executeChild(definition, pathSegment)`. Child dispatch deliberately reports `CHILD_EXECUTION_UNAVAILABLE` until Phase 017 wires recursive execution; implementations must not use global randomness or built-in-specific execution switches.

## Runtime parsing

Use `parseDefinition(value, { registry, limits? })` for untrusted runtime definition data, or `parseDocument(value, { registry, limits? })` for a versioned document. Both validate portable JSON, registered generator IDs, each implementation's configuration, and nested typed definitions without invoking `generate`. `safeParseDefinition()` and `safeParseDocument()` return all bounded, deterministic structured issues; the throwing forms return the first issue. Definitions parsed from dynamic data intentionally have broad `GeneratorDefinition` output typing.

## Random sources

`RandomSource` exposes `float()` in `[0, 1)`, `integer(maxExclusive)` in `[0, maxExclusive)`, and `bytes(length)` with exactly the requested number of bytes. Use `createRandomSource()` to validate injected adapters or `createDefaultRandomSource()` for the platform-backed source. Invalid source output is a system error; Constructa never substitutes biased fallback randomness. The default source uses platform cryptographic bytes, but this package makes no claim that generated values are suitable for a security-sensitive use case.

`createSeededRandom(seed)` provides an isolated deterministic source using `mulberry32` algorithm version 1. String seeds are canonical UTF-8 strings; finite numeric seeds use their JavaScript representation, with `-0` normalized to `0`. `getSeededRandomMetadata()` exposes only the algorithm and version for diagnostics—never the seed. Reproducibility later depends on the complete compatibility tuple: engine version, generator implementation version, random algorithm/version, definition, seed, and execution mode. Changing a generator's draw count is therefore a deliberate determinism compatibility change.

## Registry

`createRegistry()` is advanced infrastructure. Register trusted implementations explicitly with `register()`. Duplicate type IDs fail without changing registry state; `replace()` is the deliberate replacement path and requires the type to already be registered. `lookup(type, path?)` resolves a registered implementation without a central built-in switch. Unknown IDs throw a dependency `UNKNOWN_GENERATOR` error at the supplied definition path plus `type`, with safe registered-type diagnostics. `snapshot()` returns an immutable, type-sorted registry view with the same lookup behavior; later registry changes do not affect it. Dispatch remains a separate concern.

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
