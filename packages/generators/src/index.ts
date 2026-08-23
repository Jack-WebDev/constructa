import {
  createGeneratorDefinition,
  defineGenerator,
  type GeneratorDefinition,
  type GeneratorImplementation,
  type GeneratorRegistry,
  type ValidationIssue,
} from "constructa-core";
import { ConstructaError } from "constructa-schema";

export type IntegerOptions = {
  readonly min: number;
  readonly max: number;
};

export type IntegerDefinition = GeneratorDefinition<number> & {
  readonly type: "integer";
  readonly min: number;
  readonly max: number;
};

/** Builds a portable integer definition with inclusive minimum and maximum bounds. */
export function integer(options: IntegerOptions): IntegerDefinition;
export function integer(options: unknown): IntegerDefinition {
  const issues = validateIntegerDefinition(options);
  const issue = issues[0];
  if (issue !== undefined) {
    throw new ConstructaError({
      kind: "configuration",
      code: "INVALID_RANGE",
      path: issue.path,
      message: issue.message,
      details: { issueCode: issue.code },
    });
  }
  const definition = options as IntegerOptions;
  return createGeneratorDefinition({
    type: "integer",
    min: definition.min,
    max: definition.max,
  }) as IntegerDefinition;
}

/** Trusted implementation for the portable `integer` definition. */
export const integerGenerator: GeneratorImplementation<
  IntegerDefinition,
  number
> = defineGenerator({
  type: "integer",
  version: 1,
  validateDefinition: validateIntegerDefinition,
  generate({ definition, context }) {
    const rangeSize = definition.max - definition.min + 1;
    return definition.min + context.random.integer(rangeSize);
  },
});

/** Registers the integer built-in with an advanced custom registry. */
export function registerIntegerGenerator(registry: GeneratorRegistry): void {
  registry.register(integerGenerator);
}

function validateIntegerDefinition(value: unknown): readonly ValidationIssue[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [invalidRange([], "integer definition must be an object")];
  }

  const definition = value as {
    readonly min?: unknown;
    readonly max?: unknown;
  };
  const issues: ValidationIssue[] = [];
  if (!Number.isSafeInteger(definition.min)) {
    issues.push(invalidRange(["min"], "min must be a safe integer"));
  }
  if (!Number.isSafeInteger(definition.max)) {
    issues.push(invalidRange(["max"], "max must be a safe integer"));
  }
  if (issues.length > 0) return issues;

  const min = definition.min as number;
  const max = definition.max as number;
  if (min > max) {
    return [invalidRange(["min"], "min must be less than or equal to max")];
  }
  if (!Number.isSafeInteger(max - min + 1)) {
    return [
      invalidRange(
        ["max"],
        "the inclusive integer range must fit within a safe integer",
      ),
    ];
  }
  return [];
}

function invalidRange(
  path: readonly (string | number)[],
  message: string,
): ValidationIssue {
  return { code: "invalid_range", path, message };
}
