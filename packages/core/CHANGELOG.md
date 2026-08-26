# constructa-core

## 0.9.6

### Patch Changes

- e8e933d: Verify published package artifacts in a clean npm consumer and use installable semver ranges for internal package dependencies.
- Updated dependencies [e8e933d]
  - constructa-schema@2.5.1

## 0.9.5

### Patch Changes

- 6e18ea8: Expose the versioned document type through the core façade and add
  `safeParseDocument()` to the SDK for validating documents against its built-in
  generator registry without executing them.

## 0.9.4

### Patch Changes

- Updated dependencies [dcda1d8]
  - constructa-schema@2.5.0

## 0.9.3

### Patch Changes

- ea235b3: Clarify package descriptions to better communicate each public package's role.
- Updated dependencies [ea235b3]
  - constructa-schema@2.4.3

## 0.9.2

### Patch Changes

- a2fc852: Improve JSR package documentation with runnable usage examples and complete
  public API documentation. The SDK now provides the supported facade for the
  core execution APIs and built-in generator factories.
- Updated dependencies [a2fc852]
  - constructa-schema@2.4.2

## 0.9.1

### Patch Changes

- 8cfd768: Improve JSR package documentation with runnable usage examples and complete
  public API documentation. The SDK now provides the supported facade for the
  core execution APIs and built-in generator factories.
- Updated dependencies [8cfd768]
  - constructa-schema@2.4.1

## 0.9.0

### Minor Changes

- f60a58b: Add bounded untrusted-definition parsing and cancellation/deadline execution controls.

## 0.8.2

### Patch Changes

- Updated dependencies [b7cddb6]
  - constructa-schema@2.4.0

## 0.8.1

### Patch Changes

- Updated dependencies [73d3c41]
  - constructa-schema@2.3.0

## 0.8.0

### Minor Changes

- befceab: Validate template reference graphs and report deterministic missing and circular dependencies.

## 0.7.1

### Patch Changes

- 28495a9: Add scalar object-local template interpolation with stable malformed-token validation.

## 0.7.0

### Minor Changes

- d0b3e3c: Add portable template token and reference path parsing.

## 0.6.0

### Minor Changes

- 77259cb: Add object-local value dependency scheduling and read-only reference resolution.

## 0.5.0

### Minor Changes

- 803c506: Add versioned seeded random sources and determinism compatibility metadata.

## 0.4.0

### Minor Changes

- 5ea9792: Add validated random sources with platform-backed floats, unbiased bounded integers, and byte generation.

## 0.3.0

### Minor Changes

- b650cdb: Add registry and immutable snapshot lookup with precise unknown-generator diagnostics.

## 0.2.0

### Minor Changes

- 68a9ee6: Add advanced generator registry registration, explicit replacement, and immutable execution snapshots.

## 0.1.0

### Minor Changes

- 658fc73: Add typed generator implementation, portable definition factory, generation context, and output inference contracts.

### Patch Changes

- Updated dependencies [658fc73]
  - constructa-schema@2.2.0

## 0.0.7

### Patch Changes

- Updated dependencies [a42d8e9]
  - constructa-schema@2.1.0

## 0.0.6

### Patch Changes

- Updated dependencies [4a99afc]
- Updated dependencies [4a99afc]
  - constructa-schema@2.0.0

## 0.0.5

### Patch Changes

- Updated dependencies [f2ef358]
  - constructa-schema@1.0.0

## 0.0.4

### Patch Changes

- Updated dependencies [95b57ca]
  - constructa-schema@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [663d393]
  - constructa-schema@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies [ae0cf8e]
  - constructa-schema@0.0.2

## 0.0.1

### Patch Changes

- Make the initial Constructa library packages publishable on npm and JSR.
- Updated dependencies
  - constructa-schema@0.0.1
