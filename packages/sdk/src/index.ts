/**
 * The supported developer-facing Constructa API.
 *
 * Factories and low-level infrastructure remain available for advanced use,
 * while `createEngine` provides a ready-to-use built-in registry.
 */
import {
  createExecutor,
  createRandomSource,
  createRegistry,
  type ExecutionOptions,
  type GeneratorDefinition,
  type GeneratorRegistry,
  type GeneratorRegistrySnapshot,
  type ParseLimits,
  parseDefinition,
  type RandomSource,
} from "constructa-core";
import {
  registerArrayGenerator,
  registerBooleanGenerator,
  registerChoiceGenerator,
  registerDateGenerator,
  registerDecimalGenerator,
  registerIntegerGenerator,
  registerObjectGenerator,
  registerStringGenerator,
  registerTemplateGenerator,
  registerUuidGenerator,
} from "constructa-generators";
import { ConstructaError, type ConstructaErrorCode } from "constructa-schema";

export * from "constructa-core";
export * from "constructa-generators";
export { serializeDefinition, serializeDocument } from "constructa-schema";

/** Options for an advanced SDK engine instance. */
export type CreateEngineOptions = {
  /**
   * Replaces the SDK's built-in registry. Supply a custom registry only when
   * registering trusted custom generator implementations.
   */
  readonly registry?: GeneratorRegistry | GeneratorRegistrySnapshot;
  /** Default random source for executions that do not supply `seed` or `random`. */
  readonly random?: RandomSource;
  /** Limits applied when definitions are validated before execution. */
  readonly limits?: ParseLimits;
};

/** An isolated, ready-to-use Constructa execution engine. */
export type Engine = {
  generate: <Definition extends GeneratorDefinition>(
    definition: Definition,
    options?: ExecutionOptions,
  ) => import("constructa-schema").Infer<Definition>;
};

const ENGINE_ERROR_CODES = {
  invalidOptions: "INVALID_ENGINE_OPTIONS",
  invalidParseLimits: "INVALID_PARSE_LIMITS",
} as const satisfies Record<string, ConstructaErrorCode>;

type EngineErrorCode =
  (typeof ENGINE_ERROR_CODES)[keyof typeof ENGINE_ERROR_CODES];

const defaultEngine = createEngine();

/** Generates one value through the isolated SDK built-in engine. */
export function generate<Definition extends GeneratorDefinition>(
  definition: Definition,
  options?: ExecutionOptions,
): import("constructa-schema").Infer<Definition> {
  return defaultEngine.generate(definition, options);
}

/**
 * Creates an isolated engine with all built-in generators registered.
 *
 * Supplying `registry` replaces the built-in registry entirely. The supplied
 * registry is snapshotted during construction, so subsequent registry changes
 * cannot affect this engine.
 */
export function createEngine(options?: CreateEngineOptions): Engine {
  assertEngineOptions(options);

  const registry = snapshotRegistry(
    options?.registry ?? createBuiltInRegistry(),
  );
  const executor = createExecutor(registry);
  const defaultRandom =
    options?.random === undefined
      ? undefined
      : createRandomSource(options.random);
  const limits = options?.limits;

  return Object.freeze({
    generate<Definition extends GeneratorDefinition>(
      definition: Definition,
      executionOptions?: ExecutionOptions,
    ): import("constructa-schema").Infer<Definition> {
      const parsed = parseDefinition(definition, { registry, limits });
      return executor.generate(
        parsed as unknown as Definition,
        withEngineRandom(executionOptions, defaultRandom),
      );
    },
  });
}

function createBuiltInRegistry(): GeneratorRegistry {
  const registry = createRegistry();
  registerArrayGenerator(registry);
  registerBooleanGenerator(registry);
  registerChoiceGenerator(registry);
  registerDateGenerator(registry);
  registerDecimalGenerator(registry);
  registerIntegerGenerator(registry);
  registerObjectGenerator(registry);
  registerStringGenerator(registry);
  registerTemplateGenerator(registry);
  registerUuidGenerator(registry);
  return registry;
}

function snapshotRegistry(
  registry: GeneratorRegistry | GeneratorRegistrySnapshot,
): GeneratorRegistrySnapshot {
  if (
    typeof registry === "object" &&
    registry !== null &&
    typeof (registry as GeneratorRegistry).snapshot === "function"
  ) {
    return (registry as GeneratorRegistry).snapshot();
  }
  return registry as GeneratorRegistrySnapshot;
}

function withEngineRandom(
  options: ExecutionOptions | undefined,
  defaultRandom: RandomSource | undefined,
): ExecutionOptions | undefined {
  if (
    defaultRandom === undefined ||
    options?.seed !== undefined ||
    options?.random !== undefined
  ) {
    return options;
  }
  return { ...options, random: defaultRandom };
}

function assertEngineOptions(options: CreateEngineOptions | undefined): void {
  if (options === undefined) return;
  if (
    typeof options !== "object" ||
    options === null ||
    Array.isArray(options)
  ) {
    throw engineConfigurationError(
      ENGINE_ERROR_CODES.invalidOptions,
      [],
      "Engine options must be an object.",
    );
  }
  if (options.limits !== undefined) assertParseLimits(options.limits);
}

function assertParseLimits(limits: ParseLimits): void {
  if (typeof limits !== "object" || limits === null || Array.isArray(limits)) {
    throw engineConfigurationError(
      ENGINE_ERROR_CODES.invalidParseLimits,
      ["limits"],
      "limits must be an object.",
    );
  }
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw engineConfigurationError(
        ENGINE_ERROR_CODES.invalidParseLimits,
        ["limits", name],
        `${name} must be a positive safe integer.`,
      );
    }
  }
}

function engineConfigurationError(
  code: EngineErrorCode,
  path: readonly (string | number)[],
  message: string,
): ConstructaError {
  return new ConstructaError({
    kind: "configuration",
    code,
    path,
    message,
  });
}
