import { ConstructaError } from "constructa-schema";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  createDefaultRandomSource,
  createExecutor,
  createGenerationContext,
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
  parseDefinition,
  parseDocument,
  type RandomSource,
  type Seed,
  safeParseDefinition,
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

const context: GenerationContext = createGenerationContext({
  random: createRandomSource({
    float: () => 0.5,
    integer: () => 0,
    bytes: (length) => new Uint8Array(length),
  }),
  executeChild: (definition) => definition as never,
});

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

describe("generation contexts", () => {
  it("isolates path state and exposes no mutable engine state", () => {
    const first = createGenerationContext({
      random: createSeededRandom("first"),
      path: ["definition"],
    });
    const second = createGenerationContext({
      random: createSeededRandom("second"),
    });

    expect(first.path).toEqual(["definition"]);
    expect(second.path).toEqual([]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.path)).toBe(true);
    expect(() => first.executeChild({ type: "integer" }, "value")).toThrow(
      expect.objectContaining({
        kind: "execution",
        code: "CHILD_EXECUTION_UNAVAILABLE",
        path: ["definition", "value"],
      }),
    );
  });

  it("rejects invalid context paths before creating a capability", () => {
    expect(() =>
      createGenerationContext({
        random: createSeededRandom("seed"),
        path: [Number.NaN],
      }),
    ).toThrow(
      expect.objectContaining({
        code: "INVALID_GENERATION_CONTEXT",
        path: ["path"],
      }),
    );
  });
});

describe("runtime parsing", () => {
  const registry = createRegistry();
  const generate = vi.fn(() => 1);
  registry.register(
    defineGenerator({
      type: "integer",
      version: 1,
      validateDefinition(definition) {
        return typeof (definition as { min?: unknown }).min === "number"
          ? []
          : [
              {
                code: "invalid_min",
                path: ["min"],
                message: "min must be a number",
              },
            ];
      },
      generate,
    }),
  );

  it("validates registered definitions recursively without executing them", () => {
    const definition = {
      type: "integer",
      min: 1,
      child: { type: "integer", min: "bad" },
    };
    const result = safeParseDefinition(definition, { registry });

    expect(result).toEqual({
      success: false,
      issues: [
        expect.objectContaining({
          kind: "configuration",
          code: "INVALID_CONFIGURATION",
          path: ["child", "min"],
        }),
      ],
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it("uses root-relative paths for definitions and definition-relative paths for documents", () => {
    expect(() => parseDefinition({ type: "missing" }, { registry })).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "UNKNOWN_GENERATOR",
        path: ["type"],
      }),
    );
    expect(() =>
      parseDocument(
        { schemaVersion: 1, definition: { type: "missing" } },
        { registry },
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "UNKNOWN_GENERATOR",
        path: ["definition", "type"],
      }),
    );
  });

  it("bounds recursive parsing work", () => {
    expect(() =>
      parseDefinition(
        {
          type: "integer",
          min: 1,
          nested: {
            type: "integer",
            min: 1,
            nested: { type: "integer", min: 1 },
          },
        },
        {
          registry,
          limits: { maxDepth: 1 },
        },
      ),
    ).toThrow(
      expect.objectContaining({
        code: "PARSE_DEPTH_LIMIT",
        path: ["nested", "nested"],
      }),
    );
  });
});

describe("single-value execution", () => {
  it("dispatches registered implementations with exact output inference", () => {
    const registry = createRegistry();
    registry.register(integerImplementation);
    registry.register(
      defineGenerator({
        type: "label",
        version: 1,
        validateDefinition() {
          return [];
        },
        generate() {
          return "generated" as const;
        },
      }),
    );
    const executor = createExecutor(registry);
    const result = executor.generate(integer(4), { seed: "same" });

    expectTypeOf(result).toEqualTypeOf<number>();
    expect(result).toBeTypeOf("number");
    expect(executor.generate({ type: "label" }, { seed: "same" })).toBe(
      "generated",
    );
  });

  it("uses a fresh seeded source per root and passes it only through context", () => {
    const registry = createRegistry();
    registry.register(
      defineGenerator({
        type: "random-value",
        version: 1,
        validateDefinition() {
          return [];
        },
        generate({ context: generationContext }) {
          return generationContext.random.integer(1_000_000);
        },
      }),
    );
    const executor = createExecutor(registry);
    const definition = { type: "random-value" } as const;

    expect(executor.generate(definition, { seed: "repeatable" })).toBe(
      executor.generate(definition, { seed: "repeatable" }),
    );
    expect(executor.generate(definition, { seed: "different" })).not.toBe(
      executor.generate(definition, { seed: "repeatable" }),
    );
  });

  it("validates options and definitions before generator execution", () => {
    const registry = createRegistry();
    const generate = vi.fn(() => 1);
    registry.register(
      defineGenerator({
        type: "guarded",
        version: 1,
        validateDefinition(definition) {
          return typeof (definition as { value?: unknown }).value === "number"
            ? []
            : [
                {
                  code: "invalid_value",
                  path: ["value"],
                  message: "value must be a number",
                },
              ];
        },
        generate,
      }),
    );
    const executor = createExecutor(registry);
    const random = createSeededRandom("injected");

    expect(() =>
      executor.generate({ type: "guarded" }, { seed: "seed", random }),
    ).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "CONFLICTING_RANDOM_OPTIONS",
        path: ["seed"],
      }),
    );
    expect(() => executor.generate({ type: "guarded" })).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: ["value"],
      }),
    );
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not validate a definition again after parsing it", () => {
    const registry = createRegistry();
    const validateDefinition = vi.fn(() => []);
    registry.register(
      defineGenerator({
        type: "parsed",
        version: 1,
        validateDefinition,
        generate() {
          return "ok";
        },
      }),
    );
    const parsed = parseDefinition({ type: "parsed" }, { registry });

    expect(createExecutor(registry).generate(parsed, { seed: 1 })).toBe("ok");
    expect(validateDefinition).toHaveBeenCalledTimes(1);
  });

  it("runs dependency analysis against the execution snapshot", () => {
    const registry = createRegistry();
    registry.register(implementation("dependency"));
    registry.register(
      defineGenerator({
        type: "root",
        version: 1,
        validateDefinition() {
          return [];
        },
        analyzeDependencies() {
          return [{ typeId: "missing", path: ["dependency"] }];
        },
        generate() {
          return 1;
        },
      }),
    );

    expect(() =>
      createExecutor(registry).generate({ type: "root" }, { seed: 1 }),
    ).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "UNKNOWN_GENERATOR",
        path: ["dependency", "type"],
      }),
    );
  });
});

describe("child execution", () => {
  it("delegates typed children with the same random source and child path", () => {
    const registry = createRegistry();
    let parentRandom: unknown;
    let childRandom: unknown;
    registry.register(
      defineGenerator({
        type: "child",
        version: 1,
        validateDefinition() {
          return [];
        },
        generate({ context: generationContext }) {
          childRandom = generationContext.random;
          expect(generationContext.path).toEqual(["child"]);
          return generationContext.random.integer(1_000);
        },
      }),
    );
    registry.register(
      defineGenerator({
        type: "parent",
        version: 1,
        validateDefinition() {
          return [];
        },
        generate({ definition, context: generationContext }) {
          parentRandom = generationContext.random;
          return generationContext.executeChild(
            (definition as unknown as { child: GeneratorDefinition<number> })
              .child,
            "child",
          );
        },
      }),
    );
    const executor = createExecutor(registry);

    expect(
      executor.generate(
        { type: "parent", child: { type: "child" } },
        { seed: "shared" },
      ),
    ).toBe(createSeededRandom("shared").integer(1_000));
    expect(parentRandom).toBe(childRandom);
  });

  it("uses one deterministic sequence across siblings and isolated sequences across roots", () => {
    const registry = createRegistry();
    const rootSources: RandomSource[] = [];
    registry.register(
      defineGenerator({
        type: "draw",
        version: 1,
        validateDefinition() {
          return [];
        },
        generate({ context: generationContext }) {
          return generationContext.random.integer(1_000);
        },
      }),
    );
    registry.register(
      defineGenerator({
        type: "pair-draw",
        version: 1,
        validateDefinition() {
          return [];
        },
        generate({ definition, context: generationContext }) {
          rootSources.push(generationContext.random);
          const children = definition as unknown as {
            readonly left: GeneratorDefinition<number>;
            readonly right: GeneratorDefinition<number>;
          };
          return [
            generationContext.executeChild(children.left, "left"),
            generationContext.executeChild(children.right, "right"),
          ];
        },
      }),
    );
    const executor = createExecutor(registry);
    const definition = {
      type: "pair-draw",
      left: { type: "draw" },
      right: { type: "draw" },
    };
    const expected = createSeededRandom("sequence");

    expect(executor.generate(definition, { seed: "sequence" })).toEqual([
      expected.integer(1_000),
      expected.integer(1_000),
    ]);
    const repeated = createSeededRandom("sequence");
    expect(executor.generate(definition, { seed: "sequence" })).toEqual([
      repeated.integer(1_000),
      repeated.integer(1_000),
    ]);
    expect(rootSources[0]).not.toBe(rootSources[1]);
  });

  it("preserves child error paths and enforces maximum child depth", () => {
    const registry = createRegistry();
    registry.register(
      defineGenerator({
        type: "failing-child",
        version: 1,
        validateDefinition() {
          return [];
        },
        generate() {
          throw new ConstructaError({
            kind: "dependency",
            code: "REFERENCE_NOT_FOUND",
            path: ["reference"],
            message: "Reference was not found.",
          });
        },
      }),
    );
    registry.register(
      defineGenerator({
        type: "parent-failure",
        version: 1,
        validateDefinition() {
          return [];
        },
        generate({ definition, context: generationContext }) {
          return generationContext.executeChild(
            (definition as unknown as { child: GeneratorDefinition }).child,
            "child",
          );
        },
      }),
    );
    const executor = createExecutor(registry);
    const definition = {
      type: "parent-failure",
      child: { type: "failing-child" },
    };

    expect(() => executor.generate(definition, { seed: 1 })).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "REFERENCE_NOT_FOUND",
        path: ["child", "reference"],
      }),
    );
    expect(() =>
      executor.generate(definition, { seed: 1, maxDepth: 0 }),
    ).toThrow(
      expect.objectContaining({
        kind: "execution",
        code: "MAX_EXECUTION_DEPTH",
        path: ["child"],
      }),
    );
  });
});
