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
  GeneratorDocumentV1,
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

/** An application-provided random source validated by `createRandomSource`. */
export type RandomSourceAdapter = RandomSource;

const validatedRandomSources = new WeakSet<object>();

/** A deterministic random-source seed. */
export type Seed = number | string;

/** Per-root-execution limits and random-source options. */
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
  /** Stops execution before the next generator dispatch when aborted. */
  readonly signal?: AbortSignal;
  /** Stops execution before the next generator dispatch after this UTC epoch time. */
  readonly deadline?: number;
};

/** Executes validated generator definitions through a registry snapshot. */
export type Executor = {
  generate: <Definition extends GeneratorDefinition>(
    definition: Definition,
    options?: ExecutionOptions,
  ) => import("constructa-schema").Infer<Definition>;
};

/** The deterministic random algorithm used by `createSeededRandom`. */
export const SEEDED_RANDOM_ALGORITHM = "mulberry32";
/** The compatibility version of the seeded random algorithm. */
export const SEEDED_RANDOM_ALGORITHM_VERSION = 1;

/** Public metadata identifying the seeded random algorithm. */
export type SeededRandomMetadata = {
  readonly algorithm: typeof SEEDED_RANDOM_ALGORITHM;
  readonly version: typeof SEEDED_RANDOM_ALGORITHM_VERSION;
};

/** Values that must remain compatible to reproduce an execution. */
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
/** Capabilities supplied to a trusted generator implementation. */
export type GenerationContext = {
  readonly random: RandomSource;
  /** The definition path currently being generated. */
  readonly path: ValidationPath;
  /** Delegates a typed child definition to the engine. */
  readonly executeChild: <Output>(
    definition: GeneratorDefinition<Output>,
    pathSegment: ValidationPathSegment,
  ) => Output;
  /**
   * Read-only values from the object currently being generated. Values are
   * available only after their field has completed.
   */
  readonly references: ReferenceResolver;
  /** Creates an isolated scope for the fields of one composite object. */
  readonly createObjectScope: () => ObjectGenerationScope;
  /** Returns value dependencies declared by one direct child definition. */
  readonly analyzeChildValueDependencies: (
    definition: GeneratorDefinition,
    pathSegment: ValidationPathSegment,
  ) => readonly ValueDependency[];
};

/** A property path relative to the object containing a reference. */
/** A property path used by an object-local template reference. */
export type ReferencePath = readonly string[];

/** A parsed template fragment. Braces are escaped with `{{` and `}}`. */
/** One literal or reference segment of parsed template source. */
export type TemplateToken =
  | { readonly type: "literal"; readonly value: string }
  | { readonly type: "reference"; readonly path: ReferencePath };

/** Options controlling template-token parse diagnostics. */
export type ParseTemplateTokensOptions = {
  /** Definition-relative path reported for malformed template syntax. */
  readonly path?: ValidationPath;
};

/**
 * Parses MVP template syntax without executing or resolving references.
 *
 * `{field}` addresses a sibling and `{field.nested}` addresses a value below
 * that sibling. `{{` and `}}` emit literal braces. Whitespace, empty path
 * segments, and expression characters inside a reference are unsupported.
 */
export function parseTemplateTokens(
  source: string,
  options: ParseTemplateTokensOptions = {},
): readonly TemplateToken[] {
  const path = options.path ?? [];
  if (typeof source !== "string") {
    throw templateTokenError(path, "Template source must be a string.");
  }
  assertContextPath(path);

  const tokens: TemplateToken[] = [];
  let literal = "";
  const appendLiteral = (value: string) => {
    literal += value;
  };
  const flushLiteral = () => {
    if (literal.length === 0) return;
    tokens.push(Object.freeze({ type: "literal", value: literal }));
    literal = "";
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "{") {
      if (source[index + 1] === "{") {
        appendLiteral("{");
        index += 1;
        continue;
      }
      const closingIndex = source.indexOf("}", index + 1);
      if (closingIndex === -1) {
        throw templateTokenError(
          path,
          "Template reference is missing a closing brace.",
        );
      }
      const reference = source.slice(index + 1, closingIndex);
      const referencePath = parseReferencePath(reference, path);
      flushLiteral();
      tokens.push(Object.freeze({ type: "reference", path: referencePath }));
      index = closingIndex;
      continue;
    }
    if (character === "}") {
      if (source[index + 1] === "}") {
        appendLiteral("}");
        index += 1;
        continue;
      }
      throw templateTokenError(
        path,
        "Template contains an unmatched closing brace.",
      );
    }
    appendLiteral(character ?? "");
  }
  flushLiteral();
  return Object.freeze(tokens);
}

/** Parses one dot-separated object-local reference path. */
export function parseReferencePath(
  source: string,
  path: ValidationPath = [],
): ReferencePath {
  if (typeof source !== "string" || source.length === 0) {
    throw templateTokenError(path, "Template reference must not be empty.");
  }
  assertContextPath(path);
  const segments = source.split(".");
  if (
    segments.some(
      (segment) => segment.length === 0 || !/^[\p{L}\p{N}_$-]+$/u.test(segment),
    )
  ) {
    throw templateTokenError(
      path,
      "Template reference segments must use letters, numbers, underscores, dollar signs, or hyphens.",
    );
  }
  return Object.freeze(segments);
}

function templateTokenError(
  path: ValidationPath,
  message: string,
): ConstructaError {
  return new ConstructaError({
    kind: "configuration",
    code: "INVALID_TEMPLATE_TOKEN",
    path,
    message,
  });
}

/** A portable value dependency declared by a generator definition. */
/** One value dependency declared by a child generator. */
export type ValueDependency = {
  readonly path: ReferencePath;
};

/** Dependencies for a direct field in a composite definition. */
/** A composite child and the values it depends on. */
export type CompositeDependencyNode = {
  readonly fieldPath: readonly [string];
  readonly dependencies: readonly ValueDependency[];
};

/** Portable dependency data used to schedule one composite object. */
/** An immutable analysis of composite-child dependencies. */
export type CompositeDependencyAnalysis = {
  readonly nodes: readonly CompositeDependencyNode[];
};

/** Options used to order dependent composite children. */
export type CompositeDependencySchedulingOptions = {
  /** Every reference path that exists in the containing object definition. */
  readonly referencePaths?: readonly ReferencePath[];
  /** Maximum fields participating in one object-local reference graph. */
  readonly maxNodes?: number;
  /** Maximum unique field dependencies in one object-local reference graph. */
  readonly maxEdges?: number;
};

/** The read-only capability supplied to generators that resolve references. */
/** Resolves values visible to an executing generator. */
export type ReferenceResolver = {
  resolve: (path: ReferencePath) => unknown;
};

/** Executes and records completed fields within one isolated object scope. */
/** An isolated object-field execution scope. */
export type ObjectGenerationScope = {
  executeChild: <Output>(
    definition: GeneratorDefinition<Output>,
    pathSegment: string,
  ) => Output;
};

/** Inputs used to create a generator execution context. */
export type GenerationContextOptions = {
  readonly random: RandomSource;
  readonly path?: ValidationPath;
  readonly executeChild?: GenerationContext["executeChild"];
  readonly references?: ReferenceResolver;
  readonly createObjectScope?: GenerationContext["createObjectScope"];
  readonly analyzeChildValueDependencies?: GenerationContext["analyzeChildValueDependencies"];
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

  const references = options.references ?? unavailableReferenceResolver(path);
  if (
    typeof references !== "object" ||
    references === null ||
    typeof references.resolve !== "function"
  ) {
    throw contextError(
      "INVALID_GENERATION_CONTEXT",
      [],
      "references must provide a resolve function when present.",
    );
  }
  const createObjectScope =
    options.createObjectScope ??
    (() =>
      Object.freeze({
        executeChild<Output>(
          definition: GeneratorDefinition<Output>,
          pathSegment: string,
        ): Output {
          return executeChild(definition, pathSegment);
        },
      }));
  if (typeof createObjectScope !== "function") {
    throw contextError(
      "INVALID_GENERATION_CONTEXT",
      [],
      "createObjectScope must be a function when present.",
    );
  }
  const analyzeChildValueDependencies =
    options.analyzeChildValueDependencies ?? (() => []);
  if (typeof analyzeChildValueDependencies !== "function") {
    throw contextError(
      "INVALID_GENERATION_CONTEXT",
      [],
      "analyzeChildValueDependencies must be a function when present.",
    );
  }

  return Object.freeze({
    random,
    path,
    executeChild,
    references: Object.freeze({ resolve: references.resolve }),
    createObjectScope,
    analyzeChildValueDependencies,
  });
}

/** Freezes direct-field dependency declarations into portable analysis data. */
export function createCompositeDependencyAnalysis(
  nodes: readonly CompositeDependencyNode[],
): CompositeDependencyAnalysis {
  if (!Array.isArray(nodes)) {
    throw contextError(
      "INVALID_COMPOSITE_DEPENDENCIES",
      [],
      "Composite dependency nodes must be an array.",
    );
  }
  const names = new Set<string>();
  const normalized = nodes.map((node, index) => {
    if (!isCompositeDependencyNode(node) || names.has(node.fieldPath[0])) {
      throw contextError(
        "INVALID_COMPOSITE_DEPENDENCIES",
        ["nodes", index],
        "Each composite dependency node must name one unique field.",
      );
    }
    names.add(node.fieldPath[0]);
    return Object.freeze({
      fieldPath: Object.freeze([...node.fieldPath]) as readonly [string],
      dependencies: Object.freeze(
        node.dependencies.map((dependency) =>
          Object.freeze({ path: Object.freeze([...dependency.path]) }),
        ),
      ),
    });
  });
  return Object.freeze({ nodes: Object.freeze(normalized) });
}

/**
 * Returns a deterministic execution order for direct object fields. A
 * dependency path may target a nested value below another direct field.
 */
export function scheduleCompositeDependencies(
  analysis: CompositeDependencyAnalysis,
  options: CompositeDependencySchedulingOptions = {},
): readonly string[] {
  const nodes = analysis.nodes;
  const maxNodes = options.maxNodes ?? 10_000;
  const maxEdges = options.maxEdges ?? 100_000;
  if (
    !Number.isSafeInteger(maxNodes) ||
    maxNodes < 1 ||
    !Number.isSafeInteger(maxEdges) ||
    maxEdges < 1
  ) {
    throw contextError(
      "INVALID_COMPOSITE_DEPENDENCIES",
      [],
      "Composite graph limits must be positive safe integers.",
    );
  }
  if (nodes.length > maxNodes) {
    throw new ConstructaError({
      kind: "configuration",
      code: "REFERENCE_GRAPH_NODE_LIMIT",
      path: [],
      message:
        "Object reference graph exceeds the configured maximum field count.",
    });
  }
  const byName = new Map(nodes.map((node) => [node.fieldPath[0], node]));
  const referencePaths = new Set(
    (options.referencePaths ?? nodes.map((node) => node.fieldPath)).map(
      referencePathKey,
    ),
  );
  const remaining = new Map<string, Set<string>>();
  const dependents = new Map<string, string[]>();
  let edgeCount = 0;

  for (const node of nodes) {
    const dependencies = new Set<string>();
    for (const dependency of node.dependencies) {
      const target = dependency.path[0];
      if (
        target === undefined ||
        !byName.has(target) ||
        !referencePaths.has(referencePathKey(dependency.path))
      ) {
        throw new ConstructaError({
          kind: "dependency",
          code: "REFERENCE_NOT_FOUND",
          path: [...node.fieldPath],
          message: "The referenced object value could not be found.",
          details: { referencePath: [...dependency.path] },
        });
      }
      if (!dependencies.has(target)) {
        dependencies.add(target);
        edgeCount += 1;
      }
      if (edgeCount > maxEdges) {
        throw new ConstructaError({
          kind: "configuration",
          code: "REFERENCE_GRAPH_EDGE_LIMIT",
          path: [...node.fieldPath],
          message:
            "Object reference graph exceeds the configured maximum dependency count.",
        });
      }
      const targets = dependents.get(target) ?? [];
      if (!targets.includes(node.fieldPath[0])) targets.push(node.fieldPath[0]);
      dependents.set(target, targets);
    }
    remaining.set(node.fieldPath[0], dependencies);
  }

  const ready = nodes
    .filter((node) => (remaining.get(node.fieldPath[0])?.size ?? 0) === 0)
    .map((node) => node.fieldPath[0])
    .sort();
  const ordered: string[] = [];
  while (ready.length > 0) {
    const field = ready.shift();
    if (field === undefined) continue;
    ordered.push(field);
    for (const dependent of (dependents.get(field) ?? []).sort()) {
      const dependencies = remaining.get(dependent);
      dependencies?.delete(field);
      if (dependencies?.size === 0) {
        ready.push(dependent);
        ready.sort();
      }
    }
  }
  if (ordered.length !== nodes.length) {
    const cycle = findCompositeDependencyCycle(remaining);
    throw new ConstructaError({
      kind: "dependency",
      code: "CIRCULAR_REFERENCE",
      path: cycle.slice(0, 1),
      message: `Circular object value reference detected: ${cycle.join(" -> ")}.`,
      details: { fields: cycle },
    });
  }
  return Object.freeze(ordered);
}

function findCompositeDependencyCycle(
  remaining: ReadonlyMap<string, ReadonlySet<string>>,
): string[] {
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];
  const visit = (field: string): string[] | undefined => {
    visited.add(field);
    active.add(field);
    stack.push(field);
    for (const dependency of [...(remaining.get(field) ?? [])].sort()) {
      if (!remaining.has(dependency)) continue;
      if (active.has(dependency)) {
        const start = stack.indexOf(dependency);
        return [...stack.slice(start), dependency];
      }
      if (!visited.has(dependency)) {
        const cycle = visit(dependency);
        if (cycle !== undefined) return cycle;
      }
    }
    active.delete(field);
    stack.pop();
    return undefined;
  };

  for (const field of [...remaining.keys()].sort()) {
    if (visited.has(field)) continue;
    const cycle = visit(field);
    if (cycle !== undefined) return cycle;
  }
  return [];
}

/** Bounds applied while parsing untrusted definitions or documents. */
export type ParseLimits = {
  readonly maxDepth?: number;
  readonly maxIssues?: number;
  readonly maxNodes?: number;
  /** Maximum UTF-8 encoded definition bytes. */
  readonly maxBytes?: number;
  /** Maximum properties in any input object record. */
  readonly maxObjectFields?: number;
  /** Maximum items in any input array. */
  readonly maxArrayLength?: number;
  /** Maximum template source length. */
  readonly maxTemplateLength?: number;
  /** Maximum parsed template references. */
  readonly maxTemplateTokens?: number;
};

/** Options for parsing a portable generator definition. */
export type ParseDefinitionOptions = {
  readonly registry: Pick<
    GeneratorRegistry | GeneratorRegistrySnapshot,
    "lookup"
  >;
  readonly limits?: ParseLimits;
};

/** Options for parsing a versioned generator document. */
export type ParseDocumentOptions = ParseDefinitionOptions;

/** The success-or-failure result returned by `safeParseDefinition`. */
export type DefinitionParseResult =
  | { readonly success: true; readonly value: ParsedGeneratorDefinition }
  | { readonly success: false; readonly issues: readonly ConstructaError[] };

/** The success-or-failure result returned by `safeParseDocument`. */
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

/** A generator type and version required by an implementation. */
export type GeneratorDependency = {
  readonly typeId: string;
  readonly path: ValidationPath;
};

declare const parsedGeneratorDefinition: unique symbol;

/** A runtime-validated definition accepted by an executor without revalidation. */
/** A generator definition already validated against a registry. */
export type ParsedGeneratorDefinition = GeneratorDefinition & {
  readonly [parsedGeneratorDefinition]: true;
};

const parsedDefinitions = new WeakSet<object>();

/** A trusted implementation of one portable generator type. */
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
  /** Declares object-local value references used by this definition. */
  readonly analyzeValueDependencies?: (
    definition: Definition,
  ) => readonly ValueDependency[];
  readonly generate: (input: {
    readonly definition: Definition;
    readonly context: GenerationContext;
  }) => Output;
};

/** A registry entry for one generator type. */
export type RegisteredGenerator = {
  readonly type: string;
  readonly version: number;
};

/** An immutable point-in-time view of a generator registry. */
export type GeneratorRegistrySnapshot = {
  readonly generators: readonly RegisteredGenerator[];
  readonly lookup: (
    type: string,
    path?: ValidationPath,
  ) => GeneratorImplementation<GeneratorDefinition, unknown>;
};

/** A mutable registry of trusted generator implementations. */
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
  readonly signal?: AbortSignal;
  readonly deadline?: number;
};

function executeParsedDefinition(
  definition: GeneratorDefinition,
  path: ValidationPath,
  depth: number,
  state: ExecutionState,
  references: ReferenceResolver = unavailableReferenceResolver(path),
): unknown {
  assertExecutionActive(state, path);
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
    references,
    createObjectScope() {
      return createObjectGenerationScope(
        path,
        (child, pathSegment, scopeReferences) => {
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
          const parsed = parseDefinitionAtPath(
            child,
            childPath,
            state.snapshot,
          );
          return executeParsedDefinition(
            parsed,
            childPath,
            depth + 1,
            state,
            scopeReferences,
          );
        },
      );
    },
    analyzeChildValueDependencies(child, pathSegment) {
      assertChildPathSegment(pathSegment, path);
      const childPath = [...path, pathSegment];
      const parsed = parseDefinitionAtPath(child, childPath, state.snapshot);
      const childImplementation = state.snapshot.lookup(parsed.type, childPath);
      return analyzeValueDependencies(childImplementation, parsed, childPath);
    },
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
        references,
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

function createObjectGenerationScope(
  path: ValidationPath,
  executeChild: (
    definition: GeneratorDefinition,
    pathSegment: string,
    references: ReferenceResolver,
  ) => unknown,
): ObjectGenerationScope {
  const completed = new Map<string, unknown>();
  const resolver: ReferenceResolver = Object.freeze({
    resolve(referencePath: ReferencePath): unknown {
      assertReferencePath(referencePath, path);
      const key = referencePathKey(referencePath);
      if (!completed.has(key)) {
        throw new ConstructaError({
          kind: "dependency",
          code: "REFERENCE_NOT_AVAILABLE",
          path,
          message: "The referenced object value has not completed.",
        });
      }
      return completed.get(key);
    },
  });
  return Object.freeze({
    executeChild<Output>(
      definition: GeneratorDefinition<Output>,
      pathSegment: string,
    ): Output {
      const value = executeChild(definition, pathSegment, resolver) as Output;
      recordCompletedValue(completed, [pathSegment], value);
      return value;
    },
  });
}

function recordCompletedValue(
  completed: Map<string, unknown>,
  referencePath: readonly string[],
  value: unknown,
  visited = new WeakSet<object>(),
): void {
  completed.set(referencePathKey(referencePath), value);
  if (typeof value !== "object" || value === null || visited.has(value)) return;
  visited.add(value);
  for (const [key, child] of Object.entries(value)) {
    recordCompletedValue(completed, [...referencePath, key], child, visited);
  }
}

function unavailableReferenceResolver(path: ValidationPath): ReferenceResolver {
  return Object.freeze({
    resolve(referencePath: ReferencePath): never {
      assertReferencePath(referencePath, path);
      throw new ConstructaError({
        kind: "dependency",
        code: "REFERENCE_RESOLUTION_UNAVAILABLE",
        path,
        message:
          "Reference resolution is available only inside an object field.",
      });
    },
  });
}

function assertReferencePath(
  referencePath: ReferencePath,
  contextPath: ValidationPath,
): void {
  if (
    !Array.isArray(referencePath) ||
    referencePath.length === 0 ||
    referencePath.some(
      (segment) => typeof segment !== "string" || segment.length === 0,
    )
  ) {
    throw contextError(
      "INVALID_REFERENCE_PATH",
      contextPath,
      "Reference paths must contain one or more non-empty string segments.",
    );
  }
}

function referencePathKey(path: readonly string[]): string {
  return JSON.stringify(path);
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
  if (options.signal !== undefined && typeof options.signal !== "object") {
    throw contextError(
      "INVALID_EXECUTION_OPTIONS",
      ["signal"],
      "signal must be an AbortSignal when supplied.",
    );
  }
  if (
    options.deadline !== undefined &&
    (!Number.isFinite(options.deadline) || options.deadline < 0)
  ) {
    throw contextError(
      "INVALID_EXECUTION_OPTIONS",
      ["deadline"],
      "deadline must be a non-negative finite UTC epoch time.",
    );
  }
  const random =
    options.seed !== undefined
      ? createSeededRandom(options.seed)
      : options.random !== undefined
        ? createRandomSource(options.random)
        : createDefaultRandomSource();
  return {
    random,
    maxDepth,
    signal: options.signal,
    deadline: options.deadline,
  };
}

function assertExecutionActive(
  state: ExecutionState,
  path: ValidationPath,
): void {
  if (state.signal?.aborted) {
    throw new ConstructaError({
      kind: "execution",
      code: "EXECUTION_ABORTED",
      path,
      message: "Generator execution was aborted.",
    });
  }
  if (state.deadline !== undefined && Date.now() >= state.deadline) {
    throw new ConstructaError({
      kind: "execution",
      code: "EXECUTION_DEADLINE_EXCEEDED",
      path,
      message: "Generator execution exceeded its deadline.",
    });
  }
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

function analyzeValueDependencies(
  implementation: GeneratorImplementation<GeneratorDefinition, unknown>,
  definition: GeneratorDefinition,
  path: ValidationPath,
): readonly ValueDependency[] {
  if (implementation.analyzeValueDependencies === undefined) return [];
  let dependencies: readonly ValueDependency[];
  try {
    dependencies = implementation.analyzeValueDependencies(definition);
  } catch (cause) {
    throw normalizeConstructaError(cause, {
      kind: "dependency",
      code: "DEPENDENCY_ANALYSIS_FAILED",
      path,
      message: "Value dependency analysis failed.",
    });
  }
  if (!Array.isArray(dependencies) || !dependencies.every(isValueDependency)) {
    throw new ConstructaError({
      kind: "system",
      code: "DEPENDENCY_ANALYSIS_FAILED",
      path,
      message: "Value dependency analysis returned an invalid result.",
    });
  }
  return Object.freeze(
    dependencies.map((dependency) =>
      Object.freeze({ path: Object.freeze([...dependency.path]) }),
    ),
  );
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

function isValueDependency(value: unknown): value is ValueDependency {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as ValueDependency).path) &&
    (value as ValueDependency).path.length > 0 &&
    (value as ValueDependency).path.every(
      (segment) => typeof segment === "string" && segment.length > 0,
    )
  );
}

function isCompositeDependencyNode(
  value: unknown,
): value is CompositeDependencyNode {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as CompositeDependencyNode).fieldPath) &&
    (value as CompositeDependencyNode).fieldPath.length === 1 &&
    typeof (value as CompositeDependencyNode).fieldPath[0] === "string" &&
    Array.isArray((value as CompositeDependencyNode).dependencies) &&
    (value as CompositeDependencyNode).dependencies.every(isValueDependency)
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
  maxBytes: 1_000_000,
  maxObjectFields: 10_000,
  maxArrayLength: 10_000,
  maxTemplateLength: 100_000,
  maxTemplateTokens: 10_000,
});

type ResolvedParseLimits = {
  readonly maxDepth: number;
  readonly maxIssues: number;
  readonly maxNodes: number;
  readonly maxBytes: number;
  readonly maxObjectFields: number;
  readonly maxArrayLength: number;
  readonly maxTemplateLength: number;
  readonly maxTemplateTokens: number;
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
  const limitIssue = findInputLimitIssue(value, path, limits);
  if (limitIssue !== undefined) return { success: false, issues: [limitIssue] };

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
    maxBytes: supplied.maxBytes ?? DEFAULT_PARSE_LIMITS.maxBytes,
    maxObjectFields:
      supplied.maxObjectFields ?? DEFAULT_PARSE_LIMITS.maxObjectFields,
    maxArrayLength:
      supplied.maxArrayLength ?? DEFAULT_PARSE_LIMITS.maxArrayLength,
    maxTemplateLength:
      supplied.maxTemplateLength ?? DEFAULT_PARSE_LIMITS.maxTemplateLength,
    maxTemplateTokens:
      supplied.maxTemplateTokens ?? DEFAULT_PARSE_LIMITS.maxTemplateTokens,
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

function findInputLimitIssue(
  value: unknown,
  path: ValidationPath,
  limits: ResolvedParseLimits,
): ConstructaError | undefined {
  const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
  if (bytes > limits.maxBytes) {
    return inputLimitError(
      "PARSE_BYTE_LIMIT",
      path,
      "Definition exceeds the maximum serialized byte size.",
    );
  }
  const visit = (
    candidate: unknown,
    candidatePath: ValidationPath,
  ): ConstructaError | undefined => {
    if (Array.isArray(candidate)) {
      if (candidate.length > limits.maxArrayLength) {
        return inputLimitError(
          "PARSE_ARRAY_LIMIT",
          candidatePath,
          "Definition contains an array exceeding the configured maximum length.",
        );
      }
      for (let index = 0; index < candidate.length; index += 1) {
        const issue = visit(candidate[index], [...candidatePath, index]);
        if (issue !== undefined) return issue;
      }
      return undefined;
    }
    if (typeof candidate !== "object" || candidate === null) return undefined;
    const record = candidate as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length > limits.maxObjectFields) {
      return inputLimitError(
        "PARSE_OBJECT_FIELD_LIMIT",
        candidatePath,
        "Definition contains an object exceeding the configured maximum field count.",
      );
    }
    if (record.type === "template" && typeof record.source === "string") {
      if (record.source.length > limits.maxTemplateLength) {
        return inputLimitError(
          "PARSE_TEMPLATE_LENGTH_LIMIT",
          [...candidatePath, "source"],
          "Template source exceeds the configured maximum length.",
        );
      }
      let tokenCount = 0;
      try {
        tokenCount = parseTemplateTokens(record.source).filter(
          (token) => token.type === "reference",
        ).length;
      } catch (_cause) {
        // The owning template implementation reports malformed syntax.
      }
      if (tokenCount > limits.maxTemplateTokens) {
        return inputLimitError(
          "PARSE_TEMPLATE_TOKEN_LIMIT",
          [...candidatePath, "source"],
          "Template source exceeds the configured maximum reference count.",
        );
      }
    }
    for (const key of keys) {
      const issue = visit(record[key], [...candidatePath, key]);
      if (issue !== undefined) return issue;
    }
    return undefined;
  };
  return visit(value, path);
}

function inputLimitError(
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
    invalid_template_token: "INVALID_TEMPLATE_TOKEN",
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
