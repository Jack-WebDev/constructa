import { describe, expect, it } from "vitest";

import {
  assertJsonValue,
  findJsonValueError,
  isJsonValue,
  type JsonValue,
  JsonValueError,
} from "./index";

const validDefinitions: readonly JsonValue[] = [
  null,
  true,
  false,
  0,
  42,
  -12.5,
  "generator",
  [],
  ["alpha", 3, null, false],
  {
    configuration: {
      max: 100,
      min: 1,
      nested: [{ enabled: true }, { label: "portable" }],
    },
    type: "integer",
  },
];

const repeatedReference: Record<string, unknown> = { type: "integer" };

function createSparseArray() {
  const value = new Array<unknown>(3);
  value[0] = "integer";
  value[2] = "boolean";
  return value;
}

const invalidDefinitions: readonly [string, unknown][] = [
  ["top-level undefined", undefined],
  ["function value", () => "not portable"],
  ["symbol value", Symbol("not-portable")],
  ["bigint value", 1n],
  ["NaN number", Number.NaN],
  ["infinite number", Number.POSITIVE_INFINITY],
  ["negative zero", -0],
  ["date object", new Date("2026-01-01T00:00:00.000Z")],
  ["map object", new Map([["type", "integer"]])],
  ["undefined object property", { type: "integer", omitted: undefined }],
  ["undefined array item", ["integer", undefined]],
  ["function object property", { type: "integer", build: () => 1 }],
  ["sparse array slot", createSparseArray()],
  ["array custom property", Object.assign(["integer"], { type: "boolean" })],
  [
    "non-enumerable property",
    Object.defineProperty({ type: "integer" }, "hidden", {
      enumerable: false,
      value: "omitted",
    }),
  ],
  [
    "accessor property",
    Object.defineProperty({ type: "integer" }, "computed", {
      enumerable: true,
      get: () => "omitted",
    }),
  ],
  [
    "symbol object key",
    {
      [Symbol("type")]: "integer",
    },
  ],
  ["toJSON behavior", { toJSON: () => ({ type: "integer" }) }],
  ["class instance", new (class Definition {})()],
];

describe("JSON-only portable definitions", () => {
  it.each(validDefinitions)(
    "accepts JSON-compatible data that round-trips through JSON",
    (definition) => {
      expect(isJsonValue(definition)).toBe(true);
      expect(findJsonValueError(definition)).toBeUndefined();
      expect(() => assertJsonValue(definition)).not.toThrow();

      const encoded = JSON.stringify(definition);
      expect(encoded).toBeDefined();

      const decoded = JSON.parse(encoded);
      expect(decoded).toEqual(definition);
      expect(isJsonValue(decoded)).toBe(true);
    },
  );

  it.each(invalidDefinitions)("rejects %s", (_name, definition) => {
    expect(isJsonValue(definition)).toBe(false);
    expect(findJsonValueError(definition)).toEqual(
      expect.objectContaining({
        path: expect.stringMatching(/^\$/u),
        reason: expect.any(String),
      }),
    );
    expect(() => assertJsonValue(definition)).toThrow(JsonValueError);
  });

  it("rejects cyclic objects", () => {
    const cyclicDefinition: Record<string, unknown> = { type: "object" };
    cyclicDefinition.self = cyclicDefinition;

    expect(isJsonValue(cyclicDefinition)).toBe(false);
    expect(findJsonValueError(cyclicDefinition)).toEqual({
      path: "$.self",
      reason: "cyclic objects are not JSON-compatible",
    });
  });

  it("accepts repeated acyclic references because JSON can duplicate them", () => {
    const definition = {
      left: repeatedReference,
      right: repeatedReference,
    };

    expect(isJsonValue(definition)).toBe(true);
    expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
  });
});
