import { createExecutor, createRegistry, type Infer } from "constructa-core";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  type BooleanDefinition,
  boolean,
  booleanGenerator,
  type IntegerDefinition,
  integer,
  integerGenerator,
  registerBooleanGenerator,
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
