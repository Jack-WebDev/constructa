import { describe, expect, it } from "vitest";

import {
  assertDocument,
  assertJsonValue,
  CURRENT_SCHEMA_VERSION,
  findDocumentFailure,
  findJsonValueError,
  GENERATOR_DOCUMENT_TOP_LEVEL_KEYS,
  type GeneratorDefinition,
  GeneratorDocumentError,
  type GeneratorDocumentV1,
  isDocument,
  isGeneratorDefinition,
  isJsonValue,
  JsonValueError,
  parseDocument,
  safeParseDocument,
} from "./index";

const documents: readonly GeneratorDocumentV1[] = [
  { schemaVersion: 1, definition: { type: "boolean" } },
  {
    schemaVersion: 1,
    name: "Small integer",
    description: "An integer in a bounded range.",
    definition: { type: "integer", min: 1, max: 100 },
  },
  {
    schemaVersion: 1,
    definition: {
      type: "object",
      fields: {
        account: {
          type: "object",
          fields: { id: { type: "integer", min: 1 } },
        },
      },
    },
  },
];

function sparseArray() {
  const value = new Array<unknown>(2);
  value[0] = "value";
  return value;
}

const cyclicValue: Record<string, unknown> = {};
cyclicValue.self = cyclicValue;

describe("portable JSON values", () => {
  it("round-trips JSON-compatible values", () => {
    const value = { nested: [true, null, { count: 3 }] };
    expect(isJsonValue(value)).toBe(true);
    expect(JSON.parse(JSON.stringify(value))).toEqual(value);
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    -0,
    new Date(),
    new Map(),
    new (class Value {})(),
    () => undefined,
    Symbol("value"),
    1n,
    { value: undefined },
    [undefined],
    sparseArray(),
    Object.assign(["value"], { extra: true }),
    Object.defineProperty({}, "hidden", { value: true }),
    Object.defineProperty({}, "value", { enumerable: true, get: () => 1 }),
    { [Symbol("key")]: "value" },
    { toJSON: () => ({}) },
    JSON.parse('{"__proto__":"unsafe"}'),
    cyclicValue,
  ])("rejects non-portable values", (value) => {
    expect(isJsonValue(value)).toBe(false);
    expect(() => assertJsonValue(value)).toThrow(JsonValueError);
  });

  it("reports nested paths for invalid values", () => {
    expect(
      findJsonValueError({ definition: { values: [1, Number.NaN] } }),
    ).toEqual({
      path: "$.definition.values[1]",
      reason: "number must be finite",
    });
  });
});

describe("generator definitions", () => {
  it("keeps the discriminator and generator fields at the same level", () => {
    const definition: GeneratorDefinition = {
      type: "integer",
      min: 1,
      max: 100,
    };
    expect(isGeneratorDefinition(definition)).toBe(true);
  });

  it.each([
    [{}, "generator_type_missing", "$.definition.type"],
    [{ type: " " }, "generator_type_invalid", "$.definition.type"],
    [
      { type: "integer", schemaVersion: 1 },
      "definition_document_metadata",
      "$.definition.schemaVersion",
    ],
    [
      { type: "integer", name: "document name" },
      "definition_document_metadata",
      "$.definition.name",
    ],
    [
      { type: "object", fields: { id: { type: "integer", schemaVersion: 1 } } },
      "definition_document_metadata",
      "$.definition.fields.id.schemaVersion",
    ],
  ] as const)("rejects invalid definitions", (definition, code, path) => {
    expect(findDocumentFailure({ schemaVersion: 1, definition })).toEqual(
      expect.objectContaining({ code, path }),
    );
  });
});

describe("generator documents", () => {
  it("exports the document keys", () => {
    expect(GENERATOR_DOCUMENT_TOP_LEVEL_KEYS).toEqual([
      "schemaVersion",
      "name",
      "description",
      "definition",
    ]);
  });

  it.each(documents)("parses and JSON round-trips documents", (document) => {
    expect(isDocument(document)).toBe(true);
    expect(parseDocument(document)).toBe(document);
    const decoded = JSON.parse(JSON.stringify(document));
    expect(parseDocument(decoded)).toEqual(document);
    expect(decoded.definition).not.toHaveProperty("schemaVersion");
    expect(decoded.definition).not.toHaveProperty("name");
    expect(decoded.definition).not.toHaveProperty("description");
  });

  it("allows empty display metadata without normalization", () => {
    expect(
      parseDocument({
        schemaVersion: CURRENT_SCHEMA_VERSION,
        name: "",
        description: "",
        definition: { type: "boolean" },
      }),
    ).toMatchObject({ name: "", description: "" });
  });

  it.each([
    [
      { definition: { type: "integer" } },
      "schema_version_missing",
      "$.schemaVersion",
    ],
    [
      { schemaVersion: 2, definition: { type: "integer" } },
      "schema_version_unsupported",
      "$.schemaVersion",
    ],
    [{ schemaVersion: 1 }, "definition_missing", "$.definition"],
    [
      { schemaVersion: 1, definition: [] },
      "generator_definition_not_object",
      "$.definition",
    ],
    [
      { schemaVersion: 1, definition: { type: "integer" }, owner: "team" },
      "top_level_property_unknown",
      "$.owner",
    ],
    [
      { schemaVersion: 1, definition: { type: "integer" }, name: null },
      "name_invalid",
      "$.name",
    ],
  ] as const)("returns precise failures", (document, code, path) => {
    expect(findDocumentFailure(document)).toEqual(
      expect.objectContaining({ code, path, severity: "error" }),
    );
  });

  it("rejects the retired configuration envelope with migration guidance", () => {
    const oldEnvelope = {
      schemaVersion: 1,
      type: "integer",
      configuration: { min: 1, max: 100 },
    };
    expect(safeParseDocument(oldEnvelope)).toEqual({
      success: false,
      failure: expect.objectContaining({
        code: "configuration_envelope_removed",
        message: expect.stringContaining(
          "put generator fields directly inside definition",
        ),
      }),
    });
    expect(() => assertDocument(oldEnvelope)).toThrow(GeneratorDocumentError);
  });
});
