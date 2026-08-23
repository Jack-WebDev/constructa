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

export type RandomSource = {
  next(): number;
};

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

function isStableTypeId(value: string): boolean {
  return /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value);
}
