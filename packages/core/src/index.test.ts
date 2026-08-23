import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createGeneratorDefinition,
  createRegistry,
  defineGenerator,
  type GenerationContext,
  type GeneratorDefinition,
  type GeneratorImplementation,
  type Infer,
  invokeGeneratorImplementation,
} from "./index";

type IntegerDefinition<Minimum extends number = number> =
  GeneratorDefinition<number> & {
    readonly type: "integer";
    readonly min: Minimum;
  };

function integer<const Minimum extends number>(min: Minimum) {
  return createGeneratorDefinition({
    type: "integer",
    min,
  }) as IntegerDefinition<Minimum>;
}

const context: GenerationContext = {
  random: { next: () => 0.5 },
  generateChild: (definition) => definition as never,
};

const integerImplementation: GeneratorImplementation<
  IntegerDefinition,
  number
> = defineGenerator({
  type: "integer",
  version: 1,
  validateDefinition(definition) {
    return typeof (definition as { readonly min?: unknown }).min === "number"
      ? []
      : [
          {
            code: "invalid_minimum",
            path: ["min"],
            message: "min must be a number",
          },
        ];
  },
  generate({ definition, context: generationContext }) {
    return definition.min + generationContext.random.next();
  },
});

function implementation(type: string, version = 1) {
  return defineGenerator({
    type,
    version,
    validateDefinition() {
      return [];
    },
    generate() {
      return type;
    },
  });
}

describe("generator implementation contract", () => {
  it("preserves factory literals and infers primitive output without caller generics", () => {
    const definition = integer(4);

    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<number>();
    expectTypeOf(definition.min).toEqualTypeOf<4>();
    expect(Object.keys(definition)).toEqual(["type", "min"]);
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
  });

  it("supports a custom implementation without core changes", () => {
    const definition = integer(4);

    expect(
      invokeGeneratorImplementation(integerImplementation, {
        definition,
        context,
      }),
    ).toBe(4.5);
  });

  it("supports composite output inference through factory return types", () => {
    const pair = createGeneratorDefinition({
      type: "pair",
      left: integer(1),
      right: integer(2),
    }) as GeneratorDefinition<{ left: number; right: number }> & {
      readonly type: "pair";
      readonly left: IntegerDefinition<1>;
      readonly right: IntegerDefinition<2>;
    };

    expectTypeOf<Infer<typeof pair>>().toEqualTypeOf<{
      left: number;
      right: number;
    }>();
    expect(JSON.parse(JSON.stringify(pair))).toEqual(pair);
  });

  it("carries array output inference without adding runtime markers", () => {
    const list = createGeneratorDefinition({
      type: "array",
      item: integer(1),
    }) as GeneratorDefinition<number[]> & {
      readonly type: "array";
      readonly item: IntegerDefinition<1>;
    };

    expectTypeOf<Infer<typeof list>>().toEqualTypeOf<number[]>();
    expect(Object.keys(list)).toEqual(["type", "item"]);
  });

  it("normalizes thrown validation and execution failures", () => {
    const throwingValidator = defineGenerator({
      type: "throwing-validator",
      version: 1,
      validateDefinition() {
        throw new Error("validator secret");
      },
      generate() {
        return 1;
      },
    });
    const throwingGenerator = defineGenerator({
      type: "throwing-generator",
      version: 1,
      validateDefinition() {
        return [];
      },
      generate() {
        throw new Error("generator secret");
      },
    });

    expect(() =>
      invokeGeneratorImplementation(throwingValidator, {
        definition: { type: "throwing-validator" },
        context,
        path: ["definition"],
      }),
    ).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: ["definition"],
      }),
    );
    expect(() =>
      invokeGeneratorImplementation(throwingGenerator, {
        definition: { type: "throwing-generator" },
        context,
      }),
    ).toThrow(
      expect.objectContaining({ kind: "execution", code: "EXECUTION_FAILED" }),
    );
  });

  it("preserves the current path when validation returns an issue", () => {
    const invalidDefinition = {
      type: "integer",
      min: "one",
    } as unknown as IntegerDefinition;

    expect(() =>
      invokeGeneratorImplementation(integerImplementation, {
        definition: invalidDefinition,
        context,
        path: ["definition"],
      }),
    ).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: ["definition", "min"],
      }),
    );
  });
});

describe("generator registry", () => {
  it("registers implementations and creates immutable, order-independent snapshots", () => {
    const registry = createRegistry();
    registry.register(implementation("zebra"));
    registry.register(implementation("alpha", 2));
    const snapshot = registry.snapshot();

    expect(snapshot.generators).toEqual([
      { type: "alpha", version: 2 },
      { type: "zebra", version: 1 },
    ]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.generators)).toBe(true);

    registry.register(implementation("middle"));
    expect(snapshot.generators).toHaveLength(2);
    expect(registry.snapshot().generators.map(({ type }) => type)).toEqual([
      "alpha",
      "middle",
      "zebra",
    ]);
  });

  it("copies implementations into the registry snapshot boundary", () => {
    const registry = createRegistry();
    const registered = implementation("integer", 1);
    registry.register(registered);
    (registered as { version: number }).version = 99;

    expect(registry.snapshot().generators).toEqual([
      { type: "integer", version: 1 },
    ]);
  });

  it("rejects duplicate and reserved IDs without changing registry state", () => {
    const registry = createRegistry();
    registry.register(implementation("integer"));

    expect(() => registry.register(implementation("integer", 2))).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "DUPLICATE_GENERATOR",
        path: ["type"],
      }),
    );
    expect(() => registry.register(implementation("constructor"))).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: ["type"],
      }),
    );
    expect(registry.snapshot().generators).toEqual([
      { type: "integer", version: 1 },
    ]);
  });

  it("replaces a registered implementation only through the explicit API", () => {
    const registry = createRegistry();
    registry.register(implementation("integer", 1));
    registry.replace(implementation("integer", 2));

    expect(registry.snapshot().generators).toEqual([
      { type: "integer", version: 2 },
    ]);
    expect(() => registry.replace(implementation("missing"))).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "UNKNOWN_GENERATOR",
        path: ["type"],
      }),
    );
  });

  it("returns structured errors for malformed runtime registrations", () => {
    const registry = createRegistry();
    const malformed = {
      type: "integer",
      version: 0,
      validateDefinition: () => [],
      generate: () => 1,
    } as unknown as GeneratorImplementation<
      GeneratorDefinition<number>,
      number
    >;

    expect(() => registry.register(malformed)).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: ["implementation"],
      }),
    );
  });
});
