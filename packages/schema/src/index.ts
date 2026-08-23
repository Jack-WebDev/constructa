export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;
export type JsonArray = readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue };

export const CURRENT_SCHEMA_VERSION = 1;
export const SUPPORTED_SCHEMA_VERSIONS = [CURRENT_SCHEMA_VERSION] as const;
export type SchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

/** Portable executable generator data. Generator fields live beside `type`. */
export type GeneratorDefinition = JsonObject & { readonly type: string };

/** Versioned document containing exactly one root generator definition. */
export type GeneratorDocumentV1 = {
  readonly schemaVersion: 1;
  readonly definition: GeneratorDefinition;
  readonly name?: string;
  readonly description?: string;
};

export type GeneratorDocument = GeneratorDocumentV1;

export const GENERATOR_DOCUMENT_TOP_LEVEL_KEYS = [
  "schemaVersion",
  "name",
  "description",
  "definition",
] as const;

const DOCUMENT_METADATA_KEYS = new Set([
  "schemaVersion",
  "name",
  "description",
  "owner",
  "ownership",
  "visibility",
  "createdAt",
  "updatedAt",
  "timestamps",
]);

export type SchemaVersionFailureCode =
  | "schema_version_missing"
  | "schema_version_unsupported";
export type SchemaVersionFailure = {
  readonly code: SchemaVersionFailureCode;
  readonly message: string;
  readonly path: string;
  readonly severity: "error";
  readonly supportedVersions: readonly SchemaVersion[];
};

export type GeneratorDefinitionFailureCode =
  | "generator_definition_not_json"
  | "generator_definition_not_object"
  | "generator_type_missing"
  | "generator_type_invalid"
  | "definition_document_metadata";
export type GeneratorDefinitionFailure = {
  readonly code: GeneratorDefinitionFailureCode;
  readonly message: string;
  readonly path: string;
  readonly severity: "error";
};

export type GeneratorDocumentFailureCode =
  | SchemaVersionFailureCode
  | GeneratorDefinitionFailureCode
  | "generator_document_not_json"
  | "generator_document_not_object"
  | "definition_missing"
  | "name_invalid"
  | "description_invalid"
  | "top_level_property_unknown"
  | "configuration_envelope_removed";
export type GeneratorDocumentFailure =
  | SchemaVersionFailure
  | {
      readonly code: Exclude<
        GeneratorDocumentFailureCode,
        SchemaVersionFailureCode
      >;
      readonly message: string;
      readonly path: string;
      readonly severity: "error";
    };
export type GeneratorDocumentParseResult =
  | { readonly success: true; readonly value: GeneratorDocumentV1 }
  | { readonly success: false; readonly failure: GeneratorDocumentFailure };

export class JsonValueError extends TypeError {
  constructor(path: string, reason: string) {
    super(`${path}: ${reason}`);
    this.name = "JsonValueError";
  }
}

export class SchemaVersionError extends TypeError {
  readonly failure: SchemaVersionFailure;
  constructor(failure: SchemaVersionFailure) {
    super(`${failure.path}: ${failure.message}`);
    this.name = "SchemaVersionError";
    this.failure = failure;
  }
}

export class GeneratorDefinitionError extends TypeError {
  readonly failure: GeneratorDefinitionFailure;
  constructor(failure: GeneratorDefinitionFailure) {
    super(`${failure.path}: ${failure.message}`);
    this.name = "GeneratorDefinitionError";
    this.failure = failure;
  }
}

export class GeneratorDocumentError extends TypeError {
  readonly failure: GeneratorDocumentFailure;
  constructor(failure: GeneratorDocumentFailure) {
    super(`${failure.path}: ${failure.message}`);
    this.name = "GeneratorDocumentError";
    this.failure = failure;
  }
}

export function isJsonValue(value: unknown): value is JsonValue {
  return findJsonValueError(value) === undefined;
}
export function isSchemaVersion(value: unknown): value is SchemaVersion {
  return value === CURRENT_SCHEMA_VERSION;
}
export function isGeneratorDefinition(
  value: unknown,
): value is GeneratorDefinition {
  return findGeneratorDefinitionFailure(value) === undefined;
}
export function isDocument(value: unknown): value is GeneratorDocumentV1 {
  return findDocumentFailure(value) === undefined;
}
export function assertJsonValue(
  value: unknown,
  path = "$",
): asserts value is JsonValue {
  const error = findJsonValueError(value, path);
  if (error !== undefined) throw new JsonValueError(error.path, error.reason);
}
export function assertSchemaVersion(
  value: unknown,
  path = "$.schemaVersion",
): asserts value is SchemaVersion {
  const failure = findSchemaVersionValueFailure(value, path);
  if (failure !== undefined) throw new SchemaVersionError(failure);
}
export function assertGeneratorDefinition(
  value: unknown,
  path = "$",
): asserts value is GeneratorDefinition {
  const failure = findGeneratorDefinitionFailure(value, path);
  if (failure !== undefined) throw new GeneratorDefinitionError(failure);
}
export function assertDocument(
  value: unknown,
  path = "$",
): asserts value is GeneratorDocumentV1 {
  const failure = findDocumentFailure(value, path);
  if (failure !== undefined) throw new GeneratorDocumentError(failure);
}
export function parseDocument(value: unknown, path = "$"): GeneratorDocumentV1 {
  assertDocument(value, path);
  return value;
}
export function safeParseDocument(
  value: unknown,
  path = "$",
): GeneratorDocumentParseResult {
  const failure = findDocumentFailure(value, path);
  return failure === undefined
    ? { success: true, value: value as GeneratorDocumentV1 }
    : { success: false, failure };
}

export function findJsonValueError(
  value: unknown,
  path = "$",
): { path: string; reason: string } | undefined {
  return findJsonValueErrorInternal(value, path, new Set());
}
export function findGeneratorDefinitionFailure(
  value: unknown,
  path = "$",
): GeneratorDefinitionFailure | undefined {
  const jsonError = findJsonValueError(value, path);
  if (jsonError !== undefined)
    return definitionFailure(
      "generator_definition_not_json",
      jsonError.path,
      jsonError.reason,
    );
  if (!isJsonRecord(value))
    return definitionFailure("generator_definition_not_object", path);
  if (!Object.hasOwn(value, "type"))
    return definitionFailure(
      "generator_type_missing",
      appendPathSegment(path, "type"),
    );
  if (typeof value.type !== "string" || value.type.trim().length === 0)
    return definitionFailure(
      "generator_type_invalid",
      appendPathSegment(path, "type"),
    );
  const metadataKey = Object.keys(value).find(
    (key) => key !== "type" && DOCUMENT_METADATA_KEYS.has(key),
  );
  if (metadataKey !== undefined) {
    return definitionFailure(
      "definition_document_metadata",
      appendPathSegment(path, metadataKey),
    );
  }

  const nestedMetadataPath = findNestedDefinitionMetadataPath(
    value as JsonObject,
    path,
  );
  return nestedMetadataPath === undefined
    ? undefined
    : definitionFailure("definition_document_metadata", nestedMetadataPath);
}
export function findDocumentFailure(
  value: unknown,
  path = "$",
): GeneratorDocumentFailure | undefined {
  const jsonError = findJsonValueError(value, path);
  if (jsonError !== undefined)
    return documentFailure(
      "generator_document_not_json",
      jsonError.path,
      jsonError.reason,
    );
  if (!isJsonRecord(value))
    return documentFailure("generator_document_not_object", path);
  if (Object.hasOwn(value, "configuration") && Object.hasOwn(value, "type"))
    return documentFailure("configuration_envelope_removed", path);
  const unknownKey = Object.keys(value).find(
    (key) => !GENERATOR_DOCUMENT_TOP_LEVEL_KEYS.includes(key as never),
  );
  if (unknownKey !== undefined)
    return documentFailure(
      "top_level_property_unknown",
      appendPathSegment(path, unknownKey),
      `Unknown top-level property: ${unknownKey}`,
    );
  const versionFailure = findSchemaVersionFailure(value, path);
  if (versionFailure !== undefined) return versionFailure;
  for (const property of ["name", "description"] as const) {
    if (Object.hasOwn(value, property) && typeof value[property] !== "string")
      return documentFailure(
        property === "name" ? "name_invalid" : "description_invalid",
        appendPathSegment(path, property),
      );
  }
  if (!Object.hasOwn(value, "definition"))
    return documentFailure(
      "definition_missing",
      appendPathSegment(path, "definition"),
    );
  return findGeneratorDefinitionFailure(
    value.definition,
    appendPathSegment(path, "definition"),
  );
}
export function findSchemaVersionFailure(
  value: unknown,
  path = "$",
): SchemaVersionFailure | undefined {
  if (!isJsonRecord(value) || !Object.hasOwn(value, "schemaVersion"))
    return createSchemaVersionFailure(
      "schema_version_missing",
      appendPathSegment(path, "schemaVersion"),
    );
  return findSchemaVersionValueFailure(
    value.schemaVersion,
    appendPathSegment(path, "schemaVersion"),
  );
}
export function findSchemaVersionValueFailure(
  value: unknown,
  path = "$.schemaVersion",
): SchemaVersionFailure | undefined {
  return isSchemaVersion(value)
    ? undefined
    : createSchemaVersionFailure("schema_version_unsupported", path);
}

function createSchemaVersionFailure(
  code: SchemaVersionFailureCode,
  path: string,
): SchemaVersionFailure {
  return {
    code,
    message:
      code === "schema_version_missing"
        ? `schemaVersion is required and must be ${CURRENT_SCHEMA_VERSION}`
        : `schemaVersion must be ${CURRENT_SCHEMA_VERSION}`,
    path,
    severity: "error",
    supportedVersions: SUPPORTED_SCHEMA_VERSIONS,
  };
}
function definitionFailure(
  code: GeneratorDefinitionFailureCode,
  path: string,
  message?: string,
): GeneratorDefinitionFailure {
  const messages: Record<GeneratorDefinitionFailureCode, string> = {
    generator_definition_not_json:
      "generator definition must be portable JSON data",
    generator_definition_not_object:
      "generator definition must be a JSON object",
    generator_type_missing: "type is required",
    generator_type_invalid: "type must be a non-empty string",
    definition_document_metadata:
      "document metadata is not allowed in a generator definition",
  };
  return { code, message: message ?? messages[code], path, severity: "error" };
}
function documentFailure(
  code: Exclude<GeneratorDocumentFailureCode, SchemaVersionFailureCode>,
  path: string,
  message?: string,
): Exclude<GeneratorDocumentFailure, SchemaVersionFailure> {
  const messages: Record<
    Exclude<GeneratorDocumentFailureCode, SchemaVersionFailureCode>,
    string
  > = {
    generator_document_not_json:
      "generator document must be portable JSON data",
    generator_document_not_object: "generator document must be a JSON object",
    generator_definition_not_json:
      "generator definition must be portable JSON data",
    generator_definition_not_object:
      "generator definition must be a JSON object",
    generator_type_missing: "type is required",
    generator_type_invalid: "type must be a non-empty string",
    definition_document_metadata:
      "document metadata is not allowed in a generator definition",
    definition_missing: "definition is required",
    name_invalid: "name must be a string when present",
    description_invalid: "description must be a string when present",
    top_level_property_unknown: "unknown top-level properties are not allowed",
    configuration_envelope_removed:
      "The configuration envelope was removed; put generator fields directly inside definition.",
  };
  return { code, message: message ?? messages[code], path, severity: "error" };
}
function appendPathSegment(path: string, segment: string) {
  return path === "$" ? `$.${segment}` : `${path}.${segment}`;
}

function findNestedDefinitionMetadataPath(
  value: JsonObject,
  path: string,
): string | undefined {
  for (const [key, child] of Object.entries(value)) {
    if (key === "type") continue;

    const childPath = appendPathSegment(path, key);
    const metadataPath = findDefinitionMetadataPath(child, childPath);
    if (metadataPath !== undefined) return metadataPath;
  }

  return undefined;
}

function findDefinitionMetadataPath(
  value: JsonValue,
  path: string,
): string | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const metadataPath = findDefinitionMetadataPath(
        value[index],
        `${path}[${index}]`,
      );
      if (metadataPath !== undefined) return metadataPath;
    }
    return undefined;
  }

  if (!isJsonRecord(value)) return undefined;

  if (typeof value.type === "string") {
    const metadataKey = Object.keys(value).find(
      (key) => key !== "type" && DOCUMENT_METADATA_KEYS.has(key),
    );
    if (metadataKey !== undefined) return appendPathSegment(path, metadataKey);
  }

  return findNestedDefinitionMetadataPath(value, path);
}
function isJsonRecord(value: unknown): value is Record<string, unknown> {
  const prototype =
    typeof value === "object" && value !== null
      ? Object.getPrototypeOf(value)
      : undefined;
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (prototype === null || prototype === Object.prototype)
  );
}
function findJsonValueErrorInternal(
  value: unknown,
  path: string,
  ancestors: Set<object>,
): { path: string; reason: string } | undefined {
  switch (typeof value) {
    case "boolean":
    case "string":
      return undefined;
    case "number":
      if (!Number.isFinite(value))
        return { path, reason: "number must be finite" };
      return Object.is(value, -0)
        ? { path, reason: "number must not be negative zero" }
        : undefined;
    case "object":
      return value === null
        ? undefined
        : findJsonObjectError(value, path, ancestors);
    case "bigint":
    case "function":
    case "symbol":
    case "undefined":
      return { path, reason: `${typeof value} is not JSON-compatible` };
  }
}
function findJsonObjectError(
  value: object,
  path: string,
  ancestors: Set<object>,
): { path: string; reason: string } | undefined {
  if (ancestors.has(value))
    return { path, reason: "cyclic objects are not JSON-compatible" };
  if (
    "toJSON" in value &&
    typeof (value as { readonly toJSON?: unknown }).toJSON === "function"
  )
    return { path, reason: "objects with toJSON behavior are not portable" };
  ancestors.add(value);
  const error = Array.isArray(value)
    ? findJsonArrayError(value, path, ancestors)
    : findJsonRecordError(value, path, ancestors);
  ancestors.delete(value);
  return error;
}
function findJsonArrayError(
  value: readonly unknown[],
  path: string,
  ancestors: Set<object>,
): { path: string; reason: string } | undefined {
  const extraProperty = Object.keys(value).find((key) => !isArrayIndexKey(key));
  if (extraProperty !== undefined)
    return {
      path: `${path}.${extraProperty}`,
      reason: "array object properties would be omitted from JSON",
    };
  const propertyError = findUnsupportedOwnProperty(value, path, ["length"]);
  if (propertyError !== undefined) return propertyError;
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value))
      return {
        path: `${path}[${index}]`,
        reason: "sparse array slots are not JSON-compatible",
      };
    const itemError = findJsonValueErrorInternal(
      value[index],
      `${path}[${index}]`,
      ancestors,
    );
    if (itemError !== undefined) return itemError;
  }
  return undefined;
}
function isArrayIndexKey(key: string) {
  const index = Number(key);
  return (
    Number.isInteger(index) &&
    index >= 0 &&
    index < 2 ** 32 - 1 &&
    String(index) === key
  );
}
function findJsonRecordError(
  value: object,
  path: string,
  ancestors: Set<object>,
): { path: string; reason: string } | undefined {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype)
    return { path, reason: "object must be a plain JSON record" };
  const propertyError = findUnsupportedOwnProperty(value, path);
  if (propertyError !== undefined) return propertyError;
  for (const key of Object.keys(value)) {
    const itemError = findJsonValueErrorInternal(
      (value as Record<string, unknown>)[key],
      `${path}.${key}`,
      ancestors,
    );
    if (itemError !== undefined) return itemError;
  }
  return undefined;
}
function findUnsupportedOwnProperty(
  value: object,
  path: string,
  allowedNonEnumerableProperties: readonly string[] = [],
): { path: string; reason: string } | undefined {
  if (Object.hasOwn(value, "__proto__")) {
    return {
      path: appendPathSegment(path, "__proto__"),
      reason: "__proto__ keys are not portable JSON data",
    };
  }
  if (Object.getOwnPropertySymbols(value).length > 0)
    return { path, reason: "symbol keys are not JSON-compatible" };
  const allowed = new Set(allowedNonEnumerableProperties);
  for (const [key, descriptor] of Object.entries(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if ("get" in descriptor || "set" in descriptor)
      return {
        path: `${path}.${key}`,
        reason: "accessor properties are not portable JSON data",
      };
    if (!descriptor.enumerable && !allowed.has(key))
      return {
        path: `${path}.${key}`,
        reason: "non-enumerable properties would be omitted from JSON",
      };
  }
  return undefined;
}
