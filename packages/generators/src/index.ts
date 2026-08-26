import {
  createCompositeDependencyAnalysis,
  createGeneratorDefinition,
  defineGenerator,
  type GeneratorDefinition,
  type GeneratorImplementation,
  type GeneratorRegistry,
  parseTemplateTokens,
  scheduleCompositeDependencies,
  type ValidationIssue,
} from "constructa-core";
import {
  ConstructaError,
  type JsonValue,
  validateGeneratorDefinition,
  validateJsonValue,
} from "constructa-schema";

/** The largest supported decimal precision. */
export const MAX_DECIMAL_PRECISION = 15;
/** The largest supported generated-string length. */
export const MAX_STRING_LENGTH = 10_000;
/** The largest supported generated-array length. */
export const MAX_ARRAY_LENGTH = 10_000;

/** Semantic catalog information for one built-in generator. */
export type BuiltInGeneratorCatalogEntry = {
  readonly typeId: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly outputCategory: string;
  readonly examples: readonly GeneratorDefinition[];
};

const STRING_CHARSETS = {
  alphabetic: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numeric: "0123456789",
  alphanumeric:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  hex: "0123456789abcdef",
} as const;

/** The portable definition produced by `uuid`. */
export type UuidDefinition = GeneratorDefinition<string> & {
  readonly type: "uuid";
};

/** Builds a portable UUID version 4 definition. */
export function uuid(): UuidDefinition {
  return createGeneratorDefinition({ type: "uuid" }) as UuidDefinition;
}

/** The executable implementation for UUID definitions. */
export const uuidGenerator: GeneratorImplementation<UuidDefinition, string> =
  defineGenerator({
    type: "uuid",
    version: 1,
    validateDefinition: validateUuidDefinition,
    generate({ context }) {
      const bytes = context.random.bytes(16);
      bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
      bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
      return formatUuid(bytes);
    },
  });

/** Registers the UUID implementation with a registry. */
export function registerUuidGenerator(registry: GeneratorRegistry): void {
  registry.register(uuidGenerator);
}

/** The named child definitions of an object generator. */
export type ObjectFields = Readonly<Record<string, GeneratorDefinition>>;
/** The inferred output of an object generator's child definitions. */
export type ObjectOutput<Fields extends ObjectFields> = {
  [Key in keyof Fields]: InferGenerator<Fields[Key]>;
};
/** The portable definition produced by `object`. */
export type ObjectDefinition<Fields extends ObjectFields = ObjectFields> =
  GeneratorDefinition<ObjectOutput<Fields>> & {
    readonly type: "object";
    readonly fields: Fields;
  };

type InferGenerator<Definition> =
  Definition extends GeneratorDefinition<infer Output> ? Output : never;

/** Builds a composite object definition from named child definitions. */
export function object<const Fields extends ObjectFields>(
  fields: Fields,
): ObjectDefinition<Fields>;
export function object(fields: unknown): ObjectDefinition {
  const issues = validateObjectDefinition({ type: "object", fields });
  assertValidGeneratorOptions(issues);
  return createGeneratorDefinition({
    type: "object",
    fields: fields as ObjectFields,
  }) as ObjectDefinition;
}

/** The executable implementation for object definitions. */
export const objectGenerator: GeneratorImplementation<
  ObjectDefinition,
  Record<string, unknown>
> = defineGenerator({
  type: "object",
  version: 1,
  validateDefinition: validateObjectDefinition,
  generate({ definition, context }) {
    const fields = Object.entries(definition.fields);
    const children = new Map(fields);
    const completed = new Map<string, unknown>();
    const dependencies = createCompositeDependencyAnalysis(
      fields.map(([key, child]) => ({
        fieldPath: [key] as const,
        dependencies: context.analyzeChildValueDependencies(child, key),
      })),
    );
    const scope = context.createObjectScope();
    for (const key of scheduleCompositeDependencies(dependencies, {
      referencePaths: collectObjectReferencePaths(definition.fields),
    })) {
      const child = children.get(key);
      if (child === undefined) continue;
      completed.set(key, scope.executeChild(child, key));
    }
    const result: Record<string, unknown> = {};
    for (const [key] of fields) {
      Object.defineProperty(result, key, {
        value: completed.get(key),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return result;
  },
});

/** Registers the object implementation with a registry. */
export function registerObjectGenerator(registry: GeneratorRegistry): void {
  registry.register(objectGenerator);
}

/** The portable definition produced by `template`. */
export type TemplateDefinition = GeneratorDefinition<string> & {
  readonly type: "template";
  readonly source: string;
};

/** Builds a string template with object-local `{field}` references. */
export function template(source: string): TemplateDefinition;
export function template(source: unknown): TemplateDefinition {
  const issues = validateTemplateDefinition({ type: "template", source });
  assertValidGeneratorOptions(issues);
  return createGeneratorDefinition({
    type: "template",
    source: source as string,
  }) as TemplateDefinition;
}

/** The executable implementation for template definitions. */
export const templateGenerator: GeneratorImplementation<
  TemplateDefinition,
  string
> = defineGenerator({
  type: "template",
  version: 1,
  validateDefinition: validateTemplateDefinition,
  analyzeValueDependencies({ source }) {
    return parseTemplateTokens(source, { path: ["source"] })
      .filter((token) => token.type === "reference")
      .map((token) => ({ path: token.path }));
  },
  generate({ definition, context }) {
    return parseTemplateTokens(definition.source, { path: ["source"] })
      .map((token) => {
        if (token.type === "literal") return token.value;
        return stringifyTemplateValue(
          context.references.resolve(token.path),
          context.path,
        );
      })
      .join("");
  },
});

/** Registers the template implementation with a registry. */
export function registerTemplateGenerator(registry: GeneratorRegistry): void {
  registry.register(templateGenerator);
}

/** Options for building a fixed-length array definition. */
export type ArrayOptions = {
  readonly length: number;
};
/** The portable definition produced by `array`. */
export type ArrayDefinition<
  Item extends GeneratorDefinition = GeneratorDefinition,
> = GeneratorDefinition<InferGenerator<Item>[]> & {
  readonly type: "array";
  readonly item: Item;
  readonly length: number;
};

/** Builds a fixed-length composite array definition. */
export function array<const Item extends GeneratorDefinition>(
  item: Item,
  options: ArrayOptions,
): ArrayDefinition<Item>;
export function array(item: unknown, options: unknown): ArrayDefinition {
  const issues = validateArrayDefinition({
    type: "array",
    item,
    ...(isDefinitionRecord(options) ? options : { length: undefined }),
  });
  assertValidGeneratorOptions(issues);
  return createGeneratorDefinition({
    type: "array",
    item: item as GeneratorDefinition,
    length: (options as ArrayOptions).length,
  }) as ArrayDefinition;
}

/** The executable implementation for array definitions. */
export const arrayGenerator: GeneratorImplementation<
  ArrayDefinition,
  unknown[]
> = defineGenerator({
  type: "array",
  version: 1,
  validateDefinition: validateArrayDefinition,
  generate({ definition, context }) {
    const result: unknown[] = [];
    for (let index = 0; index < definition.length; index += 1) {
      result.push(context.executeChild(definition.item, index));
    }
    return result;
  },
});

/** Registers the array implementation with a registry. */
export function registerArrayGenerator(registry: GeneratorRegistry): void {
  registry.register(arrayGenerator);
}

/** The portable definition produced by `choice`. */
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

/** The executable implementation for choice definitions. */
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

/** Registers the choice implementation with a registry. */
export function registerChoiceGenerator(registry: GeneratorRegistry): void {
  registry.register(choiceGenerator);
}

/** Options for building a bounded decimal definition. */
export type DecimalOptions = {
  readonly min: number;
  readonly max: number;
  readonly precision: number;
};

/** The portable definition produced by `decimal`. */
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

/** The executable implementation for decimal definitions. */
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

/** Registers the decimal implementation with a registry. */
export function registerDecimalGenerator(registry: GeneratorRegistry): void {
  registry.register(decimalGenerator);
}

/** A predefined charset name or a non-empty custom character set. */
export type StringCharset = keyof typeof STRING_CHARSETS | string;
/** Options for building a random string definition. */
export type StringOptions = {
  readonly length: number;
  readonly charset?: StringCharset;
};

/** The portable definition produced by `string`. */
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

/** The executable implementation for string definitions. */
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

/** Registers the string implementation with a registry. */
export function registerStringGenerator(registry: GeneratorRegistry): void {
  registry.register(stringGenerator);
}

/** Options for building an inclusive ISO calendar-date definition. */
export type DateOptions = {
  readonly min: string;
  readonly max: string;
};

/** The portable definition produced by `date`. */
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

/** The executable implementation for date definitions. */
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

/** Registers the date implementation with a registry. */
export function registerDateGenerator(registry: GeneratorRegistry): void {
  registry.register(dateGenerator);
}

/** Options for building an inclusive integer definition. */
export type IntegerOptions = {
  readonly min: number;
  readonly max: number;
};

/** The portable definition produced by `boolean`. */
export type BooleanDefinition = GeneratorDefinition<boolean> & {
  readonly type: "boolean";
};

/** Builds a portable, evenly distributed boolean definition. */
export function boolean(): BooleanDefinition {
  return createGeneratorDefinition({ type: "boolean" }) as BooleanDefinition;
}

/** Trusted implementation for the portable `boolean` definition. */
/** The executable implementation for boolean definitions. */
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
/** Registers the boolean implementation with a registry. */
export function registerBooleanGenerator(registry: GeneratorRegistry): void {
  registry.register(booleanGenerator);
}

/** The portable definition produced by `integer`. */
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
/** The executable implementation for integer definitions. */
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
/** Registers the integer implementation with a registry. */
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

function validateUuidDefinition(value: unknown): readonly ValidationIssue[] {
  return validateExactDefinitionKeys(value, "uuid", []);
}

function validateObjectDefinition(value: unknown): readonly ValidationIssue[] {
  const keyIssues = validateExactDefinitionKeys(value, "object", ["fields"]);
  if (keyIssues.length > 0) return keyIssues;

  const fields = (value as { readonly fields?: unknown }).fields;
  if (!isDefinitionRecord(fields)) {
    return [invalidConfiguration(["fields"], "fields must be an object")];
  }

  const issues: ValidationIssue[] = [];
  for (const [key, child] of Object.entries(fields)) {
    for (const issue of validateGeneratorDefinition(child)) {
      issues.push({ ...issue, path: ["fields", key, ...issue.path] });
    }
  }
  return issues;
}

function validateTemplateDefinition(
  value: unknown,
): readonly ValidationIssue[] {
  const keyIssues = validateExactDefinitionKeys(value, "template", ["source"]);
  if (keyIssues.length > 0) return keyIssues;
  const source = (value as { readonly source?: unknown }).source;
  if (typeof source !== "string") {
    return [invalidConfiguration(["source"], "source must be a string")];
  }
  try {
    parseTemplateTokens(source, { path: ["source"] });
  } catch (cause) {
    if (cause instanceof ConstructaError) {
      return [
        {
          code: "invalid_template_token",
          path: cause.path,
          message: cause.message,
        },
      ];
    }
    throw cause;
  }
  return [];
}

function collectObjectReferencePaths(
  fields: ObjectFields,
): readonly string[][] {
  const paths: string[][] = [];
  const visit = (definitions: ObjectFields, prefix: readonly string[]) => {
    for (const [key, definition] of Object.entries(definitions)) {
      const path = [...prefix, key];
      paths.push(path);
      const nestedFields = (definition as { readonly fields?: unknown }).fields;
      if (definition.type === "object" && isDefinitionRecord(nestedFields)) {
        visit(nestedFields as ObjectFields, path);
      }
    }
  };
  visit(fields, []);
  return paths;
}

function validateArrayDefinition(value: unknown): readonly ValidationIssue[] {
  const keyIssues = validateExactDefinitionKeys(value, "array", [
    "item",
    "length",
  ]);
  if (keyIssues.length > 0) return keyIssues;

  const definition = value as {
    readonly item?: unknown;
    readonly length?: unknown;
  };
  const issues: ValidationIssue[] = [];
  for (const issue of validateGeneratorDefinition(definition.item)) {
    issues.push({ ...issue, path: ["item", ...issue.path] });
  }
  if (
    !Number.isSafeInteger(definition.length) ||
    (definition.length as number) < 0 ||
    (definition.length as number) > MAX_ARRAY_LENGTH
  ) {
    issues.push(
      invalidLength(
        ["length"],
        `length must be an integer from 0 to ${MAX_ARRAY_LENGTH}`,
      ),
    );
  }
  return issues;
}

function validateExactDefinitionKeys(
  value: unknown,
  type: string,
  keys: readonly string[],
): readonly ValidationIssue[] {
  if (!isDefinitionRecord(value)) {
    return [invalidConfiguration([], `${type} definition must be an object`)];
  }
  const definition = value as { readonly type?: unknown };
  if (definition.type !== type) {
    return [invalidConfiguration(["type"], `type must be ${type}`)];
  }
  const allowed = new Set(["type", ...keys]);
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) =>
      invalidConfiguration([key], `Unknown ${type} property: ${key}`),
    );
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
    invalid_template_token: "INVALID_TEMPLATE_TOKEN",
  };
  throw new ConstructaError({
    kind: "configuration",
    code: codes[issue.code] ?? "INVALID_CONFIGURATION",
    path: issue.path,
    message: issue.message,
    details: { issueCode: issue.code },
  });
}

function stringifyTemplateValue(
  value: unknown,
  path: readonly (string | number)[],
): string {
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return String(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new ConstructaError({
    kind: "dependency",
    code: "NON_SCALAR_REFERENCE",
    path,
    message: "Template references must resolve to a scalar value.",
  });
}

function isDefinitionRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveCharset(charset: string): string {
  return STRING_CHARSETS[charset as keyof typeof STRING_CHARSETS] ?? charset;
}

function formatUuid(bytes: Uint8Array): string {
  const hexadecimal = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  );
  return `${hexadecimal.slice(0, 4).join("")}-${hexadecimal.slice(4, 6).join("")}-${hexadecimal.slice(6, 8).join("")}-${hexadecimal.slice(8, 10).join("")}-${hexadecimal.slice(10, 16).join("")}`;
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

/**
 * Portable semantic metadata for the built-in catalog. UI controls and icons
 * intentionally remain owned by application-level registries.
 */
export const BUILT_IN_GENERATOR_CATALOG: readonly BuiltInGeneratorCatalogEntry[] =
  Object.freeze([
    {
      typeId: "array",
      displayName: "Array",
      description: "Generates a fixed-length array from one child generator.",
      category: "composition",
      tags: ["list", "collection", "repeated"] as const,
      outputCategory: "array",
      examples: [array(integer({ min: 1, max: 3 }), { length: 3 })],
    },
    {
      typeId: "boolean",
      displayName: "Boolean",
      description: "Generates true or false with equal probability.",
      category: "primitive",
      tags: ["true", "false", "flag"] as const,
      outputCategory: "boolean",
      examples: [boolean()],
    },
    {
      typeId: "choice",
      displayName: "Choice",
      description: "Selects one value from a non-empty list of JSON values.",
      category: "primitive",
      tags: ["enum", "selection", "literal"] as const,
      outputCategory: "json",
      examples: [choice(["small", "medium", "large"])],
    },
    {
      typeId: "date",
      displayName: "Date",
      description: "Generates an inclusive ISO calendar date within a range.",
      category: "primitive",
      tags: ["calendar", "iso-date", "time"] as const,
      outputCategory: "string",
      examples: [date({ min: "2026-01-01", max: "2026-12-31" })],
    },
    {
      typeId: "decimal",
      displayName: "Decimal",
      description: "Generates a bounded decimal number at a chosen precision.",
      category: "numeric",
      tags: ["number", "fraction", "precision"] as const,
      outputCategory: "number",
      examples: [decimal({ min: 0, max: 100, precision: 2 })],
    },
    {
      typeId: "integer",
      displayName: "Integer",
      description: "Generates an inclusive whole number within a range.",
      category: "numeric",
      tags: ["number", "whole-number", "range"] as const,
      outputCategory: "number",
      examples: [integer({ min: 1, max: 100 })],
    },
    {
      typeId: "object",
      displayName: "Object",
      description: "Generates an object from named child generators.",
      category: "composition",
      tags: ["record", "fields", "composite"] as const,
      outputCategory: "object",
      examples: [
        object({ active: boolean(), score: integer({ min: 0, max: 10 }) }),
      ],
    },
    {
      typeId: "string",
      displayName: "String",
      description:
        "Generates a string from a predefined or custom character set.",
      category: "primitive",
      tags: ["text", "characters", "charset"] as const,
      outputCategory: "string",
      examples: [string({ length: 12, charset: "alphanumeric" })],
    },
    {
      typeId: "template",
      displayName: "Template",
      description:
        "Builds text from literal content and object-local references.",
      category: "composition",
      tags: ["interpolation", "references", "text"] as const,
      outputCategory: "string",
      examples: [template("Hello {{world}}")],
    },
    {
      typeId: "uuid",
      displayName: "UUID",
      description: "Generates an RFC 4122 version 4 UUID.",
      category: "primitive",
      tags: ["identifier", "v4", "random"] as const,
      outputCategory: "string",
      examples: [uuid()],
    },
  ] satisfies readonly BuiltInGeneratorCatalogEntry[]);
