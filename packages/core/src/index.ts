import {
  assertGeneratorDefinition,
  ConstructaError,
  type GeneratorDefinition,
  normalizeConstructaError,
  parseDocument as parseSchemaDocument,
  type ValidationIssue,
  type ValidationPath,
  type ValidationPathSegment,
  validateDocument,
  validateGeneratorDefinition,
} from "constructa-schema";

export type {
  GeneratorDefinition,
  Infer,
  ValidationIssue,
  ValidationPath,
  ValidationPathSegment,
} from "constructa-schema";

/**
 * Random values are always half-open: `float()` returns [0, 1), while
 * `integer(maxExclusive)` returns an integer in [0, maxExclusive).
 */
export type RandomSource = {
  float(): number;
  integer(maxExclusive: number): number;
  bytes(length: number): Uint8Array;
};

export type RandomSourceAdapter = RandomSource;

const validatedRandomSources = new WeakSet<object>();

export type Seed = number | string;

export type ExecutionOptions = {
  /** Uses a fresh deterministic source for this root execution. */
  readonly seed?: Seed;
  /**
   * A caller-owned source consumed by this execution. The executor does not
   * reset, clone, or otherwise retain it after the call returns.
   */
  readonly random?: RandomSource;
  /** Maximum child-definition nesting below the root. Defaults to 64. */
  readonly maxDepth?: number;
};

export type Executor = {
  generate: <Definition extends GeneratorDefinition>(
    definition: Definition,
    options?: ExecutionOptions,
  ) => import("constructa-schema").Infer<Definition>;
};

export const SEEDED_RANDOM_ALGORITHM = "mulberry32";
export const SEEDED_RANDOM_ALGORITHM_VERSION = 1;

export type SeededRandomMetadata = {
  readonly algorithm: typeof SEEDED_RANDOM_ALGORITHM;
  readonly version: typeof SEEDED_RANDOM_ALGORITHM_VERSION;
};

export type DeterminismCompatibility = {
  readonly engineVersion: string;
  readonly generatorImplementationVersion: number;
  readonly random: SeededRandomMetadata;
  readonly definition: GeneratorDefinition;
  readonly seed: Seed;
  readonly executionMode: string;
};

const SEEDED_RANDOM_METADATA: SeededRandomMetadata = Object.freeze({
  algorithm: SEEDED_RANDOM_ALGORITHM,
  version: SEEDED_RANDOM_ALGORITHM_VERSION,
});

/**
 * Validates an injected source and guards every produced value. No fallback
 * randomness is used when an adapter violates its contract.
 */
export function createRandomSource(adapter: RandomSourceAdapter): RandomSource {
  assertRandomSourceAdapter(adapter);

  const source = Object.freeze({
    float() {
      const value = adapter.float();
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value >= 1
      ) {
        throw invalidRandomSource(
          "float() must return a finite number in [0, 1).",
        );
      }
      return value;
    },
    integer(maxExclusive: number) {
      assertRandomLength(maxExclusive, "maxExclusive");
      const value = adapter.integer(maxExclusive);
      if (!Number.isSafeInteger(value) || value < 0 || value >= maxExclusive) {
        throw invalidRandomSource(
          "integer(maxExclusive) must return a safe integer in [0, maxExclusive).",
        );
      }
      return value;
    },
    bytes(length: number) {
      assertByteLength(length);
      const value = adapter.bytes(length);
      if (!(value instanceof Uint8Array) || value.length !== length) {
        throw invalidRandomSource(
          "bytes(length) must return a Uint8Array with exactly length bytes.",
        );
      }
      return value;
    },
  });
  validatedRandomSources.add(source);
  return source;
}

/** Creates the default platform-backed random source. It makes no security claim. */
export function createDefaultRandomSource(): RandomSource {
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues === undefined) {
    throw new ConstructaError({
      kind: "system",
      code: "SYSTEM_RANDOM_UNAVAILABLE",
      path: [],
      message: "Platform cryptographic random values are unavailable.",
    });
  }

  const randomBytes = (length: number) => {
    const bytes = new Uint8Array(length);
    for (let offset = 0; offset < length; offset += 65_536) {
      crypto.getRandomValues(bytes.subarray(offset, offset + 65_536));
    }
    return bytes;
  };
  const uint32 = () => new DataView(randomBytes(4).buffer).getUint32(0);
  const uint53 = () => (uint32() & 0x1f_ffff) * 2 ** 32 + uint32();

  return createRandomSource({
    float() {
      return uint53() / 2 ** 53;
    },
    integer(maxExclusive: number) {
      const range = 2 ** 53;
      const upperLimit = range - (range % maxExclusive);
      let value = uint53();
      while (value >= upperLimit) value = uint53();
      return value % maxExclusive;
    },
    bytes: randomBytes,
  });
}

/**
 * Returns a canonical seed representation. Strings use UTF-8 exactly; finite
 * numbers use their JavaScript numeric representation, with -0 normalized to 0.
 */
export function normalizeSeed(seed: Seed): string {
  if (typeof seed === "string") return `string:${seed}`;
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return `number:${Object.is(seed, -0) ? "0" : String(seed)}`;
  }
  throw new ConstructaError({
    kind: "configuration",
    code: "INVALID_SEED",
    path: ["seed"],
    message: "seed must be a string or finite number.",
  });
}

/** Creates an isolated deterministic random source for the current algorithm version. */
export function createSeededRandom(seed: Seed): RandomSource {
  let state = hashSeed(normalizeSeed(seed));
  const uint32 = () => {
    state = (state + 0x6d2b_79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
  const uint53 = () => (uint32() & 0x1f_ffff) * 2 ** 32 + uint32();

  return createRandomSource({
    float() {
      return uint53() / 2 ** 53;
    },
    integer(maxExclusive: number) {
      const range = 2 ** 53;
      const upperLimit = range - (range % maxExclusive);
      let value = uint53();
      while (value >= upperLimit) value = uint53();
      return value % maxExclusive;
    },
    bytes(length: number) {
      const bytes = new Uint8Array(length);
      for (let index = 0; index < length; index += 1) {
        if (index % 4 === 0) {
          const value = uint32();
          bytes[index] = value & 0xff;
          if (index + 1 < length) bytes[index + 1] = (value >>> 8) & 0xff;
          if (index + 2 < length) bytes[index + 2] = (value >>> 16) & 0xff;
          if (index + 3 < length) bytes[index + 3] = value >>> 24;
        }
      }
      return bytes;
    },
  });
}

/** Metadata for reproducibility diagnostics. It intentionally contains no seed. */
export function getSeededRandomMetadata(): SeededRandomMetadata {
  return SEEDED_RANDOM_METADATA;
}

/** Services supplied by the engine. Implementations must not use global randomness. */
export type GenerationContext = {
  readonly random: RandomSource;
  /** The definition path currently being generated. */
  readonly path: ValidationPath;
  /** Delegates a typed child definition to the engine. */
  readonly executeChild: <Output>(
    definition: GeneratorDefinition<Output>,
    pathSegment: ValidationPathSegment,
  ) => Output;
};

export type GenerationContextOptions = {
  readonly random: RandomSource;
  readonly path?: ValidationPath;
  readonly executeChild?: GenerationContext["executeChild"];
};

/**
 * Creates the engine-owned capability view supplied to implementations.
 * Application code normally receives this through `generate`, rather than
 * constructing one directly.
 */
export function createGenerationContext(
  options: GenerationContextOptions,
): GenerationContext {
  if (typeof options !== "object" || options === null) {
    throw contextError(
      "INVALID_GENERATION_CONTEXT",
      [],
      "Context options must be an object.",
    );
  }
  assertContextPath(options.path ?? []);
  if (
    typeof options.executeChild !== "undefined" &&
    typeof options.executeChild !== "function"
  ) {
    throw contextError(
      "INVALID_GENERATION_CONTEXT",
      [],
      "executeChild must be a function when present.",
    );
  }

  // This validates the Phase 012 source contract without drawing from it.
  const random = validatedRandomSources.has(options.random)
    ? options.random
    : createRandomSource(options.random);
  const path = Object.freeze([...(options.path ?? [])]);
  const executeChild =
    options.executeChild ??
    ((definition, pathSegment) => {
      assertGeneratorDefinition(definition, [...path, pathSegment]);
      assertContextPathSegment(pathSegment);
      throw new ConstructaError({
        kind: "execution",
        code: "CHILD_EXECUTION_UNAVAILABLE",
        path: [...path, pathSegment],
        message: "Child execution is not available in this generation context.",
      });
    });

  return Object.freeze({ random, path, executeChild });
}

export type ParseLimits = {
  readonly maxDepth?: number;
  readonly maxIssues?: number;
  readonly maxNodes?: number;
};

export type ParseDefinitionOptions = {
  readonly registry: Pick<
    GeneratorRegistry | GeneratorRegistrySnapshot,
    "lookup"
  >;
  readonly limits?: ParseLimits;
};

export type ParseDocumentOptions = ParseDefinitionOptions;

export type DefinitionParseResult =
  | { readonly success: true; readonly value: ParsedGeneratorDefinition }
  | { readonly success: false; readonly issues: readonly ConstructaError[] };

export type DocumentParseResult =
  | {
      readonly success: true;
      readonly value: import("constructa-schema").GeneratorDocumentV1;
    }
  | { readonly success: false; readonly issues: readonly ConstructaError[] };

/** Parses untrusted runtime definition data without executing generator code. */
export function parseDefinition(
  value: unknown,
  options: ParseDefinitionOptions,
): ParsedGeneratorDefinition {
  return parseDefinitionAtPath(value, [], options.registry, options.limits);
}

function parseDefinitionAtPath(
  value: unknown,
  path: ValidationPath,
  registry: ParseDefinitionOptions["registry"],
  limits?: ParseLimits,
): ParsedGeneratorDefinition {
  const result = parseRuntimeDefinition(value, path, { registry, limits });
  if (result.success) return result.value;
  throw result.issues[0];
}

export function safeParseDefinition(
  value: unknown,
  options: ParseDefinitionOptions,
): DefinitionParseResult {
  return parseRuntimeDefinition(value, [], options);
}

/** Parses a versioned document and its root definition through the same pipeline. */
export function parseDocument(
  value: unknown,
  options: ParseDocumentOptions,
): import("constructa-schema").GeneratorDocumentV1 {
  const result = safeParseDocument(value, options);
  if (result.success) return result.value;
  throw result.issues[0];
}

export function safeParseDocument(
  value: unknown,
  options: ParseDocumentOptions,
): DocumentParseResult {
  const limits = resolveParseLimits(options);
  const documentIssues = validationIssuesToErrors(
    validateDocumentSafely(value),
    [],
    limits.maxIssues,
  );
  if (documentIssues.length > 0)
    return { success: false, issues: documentIssues };

  // Schema parsing is now safe because validation has rejected hostile shapes.
  const document = parseSchemaDocument(value);
  const definition = parseRuntimeDefinition(
    document.definition,
    ["definition"],
    options,
  );
  return definition.success
    ? { success: true, value: document }
    : { success: false, issues: definition.issues };
}

export type GeneratorDependency = {
  readonly typeId: string;
  readonly path: ValidationPath;
};

declare const parsedGeneratorDefinition: unique symbol;

/** A runtime-validated definition accepted by an executor without revalidation. */
export type ParsedGeneratorDefinition = GeneratorDefinition & {
  readonly [parsedGeneratorDefinition]: true;
};

const parsedDefinitions = new WeakSet<object>();

export type GeneratorImplementation<
  Definition extends GeneratorDefinition<Output>,
  Output,
> = {
  readonly type: string;
  readonly version: number;
  readonly validateDefinition: (
    definition: unknown,
  ) => readonly ValidationIssue[];
  readonly analyzeDependencies?: (
    definition: Definition,
  ) => readonly GeneratorDependency[];
  readonly generate: (input: {
    readonly definition: Definition;
    readonly context: GenerationContext;
  }) => Output;
};

export type RegisteredGenerator = {
  readonly type: string;
  readonly version: number;
};

export type GeneratorRegistrySnapshot = {
  readonly generators: readonly RegisteredGenerator[];
  readonly lookup: (
    type: string,
    path?: ValidationPath,
  ) => GeneratorImplementation<GeneratorDefinition, unknown>;
};

export type GeneratorRegistry = {
  register: <Definition extends GeneratorDefinition<Output>, Output>(
    implementation: GeneratorImplementation<Definition, Output>,
  ) => void;
  replace: <Definition extends GeneratorDefinition<Output>, Output>(
    implementation: GeneratorImplementation<Definition, Output>,
  ) => void;
  lookup: (
    type: string,
    path?: ValidationPath,
  ) => GeneratorImplementation<GeneratorDefinition, unknown>;
  snapshot: () => GeneratorRegistrySnapshot;
};

const RESERVED_GENERATOR_TYPE_IDS = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

/** Creates advanced registry infrastructure. Normal factories do not require it. */
export function createRegistry(): GeneratorRegistry {
  const implementations = new Map<
    string,
    GeneratorImplementation<GeneratorDefinition, unknown>
  >();

  return {
    register(implementation) {
      assertRegistryImplementation(implementation);
      if (implementations.has(implementation.type)) {
        throw registryError(
          "DUPLICATE_GENERATOR",
          ["type"],
          `A generator with type "${implementation.type}" is already registered.`,
        );
      }
      implementations.set(
        implementation.type,
        freezeImplementation(
          implementation,
        ) as unknown as GeneratorImplementation<GeneratorDefinition, unknown>,
      );
    },
    replace(implementation) {
      assertRegistryImplementation(implementation);
      if (!implementations.has(implementation.type)) {
        throw registryError(
          "UNKNOWN_GENERATOR",
          ["type"],
          `No generator with type "${implementation.type}" is registered.`,
        );
      }
      implementations.set(
        implementation.type,
        freezeImplementation(
          implementation,
        ) as unknown as GeneratorImplementation<GeneratorDefinition, unknown>,
      );
    },
    lookup(type, path = []) {
      return lookupImplementation(implementations, type, path);
    },
    snapshot() {
      return createRegistrySnapshot(implementations);
    },
  };
}

/**
 * Creates an advanced single-value executor over an immutable registry
 * snapshot. Normal applications will receive this behavior through the SDK.
 */
export function createExecutor(
  registry: GeneratorRegistry | GeneratorRegistrySnapshot,
): Executor {
  const snapshot = createExecutionSnapshot(registry);

  return Object.freeze({
    generate<Definition extends GeneratorDefinition>(
      definition: Definition,
      options?: ExecutionOptions,
    ): import("constructa-schema").Infer<Definition> {
      const execution = resolveExecutionOptions(options);
      const parsed = parsedDefinitions.has(definition)
        ? definition
        : parseDefinition(definition, { registry: snapshot });
      return executeParsedDefinition(parsed, [], 0, {
        snapshot,
        ...execution,
      }) as import("constructa-schema").Infer<Definition>;
    },
  });
}

type ExecutionState = {
  readonly snapshot: GeneratorRegistrySnapshot;
  readonly random: RandomSource;
  readonly maxDepth: number;
};

function executeParsedDefinition(
  definition: GeneratorDefinition,
  path: ValidationPath,
  depth: number,
  state: ExecutionState,
): unknown {
  const implementation = state.snapshot.lookup(definition.type, path);
  analyzeGeneratorDependencies(
    implementation,
    definition,
    state.snapshot,
    path,
  );
  const context = createGenerationContext({
    random: state.random,
    path,
    executeChild<Output>(
      child: GeneratorDefinition<Output>,
      pathSegment: ValidationPathSegment,
    ): Output {
      assertChildPathSegment(pathSegment, path);
      const childPath = [...path, pathSegment];
      if (depth >= state.maxDepth) {
        throw new ConstructaError({
          kind: "execution",
          code: "MAX_EXECUTION_DEPTH",
          path: childPath,
          message: "Child execution exceeds the configured maximum depth.",
        });
      }
      const parsed = parseDefinitionAtPath(child, childPath, state.snapshot);
      return executeParsedDefinition(
        parsed,
        childPath,
        depth + 1,
        state,
      ) as Output;
    },
  });
  return invokeValidatedGeneratorImplementation(
    implementation,
    definition,
    context,
    path,
  );
}

function createExecutionSnapshot(
  registry: GeneratorRegistry | GeneratorRegistrySnapshot,
): GeneratorRegistrySnapshot {
  if (typeof registry !== "object" || registry === null) {
    throw contextError(
      "INVALID_EXECUTOR_REGISTRY",
      ["registry"],
      "Executor requires a generator registry.",
    );
  }
  if (typeof (registry as GeneratorRegistry).snapshot === "function") {
    return (registry as GeneratorRegistry).snapshot();
  }
  if (typeof (registry as GeneratorRegistrySnapshot).lookup === "function") {
    return registry as GeneratorRegistrySnapshot;
  }
  throw contextError(
    "INVALID_EXECUTOR_REGISTRY",
    ["registry"],
    "Executor requires a generator registry.",
  );
}

function resolveExecutionOptions(
  options: ExecutionOptions | undefined,
): Omit<ExecutionState, "snapshot"> {
  if (options === undefined) {
    return { random: createDefaultRandomSource(), maxDepth: 64 };
  }
  if (typeof options !== "object" || options === null) {
    throw contextError(
      "INVALID_EXECUTION_OPTIONS",
      [],
      "Execution options must be an object.",
    );
  }
  if (options.seed !== undefined && options.random !== undefined) {
    throw contextError(
      "CONFLICTING_RANDOM_OPTIONS",
      ["seed"],
      "seed and random cannot be supplied together.",
    );
  }
  const maxDepth = options.maxDepth ?? 64;
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0) {
    throw contextError(
      "INVALID_EXECUTION_OPTIONS",
      ["maxDepth"],
      "maxDepth must be a non-negative safe integer.",
    );
  }
  const random =
    options.seed !== undefined
      ? createSeededRandom(options.seed)
      : options.random !== undefined
        ? createRandomSource(options.random)
        : createDefaultRandomSource();
  return { random, maxDepth };
}

function analyzeGeneratorDependencies(
  implementation: GeneratorImplementation<GeneratorDefinition, unknown>,
  definition: GeneratorDefinition,
  registry: GeneratorRegistrySnapshot,
  path: ValidationPath,
): void {
  if (implementation.analyzeDependencies === undefined) return;
  let dependencies: readonly GeneratorDependency[];
  try {
    dependencies = implementation.analyzeDependencies(definition);
  } catch (cause) {
    throw normalizeConstructaError(cause, {
      kind: "dependency",
      code: "DEPENDENCY_ANALYSIS_FAILED",
      path,
      message: "Generator dependency analysis failed.",
    });
  }
  if (!Array.isArray(dependencies)) {
    throw new ConstructaError({
      kind: "system",
      code: "DEPENDENCY_ANALYSIS_FAILED",
      path,
      message: "Generator dependency analysis returned an invalid result.",
    });
  }
  for (const dependency of dependencies) {
    if (!isGeneratorDependency(dependency)) {
      throw new ConstructaError({
        kind: "system",
        code: "DEPENDENCY_ANALYSIS_FAILED",
        path,
        message:
          "Generator dependency analysis returned an invalid dependency.",
      });
    }
    registry.lookup(dependency.typeId, [...path, ...dependency.path]);
  }
}

function isGeneratorDependency(value: unknown): value is GeneratorDependency {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as GeneratorDependency).typeId === "string" &&
    Array.isArray((value as GeneratorDependency).path) &&
    (value as GeneratorDependency).path.every(
      (segment) => typeof segment === "string" || Number.isSafeInteger(segment),
    )
  );
}

function invokeValidatedGeneratorImplementation(
  implementation: GeneratorImplementation<GeneratorDefinition, unknown>,
  definition: GeneratorDefinition,
  context: GenerationContext,
  path: ValidationPath,
): unknown {
  try {
    return implementation.generate({ definition, context });
  } catch (cause) {
    if (cause instanceof ConstructaError) {
      return throwWithExecutionPath(cause, path);
    }
    throw normalizeConstructaError(cause, {
      kind: "execution",
      code: "EXECUTION_FAILED",
      path,
      message: "Generator execution failed.",
    });
  }
}

function throwWithExecutionPath(
  error: ConstructaError,
  path: ValidationPath,
): never {
  if (path.length === 0 || startsWithPath(error.path, path)) throw error;
  throw new ConstructaError({
    kind: error.kind,
    code: error.code,
    path: [...path, ...error.path],
    message: error.message,
    details: error.details,
  });
}

function startsWithPath(path: ValidationPath, prefix: ValidationPath): boolean {
  return prefix.every((segment, index) => path[index] === segment);
}

/**
 * Defines a trusted, developer-authored generator implementation. This API has
 * no dependency on a particular validation library.
 */
export function defineGenerator<
  const Definition extends GeneratorDefinition<Output>,
  Output,
>(
  implementation: GeneratorImplementation<Definition, Output>,
): GeneratorImplementation<Definition, Output> {
  assertGeneratorImplementation(implementation);
  return implementation;
}

/** Builds a portable definition while preserving literal fields and output inference. */
export function createGeneratorDefinition<
  Output,
  const Definition extends GeneratorDefinition<Output>,
>(definition: Definition): Definition {
  assertGeneratorDefinition(definition);
  return definition;
}

/**
 * Invokes one validated implementation. Registry lookup and dispatch are added
 * later; this function keeps validation and execution failure normalization in
 * the same shared contract today.
 */
export function invokeGeneratorImplementation<
  Definition extends GeneratorDefinition<Output>,
  Output,
>(
  implementation: GeneratorImplementation<Definition, Output>,
  input: {
    readonly definition: Definition;
    readonly context: GenerationContext;
    readonly path?: ValidationPath;
  },
): Output {
  const path = input.path ?? [];
  let issues: readonly ValidationIssue[];

  try {
    issues = implementation.validateDefinition(input.definition);
  } catch (cause) {
    throw normalizeConstructaError(cause, {
      kind: "configuration",
      code: "INVALID_CONFIGURATION",
      path,
      message: "Generator definition validation failed.",
    });
  }

  if (issues.length > 0) {
    const [issue] = issues;
    if (issue !== undefined) {
      throw new ConstructaError({
        kind: "configuration",
        code: errorCodeForValidationIssue(issue.code),
        path: [...path, ...issue.path],
        message: issue.message,
        details: { issueCode: issue.code },
      });
    }

    throw new ConstructaError({
      kind: "system",
      code: "EXECUTION_FAILED",
      path,
      message: "Generator validation returned an invalid result.",
    });
  }

  try {
    return implementation.generate({
      definition: input.definition,
      context: input.context,
    });
  } catch (cause) {
    throw normalizeConstructaError(cause, {
      kind: "execution",
      code: "EXECUTION_FAILED",
      path,
      message: "Generator execution failed.",
    });
  }
}

const DEFAULT_PARSE_LIMITS = Object.freeze({
  maxDepth: 64,
  maxIssues: 100,
  maxNodes: 10_000,
});

type ResolvedParseLimits = {
  readonly maxDepth: number;
  readonly maxIssues: number;
  readonly maxNodes: number;
};

function parseRuntimeDefinition(
  value: unknown,
  path: ValidationPath,
  options: ParseDefinitionOptions,
): DefinitionParseResult {
  const limits = resolveParseLimits(options);
  const schemaIssues = validationIssuesToErrors(
    validateDefinitionSafely(value, path),
    path,
    limits.maxIssues,
  );
  if (schemaIssues.length > 0) return { success: false, issues: schemaIssues };

  const issues: ConstructaError[] = [];
  const visited = new Set<object>();
  visitRuntimeDefinition(
    value as GeneratorDefinition,
    path,
    0,
    options.registry,
    limits,
    visited,
    issues,
  );
  return issues.length === 0
    ? {
        success: true,
        value: markParsedDefinitions(visited, value as GeneratorDefinition),
      }
    : { success: false, issues: Object.freeze(issues) };
}

function markParsedDefinitions(
  definitions: ReadonlySet<object>,
  definition: GeneratorDefinition,
): ParsedGeneratorDefinition {
  for (const parsed of definitions) parsedDefinitions.add(parsed);
  return definition as ParsedGeneratorDefinition;
}

function visitRuntimeDefinition(
  definition: GeneratorDefinition,
  path: ValidationPath,
  depth: number,
  registry: ParseDefinitionOptions["registry"],
  limits: ResolvedParseLimits,
  visited: Set<object>,
  issues: ConstructaError[],
): void {
  if (issues.length >= limits.maxIssues) return;
  if (depth > limits.maxDepth) {
    addParseIssue(
      issues,
      limits,
      "PARSE_DEPTH_LIMIT",
      path,
      "Generator definition exceeds the maximum nesting depth.",
    );
    return;
  }
  if (visited.size >= limits.maxNodes) {
    addParseIssue(
      issues,
      limits,
      "PARSE_NODE_LIMIT",
      path,
      "Generator definition exceeds the maximum node count.",
    );
    return;
  }
  visited.add(definition);

  let implementation: GeneratorImplementation<GeneratorDefinition, unknown>;
  try {
    implementation = registry.lookup(definition.type, path);
  } catch (cause) {
    const error = normalizeConstructaError(cause, {
      kind: "dependency",
      code: "UNKNOWN_GENERATOR",
      path: [...path, "type"],
      message: "Generator type could not be resolved.",
    });
    addExistingParseIssue(issues, limits, error);
    return;
  }

  let validationIssues: readonly ValidationIssue[];
  try {
    validationIssues = implementation.validateDefinition(definition);
  } catch (cause) {
    addExistingParseIssue(
      issues,
      limits,
      normalizeConstructaError(cause, {
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path,
        message: "Generator definition validation failed.",
      }),
    );
    return;
  }
  if (!Array.isArray(validationIssues)) {
    addParseIssue(
      issues,
      limits,
      "INVALID_CONFIGURATION",
      path,
      "Generator definition validation returned an invalid result.",
      "system",
    );
    return;
  }
  for (const issue of validationIssues) {
    if (!isValidationIssue(issue)) {
      addParseIssue(
        issues,
        limits,
        "INVALID_CONFIGURATION",
        path,
        "Generator definition validation returned an invalid issue.",
        "system",
      );
      return;
    }
    addParseIssue(
      issues,
      limits,
      errorCodeForValidationIssue(issue.code),
      [...path, ...issue.path],
      issue.message,
    );
  }

  // Configurations are portable JSON. Every embedded object with a generator
  // discriminator is another definition and must pass the same pipeline.
  for (const [key, child] of Object.entries(definition)) {
    if (key !== "type")
      visitEmbeddedDefinitions(
        child,
        [...path, key],
        depth + 1,
        registry,
        limits,
        visited,
        issues,
      );
    if (issues.length >= limits.maxIssues) return;
  }
}

function visitEmbeddedDefinitions(
  value: unknown,
  path: ValidationPath,
  depth: number,
  registry: ParseDefinitionOptions["registry"],
  limits: ResolvedParseLimits,
  visited: Set<object>,
  issues: ConstructaError[],
): void {
  if (
    issues.length >= limits.maxIssues ||
    value === null ||
    typeof value !== "object"
  )
    return;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      visitEmbeddedDefinitions(
        value[index],
        [...path, index],
        depth,
        registry,
        limits,
        visited,
        issues,
      );
      if (issues.length >= limits.maxIssues) return;
    }
    return;
  }
  if (Object.hasOwn(value, "type")) {
    visitRuntimeDefinition(
      value as GeneratorDefinition,
      path,
      depth,
      registry,
      limits,
      visited,
      issues,
    );
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    visitEmbeddedDefinitions(
      child,
      [...path, key],
      depth,
      registry,
      limits,
      visited,
      issues,
    );
    if (issues.length >= limits.maxIssues) return;
  }
}

function resolveParseLimits(
  options: ParseDefinitionOptions,
): ResolvedParseLimits {
  if (
    typeof options !== "object" ||
    options === null ||
    typeof options.registry !== "object" ||
    options.registry === null ||
    typeof options.registry.lookup !== "function"
  ) {
    throw contextError(
      "INVALID_PARSE_OPTIONS",
      [],
      "Parsing requires a registry with a lookup function.",
    );
  }
  const supplied = options.limits ?? {};
  const resolved = {
    maxDepth: supplied.maxDepth ?? DEFAULT_PARSE_LIMITS.maxDepth,
    maxIssues: supplied.maxIssues ?? DEFAULT_PARSE_LIMITS.maxIssues,
    maxNodes: supplied.maxNodes ?? DEFAULT_PARSE_LIMITS.maxNodes,
  };
  for (const [name, value] of Object.entries(resolved)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw contextError(
        "INVALID_PARSE_LIMITS",
        ["limits", name],
        `${name} must be a positive safe integer.`,
      );
    }
  }
  return resolved;
}

function validateDefinitionSafely(
  value: unknown,
  path: ValidationPath,
): readonly ValidationIssue[] {
  try {
    return validateGeneratorDefinition(value, path);
  } catch (_cause) {
    return [
      {
        code: "invalid_json_value",
        path,
        message: "Definition could not be safely inspected.",
      },
    ];
  }
}

function validateDocumentSafely(value: unknown): readonly ValidationIssue[] {
  try {
    return validateDocument(value);
  } catch {
    return [
      {
        code: "invalid_json_value",
        path: [],
        message: "Document could not be safely inspected.",
      },
    ];
  }
}

function validationIssuesToErrors(
  issues: readonly ValidationIssue[],
  fallbackPath: ValidationPath,
  maxIssues = Number.POSITIVE_INFINITY,
): ConstructaError[] {
  return issues.slice(0, maxIssues).map(
    (issue) =>
      new ConstructaError({
        kind: "configuration",
        code: isValidationIssue(issue)
          ? errorCodeForValidationIssue(issue.code)
          : "INVALID_CONFIGURATION",
        path: isValidationIssue(issue) ? issue.path : fallbackPath,
        message: isValidationIssue(issue)
          ? issue.message
          : "Validation returned an invalid issue.",
        details: isValidationIssue(issue)
          ? { issueCode: issue.code }
          : undefined,
      }),
  );
}

function errorCodeForValidationIssue(code: string): Uppercase<string> {
  const reservedCodes: Record<string, Uppercase<string>> = {
    empty_choice: "EMPTY_CHOICE",
    invalid_length: "INVALID_LENGTH",
    invalid_range: "INVALID_RANGE",
  };
  return reservedCodes[code] ?? "INVALID_CONFIGURATION";
}

function isValidationIssue(value: unknown): value is ValidationIssue {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ValidationIssue).code === "string" &&
    typeof (value as ValidationIssue).message === "string" &&
    Array.isArray((value as ValidationIssue).path)
  );
}

function addParseIssue(
  issues: ConstructaError[],
  limits: ResolvedParseLimits,
  code: string,
  path: ValidationPath,
  message: string,
  kind: "configuration" | "system" = "configuration",
): void {
  if (issues.length < limits.maxIssues)
    issues.push(
      new ConstructaError({
        kind,
        code: code as Uppercase<string>,
        path,
        message,
      }),
    );
}

function addExistingParseIssue(
  issues: ConstructaError[],
  limits: ResolvedParseLimits,
  error: ConstructaError,
): void {
  if (issues.length < limits.maxIssues) issues.push(error);
}

function assertGeneratorImplementation(implementation: {
  readonly type: string;
  readonly version: number;
  readonly validateDefinition: unknown;
  readonly analyzeDependencies?: unknown;
  readonly generate: unknown;
}): void {
  if (!isStableTypeId(implementation.type)) {
    throw new TypeError("generator type must be a stable lowercase identifier");
  }
  if (
    !Number.isSafeInteger(implementation.version) ||
    implementation.version < 1
  ) {
    throw new TypeError("generator version must be a positive safe integer");
  }
  if (typeof implementation.validateDefinition !== "function") {
    throw new TypeError("validateDefinition must be a function");
  }
  if (typeof implementation.generate !== "function") {
    throw new TypeError("generate must be a function");
  }
  if (
    implementation.analyzeDependencies !== undefined &&
    typeof implementation.analyzeDependencies !== "function"
  ) {
    throw new TypeError("analyzeDependencies must be a function when present");
  }
}

function assertRegistryImplementation(implementation: {
  readonly type: string;
  readonly version: number;
  readonly validateDefinition: unknown;
  readonly analyzeDependencies?: unknown;
  readonly generate: unknown;
}): void {
  try {
    assertGeneratorImplementation(implementation);
  } catch {
    throw registryError(
      "INVALID_CONFIGURATION",
      ["implementation"],
      "Generator implementation is invalid.",
    );
  }
  if (RESERVED_GENERATOR_TYPE_IDS.has(implementation.type)) {
    throw registryError(
      "INVALID_CONFIGURATION",
      ["type"],
      `Generator type "${implementation.type}" is reserved.`,
    );
  }
}

function freezeImplementation<
  Definition extends GeneratorDefinition<Output>,
  Output,
>(
  implementation: GeneratorImplementation<Definition, Output>,
): GeneratorImplementation<Definition, Output> {
  return Object.freeze({ ...implementation });
}

function createRegistrySnapshot(
  implementations: ReadonlyMap<
    string,
    GeneratorImplementation<GeneratorDefinition, unknown>
  >,
): GeneratorRegistrySnapshot {
  const snapshotImplementations = new Map(implementations);
  const generators = [...snapshotImplementations.values()]
    .map(({ type, version }) => Object.freeze({ type, version }))
    .sort((left, right) => left.type.localeCompare(right.type));

  return Object.freeze({
    generators: Object.freeze(generators),
    lookup(type: string, path: ValidationPath = []) {
      return lookupImplementation(snapshotImplementations, type, path);
    },
  });
}

function lookupImplementation(
  implementations: ReadonlyMap<
    string,
    GeneratorImplementation<GeneratorDefinition, unknown>
  >,
  type: string,
  path: ValidationPath,
): GeneratorImplementation<GeneratorDefinition, unknown> {
  const implementation = implementations.get(type);
  if (implementation !== undefined) return implementation;

  const registeredTypes = [...implementations.keys()].sort((left, right) =>
    left.localeCompare(right),
  );
  throw new ConstructaError({
    kind: "dependency",
    code: "UNKNOWN_GENERATOR",
    path: [...path, "type"],
    message: `No generator with type "${type}" is registered.`,
    details: { registeredTypes },
  });
}

function registryError(
  code: "DUPLICATE_GENERATOR" | "INVALID_CONFIGURATION" | "UNKNOWN_GENERATOR",
  path: ValidationPath,
  message: string,
): ConstructaError {
  return new ConstructaError({ kind: "configuration", code, path, message });
}

function assertRandomSourceAdapter(adapter: RandomSourceAdapter): void {
  if (
    typeof adapter !== "object" ||
    adapter === null ||
    typeof adapter.float !== "function" ||
    typeof adapter.integer !== "function" ||
    typeof adapter.bytes !== "function"
  ) {
    throw invalidRandomSource(
      "A random source must provide float(), integer(), and bytes() methods.",
    );
  }
}

function assertRandomLength(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw invalidRandomSource(`${name} must be a positive safe integer.`);
  }
}

function assertByteLength(length: number): void {
  if (!Number.isSafeInteger(length) || length < 0) {
    throw invalidRandomSource("length must be a non-negative safe integer.");
  }
}

function invalidRandomSource(message: string): ConstructaError {
  return new ConstructaError({
    kind: "system",
    code: "INVALID_RANDOM_SOURCE",
    path: ["random"],
    message,
  });
}

function assertContextPath(path: ValidationPath): void {
  for (const segment of path) assertContextPathSegment(segment);
}

function assertContextPathSegment(
  segment: unknown,
): asserts segment is ValidationPathSegment {
  if (
    typeof segment !== "string" &&
    (!Number.isSafeInteger(segment) || typeof segment !== "number")
  ) {
    throw contextError(
      "INVALID_GENERATION_CONTEXT",
      ["path"],
      "Context path segments must be strings or safe integers.",
    );
  }
}

function assertChildPathSegment(
  segment: unknown,
  path: ValidationPath,
): asserts segment is ValidationPathSegment {
  if (
    typeof segment !== "string" &&
    (typeof segment !== "number" || !Number.isSafeInteger(segment))
  ) {
    throw contextError(
      "INVALID_CHILD_PATH",
      path,
      "Child path segments must be strings or safe integers.",
    );
  }
}

function contextError(
  code: string,
  path: ValidationPath,
  message: string,
): ConstructaError {
  return new ConstructaError({
    kind: "configuration",
    code: code as Uppercase<string>,
    path,
    message,
  });
}

function hashSeed(seed: string): number {
  let hash = 0x811c_9dc5;
  for (const byte of new TextEncoder().encode(seed)) {
    hash = Math.imul(hash ^ byte, 0x0100_0193) >>> 0;
  }
  return hash;
}

function isStableTypeId(value: string): boolean {
  return /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value);
}
