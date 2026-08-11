import { describe, expect, it } from "vitest";

import {
  assertDefinitionEnvelope,
  assertJsonValue,
  assertSchemaVersion,
  assertVersionedDefinition,
  CURRENT_SCHEMA_VERSION,
  DEFINITION_ENVELOPE_TOP_LEVEL_KEYS,
  type DefinitionEnvelope,
  DefinitionEnvelopeError,
  type DefinitionEnvelopeFailure,
  findDefinitionEnvelopeFailure,
  findJsonValueError,
  findSchemaVersionFailure,
  findSchemaVersionValueFailure,
  isDefinitionEnvelope,
  isJsonValue,
  isSchemaVersion,
  isVersionedDefinition,
  type JsonValue,
  JsonValueError,
  parseDefinitionEnvelope,
  type SchemaVersion,
  SchemaVersionError,
  SUPPORTED_SCHEMA_VERSIONS,
  safeParseDefinitionEnvelope,
  type VersionedDefinition,
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

const definitionEnvelopeFixtures: readonly DefinitionEnvelope[] = [
  {
    configuration: {
      max: 100,
      min: 1,
    },
    description: "An integer in a bounded range.",
    name: "Small integer",
    schemaVersion: CURRENT_SCHEMA_VERSION,
    type: "integer",
  },
  {
    configuration: {},
    schemaVersion: 1,
    type: "boolean",
  },
  {
    configuration: {
      values: ["Admin", "Member", "Viewer"],
    },
    name: "",
    schemaVersion: 1,
    type: "choice",
  },
];

const repeatedReference: Record<string, unknown> = { type: "integer" };

const completeDefinitions: readonly VersionedDefinition[] = [
  {
    configuration: {},
    schemaVersion: CURRENT_SCHEMA_VERSION,
    type: "integer",
  },
  {
    description: "A portable boolean generator definition.",
    name: "Flag",
    schemaVersion: 1,
    type: "boolean",
  },
];

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

describe("schema version marker", () => {
  it("exports version 1 as the current and only supported schema version", () => {
    const currentVersion: SchemaVersion = CURRENT_SCHEMA_VERSION;

    expect(currentVersion).toBe(1);
    expect(SUPPORTED_SCHEMA_VERSIONS).toEqual([1]);
    expect(isSchemaVersion(1)).toBe(true);
    expect(isSchemaVersion(2)).toBe(false);
  });

  it.each(completeDefinitions)(
    "accepts complete definitions declaring version 1",
    (definition) => {
      expect(isVersionedDefinition(definition)).toBe(true);
      expect(findSchemaVersionFailure(definition)).toBeUndefined();
      expect(() => assertVersionedDefinition(definition)).not.toThrow();

      const encoded = JSON.stringify(definition);
      const decoded = JSON.parse(encoded);

      expect(decoded.schemaVersion).toBe(1);
      expect(isVersionedDefinition(decoded)).toBe(true);
    },
  );

  it("does not treat non-portable data as a versioned definition", () => {
    const definition = {
      build: () => "not portable",
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };

    expect(findSchemaVersionFailure(definition)).toBeUndefined();
    expect(isVersionedDefinition(definition)).toBe(false);
    expect(() => assertVersionedDefinition(definition)).toThrow(JsonValueError);
  });

  it.each([
    ["empty definition", {}],
    ["definition without version", { configuration: {}, type: "integer" }],
    ["non-object definition", "integer"],
  ] as const)(
    "returns a structured failure for missing schemaVersion on %s",
    (_name, definition) => {
      expect(findSchemaVersionFailure(definition)).toEqual({
        code: "schema_version_missing",
        message: "schemaVersion is required and must be 1",
        path: "$.schemaVersion",
        severity: "error",
        supportedVersions: [1],
      });
      expect(isVersionedDefinition(definition)).toBe(false);
      expect(() => assertVersionedDefinition(definition)).toThrow(
        SchemaVersionError,
      );
    },
  );

  it.each([
    ["future version", 2],
    ["string version", "1"],
    ["null version", null],
  ] as const)(
    "returns a structured failure for unsupported schemaVersion: %s",
    (_name, schemaVersion) => {
      const failure = {
        code: "schema_version_unsupported",
        message: "schemaVersion must be 1",
        path: "$.schemaVersion",
        severity: "error",
        supportedVersions: [1],
      };

      expect(findSchemaVersionValueFailure(schemaVersion)).toEqual(failure);
      expect(findSchemaVersionFailure({ schemaVersion })).toEqual(failure);
      expect(() => assertSchemaVersion(schemaVersion)).toThrow(
        SchemaVersionError,
      );
    },
  );

  it("exposes the structured failure when schema version assertion throws", () => {
    expect.assertions(2);

    try {
      assertVersionedDefinition({ schemaVersion: 99 });
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaVersionError);
      expect((error as SchemaVersionError).failure).toEqual(
        expect.objectContaining({
          code: "schema_version_unsupported",
          path: "$.schemaVersion",
        }),
      );
    }
  });
});

describe("definition envelope", () => {
  it("exports the canonical top-level envelope keys", () => {
    expect(DEFINITION_ENVELOPE_TOP_LEVEL_KEYS).toEqual([
      "schemaVersion",
      "type",
      "configuration",
      "name",
      "description",
    ]);
  });

  it.each(definitionEnvelopeFixtures)(
    "parses portable generator definition envelopes",
    (definition) => {
      expect(isDefinitionEnvelope(definition)).toBe(true);
      expect(findDefinitionEnvelopeFailure(definition)).toBeUndefined();
      expect(() => assertDefinitionEnvelope(definition)).not.toThrow();
      expect(parseDefinitionEnvelope(definition)).toBe(definition);
      expect(safeParseDefinitionEnvelope(definition)).toEqual({
        success: true,
        value: definition,
      });

      const encoded = JSON.stringify(definition);
      const decoded = JSON.parse(encoded);

      expect(decoded).toEqual(definition);
      expect(isDefinitionEnvelope(decoded)).toBe(true);
    },
  );

  it("narrows parsed values to the inferred TypeScript envelope type", () => {
    const parsed: DefinitionEnvelope = parseDefinitionEnvelope({
      configuration: {},
      schemaVersion: CURRENT_SCHEMA_VERSION,
      type: "integer",
    });

    expect(parsed.configuration).toEqual({});
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.type).toBe("integer");
  });

  it("allows generator-specific data only inside configuration", () => {
    const definition = {
      configuration: {
        nested: {
          custom: [1, "two", true, null],
        },
      },
      schemaVersion: CURRENT_SCHEMA_VERSION,
      type: "custom",
    };

    expect(isDefinitionEnvelope(definition)).toBe(true);
  });

  it.each([
    [
      "top-level array",
      [],
      {
        code: "definition_envelope_not_object",
        message: "definition envelope must be a JSON object",
        path: "$",
      },
    ],
    [
      "non-portable nested value",
      {
        configuration: {
          min: Number.NaN,
        },
        schemaVersion: CURRENT_SCHEMA_VERSION,
        type: "integer",
      },
      {
        code: "definition_envelope_not_json",
        message: "number must be finite",
        path: "$.configuration.min",
      },
    ],
    [
      "missing type",
      {
        configuration: {},
        schemaVersion: CURRENT_SCHEMA_VERSION,
      },
      {
        code: "generator_type_missing",
        message: "type is required",
        path: "$.type",
      },
    ],
    [
      "blank type",
      {
        configuration: {},
        schemaVersion: CURRENT_SCHEMA_VERSION,
        type: "   ",
      },
      {
        code: "generator_type_invalid",
        message: "type must be a non-empty string",
        path: "$.type",
      },
    ],
    [
      "missing configuration",
      {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        type: "integer",
      },
      {
        code: "configuration_missing",
        message: "configuration is required",
        path: "$.configuration",
      },
    ],
    [
      "array configuration",
      {
        configuration: [],
        schemaVersion: CURRENT_SCHEMA_VERSION,
        type: "integer",
      },
      {
        code: "configuration_invalid",
        message: "configuration must be a JSON object",
        path: "$.configuration",
      },
    ],
    [
      "invalid name",
      {
        configuration: {},
        name: null,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        type: "integer",
      },
      {
        code: "name_invalid",
        message: "name must be a string when present",
        path: "$.name",
      },
    ],
    [
      "invalid description",
      {
        configuration: {},
        description: false,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        type: "integer",
      },
      {
        code: "description_invalid",
        message: "description must be a string when present",
        path: "$.description",
      },
    ],
    [
      "unknown top-level property",
      {
        configuration: {},
        metadata: {},
        schemaVersion: CURRENT_SCHEMA_VERSION,
        type: "integer",
      },
      {
        code: "top_level_property_unknown",
        message: "Unknown top-level property: metadata",
        path: "$.metadata",
      },
    ],
  ] as const)(
    "returns a structured definition envelope failure for %s",
    (_name, definition, expectedFailure) => {
      const failure: DefinitionEnvelopeFailure = {
        ...expectedFailure,
        severity: "error",
      };

      expect(findDefinitionEnvelopeFailure(definition)).toEqual(failure);
      expect(isDefinitionEnvelope(definition)).toBe(false);
      expect(safeParseDefinitionEnvelope(definition)).toEqual({
        failure,
        success: false,
      });
      expect(() => assertDefinitionEnvelope(definition)).toThrow(
        DefinitionEnvelopeError,
      );
    },
  );

  it("reuses schema version failures for invalid envelope versions", () => {
    const definition = {
      configuration: {},
      schemaVersion: 2,
      type: "integer",
    };

    expect(findDefinitionEnvelopeFailure(definition)).toEqual({
      code: "schema_version_unsupported",
      message: "schemaVersion must be 1",
      path: "$.schemaVersion",
      severity: "error",
      supportedVersions: [1],
    });
  });

  it("exposes the structured failure when definition envelope assertion throws", () => {
    expect.assertions(2);

    try {
      assertDefinitionEnvelope({
        configuration: {},
        extra: true,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        type: "integer",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DefinitionEnvelopeError);
      expect((error as DefinitionEnvelopeError).failure).toEqual(
        expect.objectContaining({
          code: "top_level_property_unknown",
          path: "$.extra",
        }),
      );
    }
  });
});
