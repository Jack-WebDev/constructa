import {
  assertGeneratorDefinition,
  ConstructaError,
  type GeneratorDefinition,
  normalizeConstructaError,
  type ValidationIssue,
  type ValidationPath,
} from "constructa-schema";

export type {
  GeneratorDefinition,
  Infer,
  ValidationIssue,
  ValidationPath,
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

export type Seed = number | string;

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

  return Object.freeze({
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
  readonly generateChild: <Output>(
    definition: GeneratorDefinition<Output>,
  ) => Output;
};

export type GeneratorDependency = {
  readonly typeId: string;
  readonly path: ValidationPath;
};

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
        code: "INVALID_CONFIGURATION",
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
