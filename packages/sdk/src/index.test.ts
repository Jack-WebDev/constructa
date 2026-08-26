import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createEngine,
  createRegistry,
  defineGenerator,
  type Engine,
  type Infer,
  integer,
  object,
} from "./index";

describe("createEngine", () => {
  it("automatically registers every built-in generator", () => {
    const engine = createEngine();
    const definition = object({
      id: integer({ min: 7, max: 7 }),
    });

    expectTypeOf(engine).toEqualTypeOf<Engine>();
    expectTypeOf(engine.generate(definition)).toEqualTypeOf<
      Infer<typeof definition>
    >();
    expect(engine.generate(definition, { seed: "built-ins" })).toEqual({
      id: 7,
    });
  });

  it("uses advanced registry, random, and parse-limit overrides", () => {
    const registry = createRegistry();
    const custom = defineGenerator({
      type: "custom",
      version: 1,
      validateDefinition() {
        return [];
      },
      generate() {
        return "custom result";
      },
    });
    registry.register(custom);
    const engine = createEngine({
      registry,
      random: {
        float: () => 0,
        integer: () => 0,
        bytes: (length) => new Uint8Array(length),
      },
    });

    expect(engine.generate({ type: "custom" })).toBe("custom result");
    expect(
      createEngine({
        random: {
          float: () => 0,
          integer: () => 0,
          bytes: (length) => new Uint8Array(length),
        },
      }).generate(integer({ min: 4, max: 5 })),
    ).toBe(4);
    expect(() => engine.generate(integer({ min: 1, max: 1 }))).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "UNKNOWN_GENERATOR",
        path: ["type"],
      }),
    );
    expect(() =>
      createEngine({ limits: { maxDepth: 1 } }).generate(
        object({ child: object({ value: integer({ min: 1, max: 1 }) }) }),
      ),
    ).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "PARSE_DEPTH_LIMIT",
        path: ["fields", "child", "fields", "value"],
      }),
    );
  });

  it("snapshots registries and does not share engine state", () => {
    const registry = createRegistry();
    const implementation = defineGenerator({
      type: "stable",
      version: 1,
      validateDefinition() {
        return [];
      },
      generate() {
        return "stable";
      },
    });
    registry.register(implementation);
    const engine = createEngine({ registry });
    registry.replace(
      defineGenerator({
        ...implementation,
        validateDefinition() {
          return [{ code: "invalid", path: [], message: "new registry only" }];
        },
        generate() {
          return "changed";
        },
      }),
    );

    expect(engine.generate({ type: "stable" })).toBe("stable");
    expect(createEngine().generate(integer({ min: 3, max: 3 }))).toBe(3);
  });

  it("rejects malformed engine options with structured errors", () => {
    expect(() => createEngine(null as never)).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_ENGINE_OPTIONS",
        path: [],
      }),
    );
    expect(() => createEngine({ limits: { maxDepth: 0 } })).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_PARSE_LIMITS",
        path: ["limits", "maxDepth"],
      }),
    );
  });
});
