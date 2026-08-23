import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createDefaultRandomSource,
  createGeneratorDefinition,
  createRandomSource,
  createRegistry,
  createSeededRandom,
  defineGenerator,
  type GenerationContext,
  type GeneratorDefinition,
  type GeneratorImplementation,
  getSeededRandomMetadata,
  type Infer,
  invokeGeneratorImplementation,
  normalizeSeed,
  type Seed,
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
  random: createRandomSource({
    float: () => 0.5,
    integer: () => 0,
    bytes: (length) => new Uint8Array(length),
  }),
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
    return definition.min + generationContext.random.float();
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

describe("random sources", () => {
  it("provides a platform-backed source with documented output ranges", () => {
    const source = createDefaultRandomSource();

    expect(source.float()).toBeGreaterThanOrEqual(0);
    expect(source.float()).toBeLessThan(1);
    expect(source.integer(1)).toBe(0);
    expect(source.integer(10)).toBeGreaterThanOrEqual(0);
    expect(source.integer(10)).toBeLessThan(10);
    expect(source.bytes(16)).toHaveLength(16);
  });

  it("uses scripted float, integer, and byte adapters at their documented boundaries", () => {
    const requestedIntegers: number[] = [];
    const requestedBytes: number[] = [];
    const source = createRandomSource({
      float: () => 0,
      integer(maxExclusive) {
        requestedIntegers.push(maxExclusive);
        return maxExclusive - 1;
      },
      bytes(length) {
        requestedBytes.push(length);
        return Uint8Array.from({ length }, (_, index) => index);
      },
    });

    expect(source.float()).toBe(0);
    expect(source.integer(1)).toBe(0);
    expect(source.integer(256)).toBe(255);
    expect([...source.bytes(3)]).toEqual([0, 1, 2]);
    expect(requestedIntegers).toEqual([1, 256]);
    expect(requestedBytes).toEqual([3]);
  });

  it.each([
    [
      {
        float: (): number => 1,
        integer: (): number => 0,
        bytes: (length: number): Uint8Array => new Uint8Array(length),
      },
      "float",
    ],
    [
      {
        float: (): number => 0.5,
        integer: (): number => -1,
        bytes: (length: number): Uint8Array => new Uint8Array(length),
      },
      "integer",
    ],
    [
      {
        float: (): number => 0.5,
        integer: (): number => 0,
        bytes: (): Uint8Array => new Uint8Array(0),
      },
      "bytes",
    ],
  ] as const)(
    "fails invalid %s adapter output as a system error",
    (adapter, method) => {
      const source = createRandomSource(adapter);
      const invoke =
        method === "float"
          ? () => source.float()
          : method === "integer"
            ? () => source.integer(2)
            : () => source.bytes(2);

      expect(invoke).toThrow(
        expect.objectContaining({
          kind: "system",
          code: "INVALID_RANDOM_SOURCE",
          path: ["random"],
        }),
      );
    },
  );

  it("rejects malformed sources and invalid requested ranges", () => {
    expect(() => createRandomSource({} as never)).toThrow(
      expect.objectContaining({ code: "INVALID_RANDOM_SOURCE" }),
    );

    const source = createRandomSource({
      float: () => 0.5,
      integer: () => 0,
      bytes: (length) => new Uint8Array(length),
    });
    expect(() => source.integer(0)).toThrow(
      expect.objectContaining({ code: "INVALID_RANDOM_SOURCE" }),
    );
    expect(() => source.bytes(-1)).toThrow(
      expect.objectContaining({ code: "INVALID_RANDOM_SOURCE" }),
    );
  });
});

describe("seeded random sources", () => {
  function sequence(seed: number | string) {
    const source = createSeededRandom(seed);
    return {
      floats: [source.float(), source.float()],
      integers: [source.integer(1_000), source.integer(1_000)],
      bytes: [...source.bytes(8)],
    };
  }

  it.each([
    [
      "",
      {
        floats: [0.41053841243665934, 0.028399092828827688],
        integers: [144, 654],
        bytes: [239, 128, 246, 106, 85, 161, 182, 194],
      },
    ],
    [
      0,
      {
        floats: [0.8912590515490286, 0.7996191326779422],
        integers: [369, 700],
        bytes: [0, 155, 198, 163, 136, 59, 187, 16],
      },
    ],
    [
      "😀",
      {
        floats: [0.3146099011913387, 0.3388515190522643],
        integers: [784, 567],
        bytes: [103, 158, 159, 32, 13, 53, 243, 198],
      },
    ],
  ] as const)(
    "matches the versioned golden sequence for %j",
    (seed, expected) => {
      expect(sequence(seed)).toEqual(expected);
    },
  );

  it("normalizes supported seed forms explicitly", () => {
    expect(normalizeSeed(0)).toBe("number:0");
    expect(normalizeSeed(-0)).toBe("number:0");
    expect(normalizeSeed(Number.MAX_VALUE)).toBe(`number:${Number.MAX_VALUE}`);
    expect(normalizeSeed("")).toBe("string:");
    expect(normalizeSeed("😀")).toBe("string:😀");
    expect(sequence(-0)).toEqual(sequence(0));
  });

  it("rejects unsupported seed values with configuration errors", () => {
    expect(() => createSeededRandom(true as unknown as Seed)).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_SEED",
        path: ["seed"],
      }),
    );
    expect(() => createSeededRandom(Number.NaN)).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_SEED",
        path: ["seed"],
      }),
    );
    expect(() => createSeededRandom(Number.POSITIVE_INFINITY)).toThrow(
      expect.objectContaining({ code: "INVALID_SEED" }),
    );
  });

  it("keeps independently created sources deterministic and isolated", () => {
    const first = createSeededRandom("same");
    const second = createSeededRandom("same");
    const different = createSeededRandom("different");

    expect(first.float()).toBe(second.float());
    expect(first.integer(1_000)).toBe(second.integer(1_000));
    expect([...first.bytes(4)]).toEqual([...second.bytes(4)]);
    expect(different.float()).not.toBe(createSeededRandom("same").float());
  });

  it("exposes algorithm metadata without serializing a seed", () => {
    const metadata = getSeededRandomMetadata();

    expect(metadata).toEqual({ algorithm: "mulberry32", version: 1 });
    expect(JSON.stringify(metadata)).not.toContain("seed");
    expect(Object.isFrozen(metadata)).toBe(true);
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

  it("resolves registered types through live and immutable snapshot lookups", () => {
    const registry = createRegistry();
    registry.register(implementation("integer", 1));
    const snapshot = registry.snapshot();

    expect(registry.lookup("integer").version).toBe(1);
    expect(snapshot.lookup("integer").version).toBe(1);

    registry.replace(implementation("integer", 2));
    expect(registry.lookup("integer").version).toBe(2);
    expect(snapshot.lookup("integer").version).toBe(1);
  });

  it("reports unknown generator types as precise dependency errors", () => {
    const registry = createRegistry();
    registry.register(implementation("boolean"));
    registry.register(implementation("integer"));

    expect(() => registry.lookup("missing", ["fields", "id"])).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "UNKNOWN_GENERATOR",
        path: ["fields", "id", "type"],
        details: { registeredTypes: ["boolean", "integer"] },
      }),
    );
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
