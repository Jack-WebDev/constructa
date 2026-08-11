export type JsonPrimitive = boolean | null | number | string;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type JsonArray = readonly JsonValue[];

export type JsonObject = {
  readonly [key: string]: JsonValue;
};

export const CURRENT_SCHEMA_VERSION = 1;

export const SUPPORTED_SCHEMA_VERSIONS = [CURRENT_SCHEMA_VERSION] as const;

export type SchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

export type VersionedDefinition = JsonObject & {
  readonly schemaVersion: SchemaVersion;
};

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

export function isJsonValue(value: unknown): value is JsonValue {
  return findJsonValueError(value) === undefined;
}

export function isSchemaVersion(value: unknown): value is SchemaVersion {
  return value === CURRENT_SCHEMA_VERSION;
}

export function isVersionedDefinition(
  value: unknown,
): value is VersionedDefinition {
  return (
    findSchemaVersionFailure(value) === undefined &&
    isJsonRecord(value) &&
    isJsonValue(value)
  );
}

export function assertJsonValue(
  value: unknown,
  path = "$",
): asserts value is JsonValue {
  const error = findJsonValueError(value, path);

  if (error !== undefined) {
    throw new JsonValueError(error.path, error.reason);
  }
}

export function assertSchemaVersion(
  value: unknown,
  path = "$.schemaVersion",
): asserts value is SchemaVersion {
  const failure = findSchemaVersionValueFailure(value, path);

  if (failure !== undefined) {
    throw new SchemaVersionError(failure);
  }
}

export function assertVersionedDefinition(
  value: unknown,
  path = "$",
): asserts value is VersionedDefinition {
  const failure = findSchemaVersionFailure(value, path);

  if (failure !== undefined) {
    throw new SchemaVersionError(failure);
  }

  assertJsonValue(value, path);
}

export function findJsonValueError(
  value: unknown,
  path = "$",
): { path: string; reason: string } | undefined {
  return findJsonValueErrorInternal(value, path, new Set());
}

export function findSchemaVersionFailure(
  value: unknown,
  path = "$",
): SchemaVersionFailure | undefined {
  if (!isJsonRecord(value) || !Object.hasOwn(value, "schemaVersion")) {
    return createSchemaVersionFailure("schema_version_missing", {
      path: appendPathSegment(path, "schemaVersion"),
    });
  }

  return findSchemaVersionValueFailure(
    value.schemaVersion,
    appendPathSegment(path, "schemaVersion"),
  );
}

export function findSchemaVersionValueFailure(
  value: unknown,
  path = "$.schemaVersion",
): SchemaVersionFailure | undefined {
  if (isSchemaVersion(value)) {
    return undefined;
  }

  return createSchemaVersionFailure("schema_version_unsupported", { path });
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
      if (!Number.isFinite(value)) {
        return { path, reason: "number must be finite" };
      }
      if (Object.is(value, -0)) {
        return { path, reason: "number must not be negative zero" };
      }
      return undefined;
    case "object":
      if (value === null) {
        return undefined;
      }
      return findJsonObjectError(value, path, ancestors);
    case "bigint":
    case "function":
    case "symbol":
    case "undefined":
      return { path, reason: `${typeof value} is not JSON-compatible` };
  }
}

function createSchemaVersionFailure(
  code: SchemaVersionFailureCode,
  options: { readonly path: string },
): SchemaVersionFailure {
  return {
    code,
    message:
      code === "schema_version_missing"
        ? `schemaVersion is required and must be ${CURRENT_SCHEMA_VERSION}`
        : `schemaVersion must be ${CURRENT_SCHEMA_VERSION}`,
    path: options.path,
    severity: "error",
    supportedVersions: SUPPORTED_SCHEMA_VERSIONS,
  };
}

function appendPathSegment(path: string, segment: string) {
  return path === "$" ? `$.${segment}` : `${path}.${segment}`;
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

function findJsonObjectError(
  value: object,
  path: string,
  ancestors: Set<object>,
): { path: string; reason: string } | undefined {
  if (ancestors.has(value)) {
    return { path, reason: "cyclic objects are not JSON-compatible" };
  }

  if (hasCallableToJson(value)) {
    return { path, reason: "objects with toJSON behavior are not portable" };
  }

  ancestors.add(value);
  const error = Array.isArray(value)
    ? findJsonArrayError(value, path, ancestors)
    : findJsonRecordError(value, path, ancestors);
  ancestors.delete(value);

  return error;
}

function hasCallableToJson(value: object) {
  return (
    "toJSON" in value &&
    typeof (value as { readonly toJSON?: unknown }).toJSON === "function"
  );
}

function findJsonArrayError(
  value: readonly unknown[],
  path: string,
  ancestors: Set<object>,
): { path: string; reason: string } | undefined {
  const extraProperty = Object.keys(value).find((key) => !isArrayIndexKey(key));

  if (extraProperty !== undefined) {
    return {
      path: `${path}.${extraProperty}`,
      reason: "array object properties would be omitted from JSON",
    };
  }

  const ownPropertyError = findUnsupportedOwnProperty(value, path, ["length"]);

  if (ownPropertyError !== undefined) {
    return ownPropertyError;
  }

  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) {
      return {
        path: `${path}[${index}]`,
        reason: "sparse array slots are not JSON-compatible",
      };
    }

    const itemError = findJsonValueErrorInternal(
      value[index],
      `${path}[${index}]`,
      ancestors,
    );

    if (itemError !== undefined) {
      return itemError;
    }
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

  if (prototype !== null && prototype !== Object.prototype) {
    return { path, reason: "object must be a plain JSON record" };
  }

  const ownPropertyError = findUnsupportedOwnProperty(value, path);

  if (ownPropertyError !== undefined) {
    return ownPropertyError;
  }

  for (const key of Object.keys(value)) {
    const itemError = findJsonValueErrorInternal(
      (value as Record<string, unknown>)[key],
      `${path}.${key}`,
      ancestors,
    );

    if (itemError !== undefined) {
      return itemError;
    }
  }

  return undefined;
}

function findUnsupportedOwnProperty(
  value: object,
  path: string,
  allowedNonEnumerableProperties: readonly string[] = [],
): { path: string; reason: string } | undefined {
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return { path, reason: "symbol keys are not JSON-compatible" };
  }

  const allowedNonEnumerable = new Set(allowedNonEnumerableProperties);
  const descriptors = Object.getOwnPropertyDescriptors(value);

  for (const [key, descriptor] of Object.entries(descriptors)) {
    if ("get" in descriptor || "set" in descriptor) {
      return {
        path: `${path}.${key}`,
        reason: "accessor properties are not portable JSON data",
      };
    }

    if (!descriptor.enumerable && !allowedNonEnumerable.has(key)) {
      return {
        path: `${path}.${key}`,
        reason: "non-enumerable properties would be omitted from JSON",
      };
    }
  }

  return undefined;
}
