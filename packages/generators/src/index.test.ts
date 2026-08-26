import {
  createExecutor,
  createRegistry,
  defineGenerator,
  type GeneratorDefinition,
  type Infer,
} from "constructa-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  array,
  arrayGenerator,
  type BooleanDefinition,
  BUILT_IN_GENERATOR_CATALOG,
  boolean,
  booleanGenerator,
  choice,
  type DateDefinition,
  type DecimalDefinition,
  date,
  decimal,
  type IntegerDefinition,
  integer,
  integerGenerator,
  object,
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
  type StringDefinition,
  string,
  type TemplateDefinition,
  template,
  templateGenerator,
  type UuidDefinition,
  uuid,
  uuidGenerator,
} from "./index";

describe("built-in generator catalog", () => {
  it("exposes unique semantic metadata with portable examples", () => {
    expect(BUILT_IN_GENERATOR_CATALOG).toHaveLength(10);
    expect(BUILT_IN_GENERATOR_CATALOG.map((entry) => entry.typeId)).toEqual([
      "array",
      "boolean",
      "choice",
      "date",
      "decimal",
      "integer",
      "object",
      "string",
      "template",
      "uuid",
    ]);
    expect(
      new Set(BUILT_IN_GENERATOR_CATALOG.map((entry) => entry.typeId)).size,
    ).toBe(BUILT_IN_GENERATOR_CATALOG.length);

    for (const entry of BUILT_IN_GENERATOR_CATALOG) {
      expect(entry.examples).not.toHaveLength(0);
      expect(new Set(entry.tags).size).toBe(entry.tags.length);
      expect(JSON.parse(JSON.stringify(entry))).toEqual(entry);
    }
  });
});

describe("integer", () => {
  it("creates a portable definition with number output inference", () => {
    const definition = integer({ min: -5, max: 5 });

    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<number>();
    expectTypeOf(definition).toEqualTypeOf<IntegerDefinition>();
    expect(definition).toEqual({ type: "integer", min: -5, max: 5 });
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
  });

  it("generates both inclusive bounds through injected randomness", () => {
    const registry = createRegistry();
    registerIntegerGenerator(registry);
    const executor = createExecutor(registry);
    const definition = integer({ min: -2, max: 2 });

    expect(
      executor.generate(definition, {
        random: {
          float: () => 0,
          integer: () => 0,
          bytes: (length) => new Uint8Array(length),
        },
      }),
    ).toBe(-2);
    expect(
      executor.generate(definition, {
        random: {
          float: () => 0,
          integer: (maxExclusive) => maxExclusive - 1,
          bytes: (length) => new Uint8Array(length),
        },
      }),
    ).toBe(2);
  });

  it("supports an equal inclusive range", () => {
    const registry = createRegistry();
    registry.register(integerGenerator);

    expect(
      createExecutor(registry).generate(integer({ min: 7, max: 7 }), {
        seed: "any",
      }),
    ).toBe(7);
  });

  it.each([
    [{ min: 1.5, max: 2 }, ["min"]],
    [{ min: 1, max: Number.POSITIVE_INFINITY }, ["max"]],
    [{ min: 4, max: 3 }, ["min"]],
    [{ min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }, ["max"]],
  ])("rejects invalid ranges at the exact bound", (options, path) => {
    expect(() => integer(options as never)).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_RANGE",
        path,
      }),
    );
  });

  it("reports parsed invalid ranges with the shared range code", () => {
    const registry = createRegistry();
    registry.register(integerGenerator);

    expect(() =>
      createExecutor(registry).generate(
        { type: "integer", min: 3, max: 2 },
        { seed: 1 },
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_RANGE",
        path: ["min"],
      }),
    );
  });
});

describe("boolean", () => {
  it("creates a portable definition with boolean output inference", () => {
    const definition = boolean();

    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<boolean>();
    expectTypeOf(definition).toEqualTypeOf<BooleanDefinition>();
    expect(definition).toEqual({ type: "boolean" });
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
  });

  it("uses injected random draws for an exactly balanced selection", () => {
    const registry = createRegistry();
    registerBooleanGenerator(registry);
    const executor = createExecutor(registry);
    const integerCalls: number[] = [];
    const random = (value: number) => ({
      float: () => 0,
      integer(maxExclusive: number) {
        integerCalls.push(maxExclusive);
        return value;
      },
      bytes: (length: number) => new Uint8Array(length),
    });

    expect(executor.generate(boolean(), { random: random(0) })).toBe(false);
    expect(executor.generate(boolean(), { random: random(1) })).toBe(true);
    expect(integerCalls).toEqual([2, 2]);
  });

  it("rejects unknown definition properties at their exact path", () => {
    const registry = createRegistry();
    registry.register(booleanGenerator);

    expect(() =>
      createExecutor(registry).generate(
        { type: "boolean", unexpected: true },
        { seed: 1 },
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: ["unexpected"],
      }),
    );
  });
});

describe("choice", () => {
  it("preserves literal unions and selects the first and last values", () => {
    const definition = choice(["admin", "member"]);
    const registry = createRegistry();
    registerChoiceGenerator(registry);
    const executor = createExecutor(registry);
    const random = (index: number) => ({
      float: () => 0,
      integer: () => index,
      bytes: (length: number) => new Uint8Array(length),
    });

    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<
      "admin" | "member"
    >();
    expect(executor.generate(definition, { random: random(0) })).toBe("admin");
    expect(executor.generate(definition, { random: random(1) })).toBe("member");
  });

  it("supports every JSON value and rejects empty or non-portable choices", () => {
    const definition = choice([1, true, null, { role: "admin" }, ["nested"]]);
    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<
      1 | true | null | { readonly role: "admin" } | readonly ["nested"]
    >();
    expect(definition.values).toHaveLength(5);
    expect(() => choice([])).toThrow(
      expect.objectContaining({ code: "EMPTY_CHOICE", path: ["values"] }),
    );
    expect(() => choice([() => "not JSON"] as never)).toThrow(
      expect.objectContaining({
        code: "INVALID_CONFIGURATION",
        path: ["values", 0],
      }),
    );
  });
});

describe("decimal", () => {
  it("rounds finite values to the requested precision", () => {
    const definition = decimal({ min: 1.234, max: 1.234, precision: 2 });
    const registry = createRegistry();
    registerDecimalGenerator(registry);

    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<number>();
    expectTypeOf(definition).toEqualTypeOf<DecimalDefinition>();
    expect(
      createExecutor(registry).generate(definition, {
        random: {
          float: () => 0,
          integer: () => 0,
          bytes: (length) => new Uint8Array(length),
        },
      }),
    ).toBe(1.23);
  });

  it.each([
    [{ min: Number.NaN, max: 1, precision: 2 }, ["min"]],
    [{ min: 2, max: 1, precision: 2 }, ["max"]],
    [{ min: 0, max: 1, precision: 16 }, ["precision"]],
  ])("rejects invalid decimal options", (options, path) => {
    expect(() => decimal(options as never)).toThrow(
      expect.objectContaining({ path }),
    );
  });
});

describe("string", () => {
  it("uses the explicit alphanumeric default and custom character sets", () => {
    const registry = createRegistry();
    registerStringGenerator(registry);
    const executor = createExecutor(registry);
    const defaultDefinition = string({ length: 2 });
    const customDefinition = string({ length: 3, charset: "XY" });
    const random = {
      float: () => 0,
      integer: () => 1,
      bytes: (length: number) => new Uint8Array(length),
    };

    expectTypeOf<Infer<typeof defaultDefinition>>().toEqualTypeOf<string>();
    expectTypeOf(defaultDefinition).toEqualTypeOf<StringDefinition>();
    expect(defaultDefinition.charset).toBe("alphanumeric");
    expect(executor.generate(customDefinition, { random })).toBe("YYY");
  });

  it.each([
    [{ length: -1 }, ["length"]],
    [{ length: 10_001 }, ["length"]],
    [{ length: 1, charset: "" }, ["charset"]],
  ])("rejects invalid string options", (options, path) => {
    expect(() => string(options as never)).toThrow(
      expect.objectContaining({ path }),
    );
  });
});

describe("date", () => {
  it("uses inclusive timezone-independent calendar-day arithmetic", () => {
    const definition = date({ min: "2024-02-28", max: "2024-03-01" });
    const registry = createRegistry();
    registerDateGenerator(registry);
    const executor = createExecutor(registry);
    const random = (value: number) => ({
      float: () => 0,
      integer: () => value,
      bytes: (length: number) => new Uint8Array(length),
    });

    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<string>();
    expectTypeOf(definition).toEqualTypeOf<DateDefinition>();
    expect(executor.generate(definition, { random: random(0) })).toBe(
      "2024-02-28",
    );
    expect(executor.generate(definition, { random: random(2) })).toBe(
      "2024-03-01",
    );
  });

  it.each([
    [{ min: "2024-02-30", max: "2024-03-01" }, ["min"]],
    [{ min: "2024-2-01", max: "2024-03-01" }, ["min"]],
    [{ min: "2024-03-02", max: "2024-03-01" }, ["min"]],
  ])("rejects invalid date ranges", (options, path) => {
    expect(() => date(options as never)).toThrow(
      expect.objectContaining({ code: "INVALID_RANGE", path }),
    );
  });
});

describe("seeded primitive generation", () => {
  it("reproduces choice, decimal, string, and date values for the same seed", () => {
    const registry = createRegistry();
    registerChoiceGenerator(registry);
    registerDecimalGenerator(registry);
    registerStringGenerator(registry);
    registerDateGenerator(registry);
    const executor = createExecutor(registry);
    const definitions = [
      choice(["first", "second", "third"]),
      decimal({ min: -10, max: 10, precision: 3 }),
      string({ length: 12, charset: "hex" }),
      date({ min: "2024-01-01", max: "2024-12-31" }),
    ];

    for (const definition of definitions) {
      expect(executor.generate(definition, { seed: "repeatable" })).toEqual(
        executor.generate(definition, { seed: "repeatable" }),
      );
    }
  });
});

describe("uuid", () => {
  it("maps random bytes into a canonical UUID version 4", () => {
    const registry = createRegistry();
    registerUuidGenerator(registry);
    const bytes = Uint8Array.from({ length: 16 }, (_, index) => index);

    const definition = uuid();
    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<string>();
    expectTypeOf(definition).toEqualTypeOf<UuidDefinition>();
    expect(
      createExecutor(registry).generate(definition, {
        random: {
          float: () => 0,
          integer: () => 0,
          bytes: () => bytes,
        },
      }),
    ).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  it("is deterministic for a seed and rejects unsupported options", () => {
    const registry = createRegistry();
    registry.register(uuidGenerator);
    const executor = createExecutor(registry);

    expect(executor.generate(uuid(), { seed: "fixture" })).toBe(
      executor.generate(uuid(), { seed: "fixture" }),
    );
    expect(() =>
      executor.generate({ type: "uuid", version: 2 }, { seed: 1 }),
    ).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: ["version"],
      }),
    );
  });
});

describe("object", () => {
  it("infers mapped fields and delegates each field with its name as the path", () => {
    const registry = createRegistry();
    registerIntegerGenerator(registry);
    registerChoiceGenerator(registry);
    registerObjectGenerator(registry);
    const definition = object({
      id: integer({ min: 1, max: 1 }),
      role: choice(["admin", "member"]),
    });

    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<{
      readonly id: number;
      readonly role: "admin" | "member";
    }>();
    expect(
      createExecutor(registry).generate(definition, {
        random: {
          float: () => 0,
          integer: () => 0,
          bytes: (length) => new Uint8Array(length),
        },
      }),
    ).toEqual({ id: 1, role: "admin" });
  });

  it("supports recursive nesting and reports nested field paths", () => {
    const registry = createRegistry();
    registerIntegerGenerator(registry);
    registerObjectGenerator(registry);
    const nested = object({
      address: object({ zip: integer({ min: 1, max: 1 }) }),
    });

    expect(createExecutor(registry).generate(nested, { seed: 1 })).toEqual({
      address: { zip: 1 },
    });
    expect(() =>
      createExecutor(registry).generate(
        {
          type: "object",
          fields: {
            address: { type: "object", fields: { zip: { type: "missing" } } },
          },
        },
        { seed: 1 },
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "UNKNOWN_GENERATOR",
        path: ["fields", "address", "fields", "zip", "type"],
      }),
    );
  });

  it("uses the executor depth limit for nested child execution", () => {
    const registry = createRegistry();
    registerIntegerGenerator(registry);
    registerObjectGenerator(registry);
    const definition = object({
      child: object({ value: integer({ min: 1, max: 1 }) }),
    });

    expect(() =>
      createExecutor(registry).generate(definition, { seed: 1, maxDepth: 1 }),
    ).toThrow(
      expect.objectContaining({
        kind: "execution",
        code: "MAX_EXECUTION_DEPTH",
        path: ["child", "value"],
      }),
    );
  });

  it("schedules forward and backward value dependencies equivalently", () => {
    const registry = createRegistry();
    registerChoiceGenerator(registry);
    registerObjectGenerator(registry);
    registry.register(referenceGenerator);
    const executor = createExecutor(registry);

    const forward = object({
      greeting: reference(["name"]),
      name: choice(["Ada"]),
    });
    const backward = object({
      name: choice(["Ada"]),
      greeting: reference(["name"]),
    });

    expect(executor.generate(forward, { seed: "references" })).toEqual({
      greeting: "Ada",
      name: "Ada",
    });
    expect(executor.generate(backward, { seed: "references" })).toEqual({
      name: "Ada",
      greeting: "Ada",
    });
  });

  it("resolves completed nested sibling values", () => {
    const registry = createRegistry();
    registerChoiceGenerator(registry);
    registerObjectGenerator(registry);
    registry.register(referenceGenerator);
    const executor = createExecutor(registry);
    const definition = object({
      city: reference(["address", "city"]),
      address: object({ city: choice(["Cape Town"]) }),
    });

    expect(executor.generate(definition, { seed: 1 })).toEqual({
      city: "Cape Town",
      address: { city: "Cape Town" },
    });
    expect(executor.generate(definition, { seed: 2 })).toEqual({
      city: "Cape Town",
      address: { city: "Cape Town" },
    });
  });

  it("keeps object value scopes isolated between executions", () => {
    const registry = createRegistry();
    registerChoiceGenerator(registry);
    registerObjectGenerator(registry);
    registry.register(referenceGenerator);
    const executor = createExecutor(registry);
    const first = object({
      copy: reference(["value"]),
      value: choice(["first"]),
    });
    const second = object({
      copy: reference(["value"]),
      value: choice(["second"]),
    });

    expect(executor.generate(first, { seed: 1 })).toEqual({
      copy: "first",
      value: "first",
    });
    expect(executor.generate(second, { seed: 1 })).toEqual({
      copy: "second",
      value: "second",
    });
  });
});

describe("template", () => {
  it("creates a portable string definition with exact output inference", () => {
    const definition = template("Hello {name}");

    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<string>();
    expectTypeOf(definition).toEqualTypeOf<TemplateDefinition>();
    expect(definition).toEqual({ type: "template", source: "Hello {name}" });
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
  });

  it("interpolates scalar sibling values and reuses completed values", () => {
    const registry = createRegistry();
    registerChoiceGenerator(registry);
    registerObjectGenerator(registry);
    registerTemplateGenerator(registry);
    const definition = object({
      greeting: template(
        "{name}, {name}! active={active}; score={score}; none={none}",
      ),
      name: choice(["Ada"]),
      active: choice([true]),
      score: choice([12.5]),
      none: choice([null]),
    });

    expect(createExecutor(registry).generate(definition, { seed: 1 })).toEqual({
      greeting: "Ada, Ada! active=true; score=12.5; none=null",
      name: "Ada",
      active: true,
      score: 12.5,
      none: null,
    });
  });

  it("interpolates nested sibling values and literal braces", () => {
    const registry = createRegistry();
    registerChoiceGenerator(registry);
    registerObjectGenerator(registry);
    registry.register(templateGenerator);
    const definition = object({
      label: template("{{{address.city}}}"),
      address: object({ city: choice(["Cape Town"]) }),
    });

    expect(createExecutor(registry).generate(definition, { seed: 1 })).toEqual({
      label: "{Cape Town}",
      address: { city: "Cape Town" },
    });
  });

  it("rejects malformed syntax and expression-like references before execution", () => {
    expect(() => template("{name.toLowerCase()}" as never)).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_TEMPLATE_TOKEN",
        path: ["source"],
      }),
    );

    const registry = createRegistry();
    registry.register(templateGenerator);
    expect(() =>
      createExecutor(registry).generate(
        { type: "template", source: "{name|lower}" },
        { seed: 1 },
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_TEMPLATE_TOKEN",
        path: ["source"],
      }),
    );
  });

  it("rejects object and array values instead of coercing them", () => {
    const registry = createRegistry();
    registerChoiceGenerator(registry);
    registerObjectGenerator(registry);
    registerTemplateGenerator(registry);
    const definition = object({
      objectText: template("{address}"),
      address: object({ city: choice(["Cape Town"]) }),
      arrayText: template("{tags}"),
      tags: array(choice(["admin"]), { length: 1 }),
    });
    registerArrayGenerator(registry);

    expect(() =>
      createExecutor(registry).generate(definition, { seed: 1 }),
    ).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "NON_SCALAR_REFERENCE",
        path: ["objectText"],
      }),
    );
  });

  it("reports missing root and nested references before generating fields", () => {
    const registry = createRegistry();
    registerChoiceGenerator(registry);
    registerObjectGenerator(registry);
    registerTemplateGenerator(registry);
    const executor = createExecutor(registry);

    expect(() =>
      executor.generate(
        object({ label: template("{surname}"), name: choice(["Ada"]) }),
        { seed: 1 },
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "REFERENCE_NOT_FOUND",
        path: ["label"],
        details: { referencePath: ["surname"] },
      }),
    );
    expect(() =>
      executor.generate(
        object({
          label: template("{address.postcode}"),
          address: object({ city: choice(["Cape Town"]) }),
        }),
        { seed: 1 },
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "REFERENCE_NOT_FOUND",
        path: ["label"],
        details: { referencePath: ["address", "postcode"] },
      }),
    );
  });

  it("reports deterministic self and multi-field reference cycles", () => {
    const registry = createRegistry();
    registerObjectGenerator(registry);
    registerTemplateGenerator(registry);
    const executor = createExecutor(registry);

    expect(() =>
      executor.generate(object({ a: template("{a}") }), { seed: 1 }),
    ).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "CIRCULAR_REFERENCE",
        path: ["a"],
        details: { fields: ["a", "a"] },
      }),
    );
    expect(() =>
      executor.generate(object({ a: template("{b}"), b: template("{a}") }), {
        seed: 1,
      }),
    ).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "CIRCULAR_REFERENCE",
        path: ["a"],
        details: { fields: ["a", "b", "a"] },
      }),
    );
    expect(() =>
      executor.generate(
        object({
          c: template("{a}"),
          a: template("{b}"),
          b: template("{c}"),
        }),
        { seed: 1 },
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "CIRCULAR_REFERENCE",
        path: ["a"],
        details: { fields: ["a", "b", "c", "a"] },
      }),
    );
  });

  it("uses field names as the stable tie-breaker for independent fields", () => {
    const registry = createRegistry();
    registerChoiceGenerator(registry);
    registerObjectGenerator(registry);
    const executor = createExecutor(registry);
    const first = object({
      zebra: choice(["z0", "z1"]),
      alpha: choice(["a0", "a1"]),
    });
    const second = object({
      alpha: choice(["a0", "a1"]),
      zebra: choice(["z0", "z1"]),
    });

    const firstResult = executor.generate(first, { seed: "stable-order" });
    const secondResult = executor.generate(second, { seed: "stable-order" });
    expect(firstResult.alpha).toBe(secondResult.alpha);
    expect(firstResult.zebra).toBe(secondResult.zebra);
  });
});

type ReferenceDefinition = GeneratorDefinition<string> & {
  readonly type: "test-reference";
  readonly reference: readonly string[];
};

function reference(path: readonly string[]): ReferenceDefinition {
  return { type: "test-reference", reference: path } as ReferenceDefinition;
}

const referenceGenerator = defineGenerator({
  type: "test-reference",
  version: 1,
  validateDefinition() {
    return [];
  },
  analyzeValueDependencies(definition: ReferenceDefinition) {
    return [{ path: definition.reference }];
  },
  generate({
    definition,
    context,
  }: {
    readonly definition: ReferenceDefinition;
    readonly context: {
      readonly references: { resolve(path: readonly string[]): unknown };
    };
  }) {
    return String(context.references.resolve(definition.reference));
  },
});

describe("array", () => {
  it("infers item arrays and delegates children with numeric indexes", () => {
    const registry = createRegistry();
    registerIntegerGenerator(registry);
    registerObjectGenerator(registry);
    registerArrayGenerator(registry);
    const definition = array(object({ value: integer({ min: 2, max: 2 }) }), {
      length: 2,
    });

    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<
      { readonly value: number }[]
    >();
    expect(createExecutor(registry).generate(definition, { seed: 1 })).toEqual([
      { value: 2 },
      { value: 2 },
    ]);
  });

  it("does not execute a child for an empty array", () => {
    const registry = createRegistry();
    registerIntegerGenerator(registry);
    registry.register(arrayGenerator);
    const definition = array(integer({ min: 0, max: 1 }), { length: 0 });

    expect(
      createExecutor(registry).generate(definition, {
        random: {
          float: () => 0,
          integer: () => {
            throw new Error("child should not execute");
          },
          bytes: (length) => new Uint8Array(length),
        },
      }),
    ).toEqual([]);
  });

  it.each([
    [{ length: -1 }, ["length"]],
    [{ length: 10_001 }, ["length"]],
    [{ length: 1.5 }, ["length"]],
    [{ length: 1, count: 2 }, ["count"]],
  ])("rejects invalid array options", (options, path) => {
    expect(() => array(integer({ min: 0, max: 1 }), options as never)).toThrow(
      expect.objectContaining({
        code: Object.hasOwn(options, "count")
          ? "INVALID_CONFIGURATION"
          : "INVALID_LENGTH",
        path,
      }),
    );
  });
});
