import {
  createGeneratorDefinition,
  defineGenerator,
  type GeneratorDefinition,
  type GeneratorImplementation,
  type GeneratorRegistry,
  type ValidationIssue,
} from "constructa-core";
import {
  ConstructaError,
  type JsonValue,
  validateJsonValue,
} from "constructa-schema";

export const MAX_DECIMAL_PRECISION = 15;
export const MAX_STRING_LENGTH = 10_000;

const STRING_CHARSETS = {
  alphabetic: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numeric: "0123456789",
  alphanumeric:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  hex: "0123456789abcdef",
} as const;

export type ChoiceDefinition<Value extends JsonValue = JsonValue> =
  GeneratorDefinition<Value> & {
    readonly type: "choice";
    readonly values: readonly Value[];
  };

/** Builds a portable choice definition while preserving array-literal unions. */
export function choice<const Values extends readonly JsonValue[]>(
  values: Values,
): ChoiceDefinition<Values[number]> {
  const issues = validateChoiceDefinition({ type: "choice", values });
  assertValidGeneratorOptions(issues);
  return createGeneratorDefinition({
    type: "choice",
    values,
  }) as ChoiceDefinition<Values[number]>;
}

export const choiceGenerator: GeneratorImplementation<
  ChoiceDefinition,
  JsonValue
> = defineGenerator({
  type: "choice",
  version: 1,
  validateDefinition: validateChoiceDefinition,
  generate({ definition, context }) {
    return definition.values[
      context.random.integer(definition.values.length)
    ] as JsonValue;
  },
});

export function registerChoiceGenerator(registry: GeneratorRegistry): void {
  registry.register(choiceGenerator);
}

export type DecimalOptions = {
  readonly min: number;
  readonly max: number;
  readonly precision: number;
};

export type DecimalDefinition = GeneratorDefinition<number> & {
  readonly type: "decimal";
  readonly min: number;
  readonly max: number;
  readonly precision: number;
};

/** Builds a finite JavaScript-number decimal definition. Precision is at most 15. */
export function decimal(options: DecimalOptions): DecimalDefinition;
export function decimal(options: unknown): DecimalDefinition {
  const issues = validateDecimalDefinition(options);
  assertValidGeneratorOptions(issues);
  const definition = options as DecimalOptions;
  return createGeneratorDefinition({
    type: "decimal",
    ...definition,
  }) as DecimalDefinition;
}

export const decimalGenerator: GeneratorImplementation<
  DecimalDefinition,
  number
> = defineGenerator({
  type: "decimal",
  version: 1,
  validateDefinition: validateDecimalDefinition,
  generate({ definition, context }) {
    const value =
      definition.min +
      context.random.float() * (definition.max - definition.min);
    return Number(value.toFixed(definition.precision));
  },
});

export function registerDecimalGenerator(registry: GeneratorRegistry): void {
  registry.register(decimalGenerator);
}

export type StringCharset = keyof typeof STRING_CHARSETS | string;
export type StringOptions = {
  readonly length: number;
  readonly charset?: StringCharset;
};

export type StringDefinition = GeneratorDefinition<string> & {
  readonly type: "string";
  readonly length: number;
  readonly charset: string;
};

/** Builds a random-character string definition. The default charset is alphanumeric. */
export function string(options: StringOptions): StringDefinition;
export function string(options: unknown): StringDefinition {
  const normalized = normalizeStringOptions(options);
  const issues = validateStringDefinition(normalized);
  assertValidGeneratorOptions(issues);
  const definition = normalized as StringOptions & { readonly charset: string };
  return createGeneratorDefinition({
    type: "string",
    ...definition,
  }) as StringDefinition;
}

export const stringGenerator: GeneratorImplementation<
  StringDefinition,
  string
> = defineGenerator({
  type: "string",
  version: 1,
  validateDefinition: validateStringDefinition,
  generate({ definition, context }) {
    const characters = Array.from(resolveCharset(definition.charset));
    let result = "";
    for (let index = 0; index < definition.length; index += 1) {
      result += characters[context.random.integer(characters.length)];
    }
    return result;
  },
});

export function registerStringGenerator(registry: GeneratorRegistry): void {
  registry.register(stringGenerator);
}

export type DateOptions = {
  readonly min: string;
  readonly max: string;
};

export type DateDefinition = GeneratorDefinition<string> & {
  readonly type: "date";
  readonly min: string;
  readonly max: string;
};

/** Builds an inclusive timezone-independent ISO calendar-date definition. */
export function date(options: DateOptions): DateDefinition;
export function date(options: unknown): DateDefinition {
  const issues = validateDateDefinition(options);
  assertValidGeneratorOptions(issues);
  const definition = options as DateOptions;
  return createGeneratorDefinition({
    type: "date",
    ...definition,
  }) as DateDefinition;
}

export const dateGenerator: GeneratorImplementation<DateDefinition, string> =
  defineGenerator({
    type: "date",
    version: 1,
    validateDefinition: validateDateDefinition,
    generate({ definition, context }) {
      const minimum = isoDateToDay(definition.min);
      const maximum = isoDateToDay(definition.max);
      return dayToIsoDate(
        minimum + context.random.integer(maximum - minimum + 1),
      );
    },
  });

export function registerDateGenerator(registry: GeneratorRegistry): void {
  registry.register(dateGenerator);
}

export type IntegerOptions = {
  readonly min: number;
  readonly max: number;
};

export type BooleanDefinition = GeneratorDefinition<boolean> & {
  readonly type: "boolean";
};

/** Builds a portable, evenly distributed boolean definition. */
export function boolean(): BooleanDefinition {
  return createGeneratorDefinition({ type: "boolean" }) as BooleanDefinition;
}

/** Trusted implementation for the portable `boolean` definition. */
export const booleanGenerator: GeneratorImplementation<
  BooleanDefinition,
  boolean
> = defineGenerator({
  type: "boolean",
  version: 1,
  validateDefinition: validateBooleanDefinition,
  generate({ context }) {
    return context.random.integer(2) === 1;
  },
});

/** Registers the boolean built-in with an advanced custom registry. */
export function registerBooleanGenerator(registry: GeneratorRegistry): void {
  registry.register(booleanGenerator);
}

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

function validateBooleanDefinition(value: unknown): readonly ValidationIssue[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [
      {
        code: "invalid_boolean_definition",
        path: [],
        message: "boolean definition must be an object",
      },
    ];
  }
  return Object.keys(value)
    .filter((key) => key !== "type")
    .map((key) => ({
      code: "unknown_property",
      path: [key],
      message: `Unknown boolean property: ${key}`,
    }));
}

function validateChoiceDefinition(value: unknown): readonly ValidationIssue[] {
  if (!isDefinitionRecord(value) || !Array.isArray(value.values)) {
    return [
      invalidConfiguration([], "choice definition must contain a values array"),
    ];
  }
  if (value.values.length === 0) {
    return [
      {
        code: "empty_choice",
        path: ["values"],
        message: "values must not be empty",
      },
    ];
  }
  const issues: ValidationIssue[] = [];
  for (let index = 0; index < value.values.length; index += 1) {
    for (const issue of validateJsonValue(value.values[index])) {
      issues.push({ ...issue, path: ["values", index, ...issue.path] });
    }
  }
  return issues;
}

function validateDecimalDefinition(value: unknown): readonly ValidationIssue[] {
  if (!isDefinitionRecord(value)) {
    return [invalidRange([], "decimal definition must be an object")];
  }
  const issues: ValidationIssue[] = [];
  if (!Number.isFinite(value.min))
    issues.push(invalidRange(["min"], "min must be finite"));
  if (!Number.isFinite(value.max))
    issues.push(invalidRange(["max"], "max must be finite"));
  if (
    !Number.isSafeInteger(value.precision) ||
    (value.precision as number) < 0 ||
    (value.precision as number) > MAX_DECIMAL_PRECISION
  ) {
    issues.push(
      invalidConfiguration(
        ["precision"],
        `precision must be an integer from 0 to ${MAX_DECIMAL_PRECISION}`,
      ),
    );
  }
  if (issues.length > 0) return issues;
  const min = value.min as number;
  const max = value.max as number;
  if (min > max || !Number.isFinite(max - min)) {
    return [
      invalidRange(
        ["max"],
        "max must be greater than or equal to min within a finite range",
      ),
    ];
  }
  return [];
}

function normalizeStringOptions(value: unknown): unknown {
  if (!isDefinitionRecord(value)) return value;
  return { ...value, charset: value.charset ?? "alphanumeric" };
}

function validateStringDefinition(value: unknown): readonly ValidationIssue[] {
  if (!isDefinitionRecord(value)) {
    return [invalidConfiguration([], "string definition must be an object")];
  }
  const issues: ValidationIssue[] = [];
  if (
    !Number.isSafeInteger(value.length) ||
    (value.length as number) < 0 ||
    (value.length as number) > MAX_STRING_LENGTH
  ) {
    issues.push(
      invalidLength(
        ["length"],
        `length must be an integer from 0 to ${MAX_STRING_LENGTH}`,
      ),
    );
  }
  if (
    typeof value.charset !== "string" ||
    Array.from(resolveCharset(value.charset)).length === 0
  ) {
    issues.push(
      invalidConfiguration(["charset"], "charset must be a non-empty string"),
    );
  }
  return issues;
}

function validateDateDefinition(value: unknown): readonly ValidationIssue[] {
  if (!isDefinitionRecord(value)) {
    return [invalidRange([], "date definition must be an object")];
  }
  const issues: ValidationIssue[] = [];
  if (typeof value.min !== "string" || !isCanonicalIsoDate(value.min)) {
    issues.push(
      invalidRange(["min"], "min must be a canonical ISO calendar date"),
    );
  }
  if (typeof value.max !== "string" || !isCanonicalIsoDate(value.max)) {
    issues.push(
      invalidRange(["max"], "max must be a canonical ISO calendar date"),
    );
  }
  if (issues.length > 0) return issues;
  if (isoDateToDay(value.min as string) > isoDateToDay(value.max as string)) {
    return [invalidRange(["min"], "min must be on or before max")];
  }
  return [];
}

function assertValidGeneratorOptions(issues: readonly ValidationIssue[]): void {
  const issue = issues[0];
  if (issue === undefined) return;
  const codes: Record<string, Uppercase<string>> = {
    empty_choice: "EMPTY_CHOICE",
    invalid_length: "INVALID_LENGTH",
    invalid_range: "INVALID_RANGE",
  };
  throw new ConstructaError({
    kind: "configuration",
    code: codes[issue.code] ?? "INVALID_CONFIGURATION",
    path: issue.path,
    message: issue.message,
    details: { issueCode: issue.code },
  });
}

function isDefinitionRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveCharset(charset: string): string {
  return STRING_CHARSETS[charset as keyof typeof STRING_CHARSETS] ?? charset;
}

function isCanonicalIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const day = isoDateToDay(value);
  return Number.isFinite(day) && dayToIsoDate(day) === value;
}

function isoDateToDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year as number, (month as number) - 1, day as number);
  date.setUTCHours(0, 0, 0, 0);
  return date.getTime() / 86_400_000;
}

function dayToIsoDate(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}

function invalidLength(
  path: readonly (string | number)[],
  message: string,
): ValidationIssue {
  return { code: "invalid_length", path, message };
}

function invalidConfiguration(
  path: readonly (string | number)[],
  message: string,
): ValidationIssue {
  return { code: "invalid_configuration", path, message };
}

function invalidRange(
  path: readonly (string | number)[],
  message: string,
): ValidationIssue {
  return { code: "invalid_range", path, message };
}
