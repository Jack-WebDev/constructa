import { createExecutor, createRegistry, type Infer } from "constructa-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  type IntegerDefinition,
  integer,
  integerGenerator,
  registerIntegerGenerator,
} from "./index";

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
