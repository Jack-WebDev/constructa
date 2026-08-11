# `constructa-core`

UI-agnostic generator registration and execution engine for Constructa.

This package contains the core runtime responsible for registering, composing, and executing generators. It defines the fundamental behavior of the Constructa generation system without making assumptions about user interfaces, persistence, transport, or application environments.

## Responsibilities

Planned areas include:

* Generator registry
* Generator execution
* Generation context
* Seeded randomness
* Generator composition and lifecycle
* Structured errors

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
