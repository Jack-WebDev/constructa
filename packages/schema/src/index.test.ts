import { describe, expect, expectTypeOf, it } from "vitest";

import {
  assertDocument,
  assertGeneratorMetadata,
  assertJsonValue,
  ConstructaError,
  CURRENT_SCHEMA_VERSION,
  createConstructaError,
  GENERATOR_DOCUMENT_TOP_LEVEL_KEYS,
  type GeneratorDefinition,
  GeneratorDocumentError,
  GeneratorMetadataError,
  isDocument,
  isGeneratorDefinition,
  isGeneratorMetadata,
  isJsonValue,
  JsonValueError,
  normalizeConstructaError,
  parseDocument,
  SERIALIZATION_DEFINITION_FIXTURES,
  SERIALIZATION_DOCUMENT_FIXTURES,
  safeParseDocument,
  serializeDefinition,
  serializeDocument,
  type ValidationPath,
  validateDocument,
  validateGeneratorDefinition,
  validateGeneratorMetadata,
  validateJsonValue,
} from "./index";

function sparseArray() {
  const value = new Array<unknown>(2);
  value[0] = "value";
  return value;
}

const cyclicValue: Record<string, unknown> = {};
cyclicValue.self = cyclicValue;
const compileTimePath: ValidationPath = ["definition", "fields", 0];

describe("structured errors", () => {
  it.each(["configuration", "dependency", "execution", "system"] as const)(
    "serializes %s errors without functions",
    (kind) => {
      const error = createConstructaError({
        kind,
        code: "EXECUTION_FAILED",
        path: ["definition", "fields", 0],
        message: "Generation failed.",
        details: { attempt: 1 },
      });

      expect(error).toBeInstanceOf(ConstructaError);
      expect(JSON.parse(JSON.stringify(error))).toEqual({
        kind,
        code: "EXECUTION_FAILED",
        path: ["definition", "fields", 0],
        message: "Generation failed.",
        details: { attempt: 1 },
      });
    },
  );

  it("preserves an existing structured error when wrapping it", () => {
    const inner = createConstructaError({
      kind: "dependency",
      code: "REFERENCE_NOT_FOUND",
      path: ["definition", "reference"],
      message: "Referenced generator was not found.",
    });
    const wrapped = normalizeConstructaError(inner, {
      kind: "execution",
      code: "EXECUTION_FAILED",
      path: [],
      message: "Generation failed.",
    });

    expect(wrapped.toJSON()).toEqual(inner.toJSON());
  });

  it("redacts system causes from safe output", () => {
    const error = normalizeConstructaError(new Error("secret database URL"), {
      kind: "system",
      code: "EXECUTION_FAILED",
      path: [],
      message: "The generator could not be executed.",
    });

    expect(error.hasCause()).toBe(true);
    expect(JSON.stringify(error)).not.toContain("secret database URL");
    expect(error.toJSON()).toEqual({
      kind: "system",
      code: "EXECUTION_FAILED",
      path: [],
      message: "The generator could not be executed.",
    });
  });

  it("rejects unsafe details and non-uppercase codes", () => {
    expect(() =>
      createConstructaError({
        kind: "configuration",
        code: "invalid_configuration" as Uppercase<string>,
        path: [],
        message: "Invalid configuration.",
      }),
    ).toThrow(TypeError);
    expect(() =>
      createConstructaError({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: [],
        message: "Invalid configuration.",
        details: { cause: () => "unsafe" } as unknown as { cause: string },
      }),
    ).toThrow(TypeError);
  });

  it("maps schema validation exceptions into configuration errors", () => {
    expect.assertions(4);
    try {
      assertDocument({ schemaVersion: 1, definition: { type: "" } });
    } catch (error) {
      expect(error).toBeInstanceOf(ConstructaError);
      expect((error as ConstructaError).kind).toBe("configuration");
      expect((error as ConstructaError).code).toBe("INVALID_CONFIGURATION");
      expect((error as ConstructaError).path).toEqual(["definition", "type"]);
    }
  });
});

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
      validateJsonValue({ definition: { values: [1, Number.NaN] } }),
    ).toEqual([
      {
        code: "invalid_json_value",
        path: ["definition", "values", 1],
        message: "number must be finite",
      },
    ]);
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
    [{}, "generator_type_missing", ["definition", "type"]],
    [{ type: " " }, "generator_type_invalid", ["definition", "type"]],
    [
      { type: "integer", schemaVersion: 1 },
      "definition_document_metadata",
      ["definition", "schemaVersion"],
    ],
    [
      { type: "integer", name: "document name" },
      "definition_document_metadata",
      ["definition", "name"],
    ],
    [
      { type: "object", fields: { id: { type: "integer", schemaVersion: 1 } } },
      "definition_document_metadata",
      ["definition", "fields", "id", "schemaVersion"],
    ],
  ] as const)("rejects invalid definitions", (definition, code, path) => {
    expect(validateDocument({ schemaVersion: 1, definition })[0]).toEqual(
      expect.objectContaining({ code, path }),
    );
  });

  it("uses literal property names and numeric indexes as path segments", () => {
    const issues = validateGeneratorDefinition({
      type: "object",
      fields: {
        "profile.age": { type: "integer", schemaVersion: 1 },
      },
      alternatives: [{ type: "", name: "not document metadata" }],
    });

    expect(issues.map((issue) => issue.path)).toEqual([
      ["fields", "profile.age", "schemaVersion"],
      ["alternatives", 0, "type"],
      ["alternatives", 0, "name"],
    ]);
    expect(compileTimePath).toEqual(["definition", "fields", 0]);
  });
});

describe("semantic generator metadata", () => {
  const metadata = {
    typeId: "integer",
    displayName: "Integer",
    description: "Generates a whole number.",
    category: "numeric",
    outputCategory: "number",
    documentationUrl: "https://constructa.dev/generators/integer",
    examples: [0, 42, { min: 1, max: 10 }],
  } as const;

  it("is portable JSON and remains separate from definitions", () => {
    expect(isGeneratorMetadata(metadata)).toBe(true);
    expect(JSON.parse(JSON.stringify(metadata))).toEqual(metadata);

    const definition = { type: "integer", min: 1, max: 10 };
    expect(parseDocument({ schemaVersion: 1, definition }).definition).toBe(
      definition,
    );
  });

  it("allows third-party metadata to omit every optional field", () => {
    expect(isGeneratorMetadata({})).toBe(true);
  });

  it.each([
    [{ typeId: "Integer" }, "metadata_type_id_invalid", ["typeId"]],
    [{ category: "two words" }, "metadata_category_invalid", ["category"]],
    [
      { outputCategory: "preview value" },
      "metadata_output_category_invalid",
      ["outputCategory"],
    ],
    [{ examples: {} }, "metadata_examples_invalid", ["examples"]],
    [{ examples: [() => 1] }, "generator_metadata_not_json", ["examples", 0]],
    [
      { component: "IntegerControl" },
      "metadata_property_unknown",
      ["component"],
    ],
  ] as const)("rejects invalid metadata", (value, code, path) => {
    expect(validateGeneratorMetadata(value)[0]).toEqual(
      expect.objectContaining({ code, path, severity: "error" }),
    );
  });

  it("exposes structured metadata failures through assertions", () => {
    expect(() => assertGeneratorMetadata({ typeId: "not valid" })).toThrow(
      GeneratorMetadataError,
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

  it.each(SERIALIZATION_DOCUMENT_FIXTURES)(
    "parses and JSON round-trips documents",
    (document) => {
      expect(isDocument(document)).toBe(true);
      expect(parseDocument(document)).toBe(document);
      const decoded = JSON.parse(JSON.stringify(document));
      expect(parseDocument(decoded)).toEqual(document);
      expect(decoded.definition).not.toHaveProperty("schemaVersion");
      expect(decoded.definition).not.toHaveProperty("name");
      expect(decoded.definition).not.toHaveProperty("description");
    },
  );

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
      ["schemaVersion"],
    ],
    [
      { schemaVersion: 2, definition: { type: "integer" } },
      "schema_version_unsupported",
      ["schemaVersion"],
    ],
    [{ schemaVersion: 1 }, "definition_missing", ["definition"]],
    [
      { schemaVersion: 1, definition: [] },
      "generator_definition_not_object",
      ["definition"],
    ],
    [
      { schemaVersion: 1, definition: { type: "integer" }, owner: "team" },
      "top_level_property_unknown",
      ["owner"],
    ],
    [
      { schemaVersion: 1, definition: { type: "integer" }, name: null },
      "name_invalid",
      ["name"],
    ],
  ] as const)("returns precise failures", (document, code, path) => {
    expect(validateDocument(document)[0]).toEqual(
      expect.objectContaining({ code, path, severity: "error" }),
    );
  });

  it("aggregates independent issues in document property order", () => {
    const issues = validateDocument({
      schemaVersion: 2,
      owner: "team",
      name: null,
      description: false,
      definition: { type: "", schemaVersion: 1 },
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "top_level_property_unknown",
        path: ["owner"],
      }),
      expect.objectContaining({
        code: "schema_version_unsupported",
        path: ["schemaVersion"],
        details: { supportedVersions: [1] },
      }),
      expect.objectContaining({ code: "name_invalid", path: ["name"] }),
      expect.objectContaining({
        code: "description_invalid",
        path: ["description"],
      }),
      expect.objectContaining({
        code: "generator_type_invalid",
        path: ["definition", "type"],
      }),
      expect.objectContaining({
        code: "definition_document_metadata",
        path: ["definition", "schemaVersion"],
      }),
    ]);
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

describe("schema serialization", () => {
  it("serializes definitions with stable recursively sorted keys", () => {
    const definition = {
      type: "object",
      fields: {
        zebra: { type: "integer", max: 2, min: 1 },
        alpha: { type: "boolean" },
      },
    };

    expectTypeOf(serializeDefinition(definition)).toEqualTypeOf<string>();
    expect(serializeDefinition(definition)).toBe(`{
  "fields": {
    "alpha": {
      "type": "boolean"
    },
    "zebra": {
      "max": 2,
      "min": 1,
      "type": "integer"
    }
  },
  "type": "object"
}
`);
  });

  it.each(SERIALIZATION_DEFINITION_FIXTURES)(
    "round-trips shared definition fixtures",
    (definition) => {
      const serialized = serializeDefinition(definition);
      expect(JSON.parse(serialized)).toEqual(definition);
      expect(serializeDefinition(JSON.parse(serialized))).toBe(serialized);
    },
  );

  it.each(SERIALIZATION_DOCUMENT_FIXTURES)(
    "round-trips shared document fixtures",
    (document) => {
      const serialized = serializeDocument(document);
      expect(JSON.parse(serialized)).toEqual(document);
      expect(serializeDocument(JSON.parse(serialized))).toBe(serialized);
    },
  );

  it("uses the same validation errors as definitions and documents", () => {
    expect(() => serializeDefinition({ value: 1 })).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: ["type"],
      }),
    );
    expect(() =>
      serializeDocument({ schemaVersion: 1, definition: [] }),
    ).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: ["definition"],
      }),
    );
    expect(() => serializeDocument({ id: "generated-result" })).toThrow(
      expect.objectContaining({
        kind: "configuration",
        code: "INVALID_CONFIGURATION",
        path: ["id"],
      }),
    );
  });
});
