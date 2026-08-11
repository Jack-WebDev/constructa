# `@constructa/schema`

Portable generator definitions, validation schemas, and related types shared by every Constructa interface.

Planned areas include definition versioning, primitive and composite definitions, validation results, and safe serialization. This package must remain independent of execution, UI, network, and persistence concerns.

## Dependency boundary

This is the bottom of the domain dependency graph and has no Constructa runtime dependencies. In particular, it must not import core, generators, exporters, the SDK, applications, UI, environment, persistence, or transport code.
