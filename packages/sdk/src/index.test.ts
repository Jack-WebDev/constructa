import { describe, expect, expectTypeOf, it } from "vitest";

import {
  array,
  boolean,
  choice,
  createEngine,
  createRegistry,
  date,
  decimal,
  defineGenerator,
  type Engine,
  generate,
  type Infer,
  integer,
  object,
  safeParseDocument,
  serializeDefinition,
  string,
  template,
  uuid,
} from "./index";

describe("canonical SDK API", () => {
  it("generates the PRD employee example without infrastructure setup", () => {
    const employee = object({
      id: uuid(),
      active: boolean(),
      role: choice(["engineer", "designer"]),
      score: decimal({ min: 0, max: 100, precision: 2 }),
      startDate: date({ min: "2024-01-01", max: "2024-12-31" }),
      code: string({ length: 6 }),
      labels: array(choice(["new", "verified"]), { length: 2 }),
      summary: template("Employee"),
    });

    expectTypeOf<Infer<typeof employee>>().toEqualTypeOf<{
      readonly id: string;
      readonly active: boolean;
      readonly role: "engineer" | "designer";
      readonly score: number;
      readonly startDate: string;
      readonly code: string;
      readonly labels: ("new" | "verified")[];
      readonly summary: string;
    }>();
    expect(generate(employee, { seed: "employee" })).toEqual(
      generate(employee, { seed: "employee" }),
    );
  });

  it("executes serialized definitions through the same built-in engine", () => {
    const definition = object({
      role: choice(["admin", "member"]),
      number: integer({ min: 1, max: 100 }),
    });
    const serialized = serializeDefinition(definition);
    const reparsed = JSON.parse(serialized);

    expect(generate(reparsed, { seed: "portable" })).toEqual(
      generate(definition, { seed: "portable" }),
    );
  });

  it("validates versioned documents through the built-in registry without execution", () => {
    const result = safeParseDocument({
      schemaVersion: 1,
      definition: { type: "integer", min: 1, max: 1 },
    });
    expect(result).toEqual({
      success: true,
      value: {
        schemaVersion: 1,
        definition: { type: "integer", min: 1, max: 1 },
      },
    });

    const invalid = safeParseDocument({
      schemaVersion: 1,
      definition: { type: "missing" },
    });
    expect(invalid).toEqual({
      success: false,
      issues: [
        expect.objectContaining({
          kind: "dependency",
          code: "UNKNOWN_GENERATOR",
          path: ["definition", "type"],
        }),
      ],
    });
  });
});

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
    expect(generate(integer({ min: 2, max: 2 }))).toBe(2);
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
