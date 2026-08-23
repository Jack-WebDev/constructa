# constructa-schema

## 2.4.1

### Patch Changes

- 8cfd768: Improve JSR package documentation with runnable usage examples and complete
  public API documentation. The SDK now provides the supported facade for the
  core execution APIs and built-in generator factories.

## 2.4.0

### Minor Changes

- b7cddb6: Add version-dispatched document parsing and explicit document migrations.

## 2.3.0

### Minor Changes

- 73d3c41: Add canonical definition and document serialization with reusable fixtures.

## 2.2.0

### Minor Changes

- 658fc73: Add typed generator implementation, portable definition factory, generation context, and output inference contracts.

## 2.1.0

### Minor Changes

- a42d8e9: Add the shared structured error taxonomy with safe serialization, normalized causes, and configuration-error integration for schema validation.

## 2.0.0

### Major Changes

- 4a99afc: Replace string-path validation failures with segment-based validation issues and aggregate document and nested definition validation APIs.

### Minor Changes

- 4a99afc: Add portable semantic generator metadata, including stable IDs, descriptions, categories, output hints, documentation links, and JSON-only examples.

## 1.0.0

### Major Changes

- f2ef358: Replace the `{ type, configuration }` envelope with versioned generator documents containing flat generator definitions. Use `parseDocument` and the new document validation APIs; the retired envelope APIs are no longer exported.

## 0.0.4

### Patch Changes

- 95b57ca: Add the portable definition envelope type, validation helpers, fixtures, and documented unknown top-level property policy.

## 0.0.3

### Patch Changes

- 663d393: Add the initial schema version marker contract and structured validation failures.

## 0.0.2

### Patch Changes

- ae0cf8e: Add the initial schema version marker contract and structured validation failures.

## 0.0.1

### Patch Changes

- Make the initial Constructa library packages publishable on npm and JSR.
