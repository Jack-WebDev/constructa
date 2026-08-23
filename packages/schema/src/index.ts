/** A JSON scalar value supported by Constructa documents. */
export type JsonPrimitive = boolean | null | number | string;
/** Any portable JSON value supported by Constructa documents. */
export type JsonValue = JsonArray | JsonObject | JsonPrimitive;
/** A readonly array of portable JSON values. */
export type JsonArray = readonly JsonValue[];
/** A readonly string-keyed record of portable JSON values. */
export type JsonObject = { readonly [key: string]: JsonValue };

/** One property or array-index segment in a validation path. */
export type ValidationPathSegment = string | number;
/** The location of a validation issue inside a portable value. */
export type ValidationPath = readonly ValidationPathSegment[];
/** A stable, machine-readable validation failure. */
export type ValidationIssue = {
  readonly code: string;
  readonly path: ValidationPath;
  readonly message: string;
  readonly details?: JsonObject;
};

/** The supported categories for safe Constructa errors. */
export const CONSTRUCTA_ERROR_KINDS = [
  "configuration",
  "dependency",
  "execution",
  "system",
] as const;
/** A supported category for a safe Constructa error. */
export type ConstructaErrorKind = (typeof CONSTRUCTA_ERROR_KINDS)[number];

/** Error codes reserved by Constructa's public error contract. */
export const RESERVED_CONSTRUCTA_ERROR_CODES = [
  "INVALID_RANGE",
  "EMPTY_CHOICE",
  "INVALID_LENGTH",
  "UNKNOWN_GENERATOR",
  "REFERENCE_NOT_FOUND",
  "CIRCULAR_REFERENCE",
  "EXECUTION_FAILED",
  "UNSUPPORTED_SCHEMA_VERSION",
  "INVALID_CONFIGURATION",
  "INVALID_JSON_VALUE",
] as const;
/** An uppercase, stable error code. */
export type ConstructaErrorCode = Uppercase<string>;

/** Data used to construct a safe Constructa error. */
export type ConstructaErrorOptions = {
  readonly kind: ConstructaErrorKind;
  readonly code: ConstructaErrorCode;
  readonly path: ValidationPath;
  readonly message: string;
  readonly details?: JsonObject;
};

/** The serializable representation of a Constructa error. */
export type SafeConstructaError = ConstructaErrorOptions;

/** A safe, serializable error shared by every Constructa surface. */
export class ConstructaError extends TypeError {
  readonly kind: ConstructaErrorKind;
  readonly code: ConstructaErrorCode;
  readonly path: ValidationPath;
  readonly details?: JsonObject;
  readonly #cause: unknown;

  constructor(options: ConstructaErrorOptions, cause?: unknown) {
    validateConstructaErrorOptions(options);
    super(options.message);
    this.name = "ConstructaError";
    this.kind = options.kind;
    this.code = options.code;
    this.path = options.path;
    this.details = options.details;
    this.#cause = cause;
  }

  /** Returns only data that is safe to send across a process or network boundary. */
  toJSON(): SafeConstructaError {
    return this.details === undefined
      ? {
          kind: this.kind,
          code: this.code,
          path: this.path,
          message: this.message,
        }
      : {
          kind: this.kind,
          code: this.code,
          path: this.path,
          message: this.message,
          details: this.details,
        };
  }

  hasCause(): boolean {
    return this.#cause !== undefined;
  }
}

/** Creates a known safe error without retaining an underlying cause. */
export function createConstructaError(
  options: ConstructaErrorOptions,
): ConstructaError {
  return new ConstructaError(options);
}

/** Returns a Constructa error, wrapping an unknown cause when necessary. */
export function normalizeConstructaError(
  cause: unknown,
  options: ConstructaErrorOptions,
): ConstructaError {
  return cause instanceof ConstructaError
    ? cause
    : new ConstructaError(options, cause);
}

/** The schema version emitted by this release. */
export const CURRENT_SCHEMA_VERSION = 1;
/** All document schema versions accepted by this release. */
export const SUPPORTED_SCHEMA_VERSIONS = [CURRENT_SCHEMA_VERSION] as const;
/** A supported document schema version. */
export type SchemaVersion = (typeof SUPPORTED_SCHEMA_VERSIONS)[number];

declare const generatorOutput: unique symbol;

/**
 * Portable executable generator data. `Output` exists only to carry compile-time
 * inference and never creates a runtime property.
 */
export type GeneratorDefinition<Output = unknown> = JsonObject & {
  readonly type: string;
  readonly [generatorOutput]?: Output;
};

/** Infers a generator definition's output type. */
export type Infer<Definition> =
  Definition extends GeneratorDefinition<infer Output> ? Output : never;

/** Versioned document containing exactly one root generator definition. */
export type GeneratorDocumentV1 = {
  readonly schemaVersion: 1;
  readonly definition: GeneratorDefinition;
  readonly name?: string;
  readonly description?: string;
};

/** A document in any schema version currently supported by Constructa. */
export type GeneratorDocument = GeneratorDocumentV1;

/** An explicit one-step migration into a supported document schema version. */
export type DocumentMigration = {
  readonly from: number;
  readonly to: SchemaVersion;
  readonly migrate: (document: JsonObject) => unknown;
};

/** Reusable portable definitions for serialization and integration fixtures. */
/** Reusable portable definitions for serialization and integration fixtures. */
export const SERIALIZATION_DEFINITION_FIXTURES: readonly GeneratorDefinition[] =
  Object.freeze([
    Object.freeze({ type: "boolean" }) as GeneratorDefinition,
    Object.freeze({
      type: "object",
      fields: Object.freeze({
        account: Object.freeze({
          type: "object",
          fields: Object.freeze({
            id: Object.freeze({ type: "integer", min: 1 }),
          }),
        }),
      }),
    }) as GeneratorDefinition,
  ]);

/** Reusable versioned documents for serialization and integration fixtures. */
export const SERIALIZATION_DOCUMENT_FIXTURES: readonly GeneratorDocumentV1[] =
  Object.freeze([
    Object.freeze({
      schemaVersion: 1,
      definition: SERIALIZATION_DEFINITION_FIXTURES[0] as GeneratorDefinition,
    }) as GeneratorDocumentV1,
    Object.freeze({
      schemaVersion: 1,
      name: "Small integer",
      description: "An integer in a bounded range.",
      definition: Object.freeze({ type: "integer", min: 1, max: 100 }),
    }) as GeneratorDocumentV1,
  ]);

/** A stable, lowercase identifier used by generator metadata. */
export type SemanticMetadataId = string;

/** A coarse semantic category for a generator's output. */
export type GeneratorOutputCategory = SemanticMetadataId;

/**
 * Portable, descriptive metadata for a generator implementation.
 * It is intentionally separate from executable generator definitions.
 */
export type GeneratorMetadata = {
  readonly typeId?: SemanticMetadataId;
  readonly displayName?: string;
  readonly description?: string;
  readonly category?: SemanticMetadataId;
  readonly outputCategory?: GeneratorOutputCategory;
  readonly documentationUrl?: string;
  readonly examples?: readonly JsonValue[];
};

/** The allowed top-level keys of a versioned generator document. */
export const GENERATOR_DOCUMENT_TOP_LEVEL_KEYS = [
  "schemaVersion",
  "name",
  "description",
  "definition",
] as const;

/** The allowed keys of portable generator metadata. */
export const GENERATOR_METADATA_KEYS = [
  "typeId",
  "displayName",
  "description",
  "category",
  "outputCategory",
  "documentationUrl",
  "examples",
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

/** Codes emitted when a document schema version cannot be accepted. */
export type SchemaVersionFailureCode =
  | "schema_version_missing"
  | "schema_version_unsupported";
/** Details of an unsupported or missing schema-version failure. */
export type SchemaVersionFailure = {
  readonly code: SchemaVersionFailureCode;
  readonly message: string;
  readonly path: ValidationPath;
  readonly severity: "error";
  readonly details: { readonly supportedVersions: readonly SchemaVersion[] };
} & ValidationIssue;

/** Codes emitted while validating a generator definition. */
export type GeneratorDefinitionFailureCode =
  | "generator_definition_not_json"
  | "generator_definition_not_object"
  | "generator_type_missing"
  | "generator_type_invalid"
  | "definition_document_metadata";
/** Details of a generator-definition validation failure. */
export type GeneratorDefinitionFailure = {
  readonly code: GeneratorDefinitionFailureCode;
  readonly message: string;
  readonly path: ValidationPath;
  readonly severity: "error";
};

/** Codes emitted while validating portable generator metadata. */
export type GeneratorMetadataFailureCode =
  | "generator_metadata_not_json"
  | "generator_metadata_not_object"
  | "metadata_type_id_invalid"
  | "metadata_display_name_invalid"
  | "metadata_description_invalid"
  | "metadata_category_invalid"
  | "metadata_output_category_invalid"
  | "metadata_documentation_url_invalid"
  | "metadata_examples_invalid"
  | "metadata_property_unknown";
/** Details of a generator-metadata validation failure. */
export type GeneratorMetadataFailure = {
  readonly code: GeneratorMetadataFailureCode;
  readonly message: string;
  readonly path: ValidationPath;
  readonly severity: "error";
};

/** Codes emitted while validating a versioned generator document. */
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
/** Details of a generator-document validation failure. */
export type GeneratorDocumentFailure =
  | SchemaVersionFailure
  | {
      readonly code: Exclude<
        GeneratorDocumentFailureCode,
        SchemaVersionFailureCode
      >;
      readonly message: string;
      readonly path: ValidationPath;
      readonly severity: "error";
    };
/** The success-or-failure result returned by `safeParseDocument`. */
export type GeneratorDocumentParseResult =
  | { readonly success: true; readonly value: GeneratorDocumentV1 }
  | { readonly success: false; readonly failure: GeneratorDocumentFailure };

/** Thrown when a value cannot be represented as portable JSON. */
export class JsonValueError extends ConstructaError {
  readonly issue: ValidationIssue;
  constructor(path: ValidationPath, reason: string) {
    super({
      kind: "configuration",
      code: "INVALID_JSON_VALUE",
      path,
      message: reason,
      details: { issueCode: "invalid_json_value" },
    });
    this.name = "JsonValueError";
    this.issue = { code: "invalid_json_value", path, message: reason };
  }
}

/** Thrown when a document's schema version is unsupported. */
export class SchemaVersionError extends ConstructaError {
  readonly failure: SchemaVersionFailure;
  constructor(failure: SchemaVersionFailure) {
    super({
      kind: "configuration",
      code: "UNSUPPORTED_SCHEMA_VERSION",
      path: failure.path,
      message: failure.message,
      details: { issueCode: failure.code },
    });
    this.name = "SchemaVersionError";
    this.failure = failure;
  }
}

/** Thrown when a generator definition is invalid. */
export class GeneratorDefinitionError extends ConstructaError {
  readonly failure: GeneratorDefinitionFailure;
  constructor(failure: GeneratorDefinitionFailure) {
    super({
      kind: "configuration",
      code: "INVALID_CONFIGURATION",
      path: failure.path,
      message: failure.message,
      details: { issueCode: failure.code },
    });
    this.name = "GeneratorDefinitionError";
    this.failure = failure;
  }
}

/** Thrown when portable generator metadata is invalid. */
export class GeneratorMetadataError extends ConstructaError {
  readonly failure: GeneratorMetadataFailure;
  constructor(failure: GeneratorMetadataFailure) {
    super({
      kind: "configuration",
      code: "INVALID_CONFIGURATION",
      path: failure.path,
      message: failure.message,
      details: { issueCode: failure.code },
    });
    this.name = "GeneratorMetadataError";
    this.failure = failure;
  }
}

/** Thrown when a versioned generator document is invalid. */
export class GeneratorDocumentError extends ConstructaError {
  readonly failure: GeneratorDocumentFailure;
  constructor(failure: GeneratorDocumentFailure) {
    super({
      kind: "configuration",
      code: "INVALID_CONFIGURATION",
      path: failure.path,
      message: failure.message,
      details: { issueCode: failure.code },
    });
    this.name = "GeneratorDocumentError";
    this.failure = failure;
  }
}

/** Returns whether a value is portable JSON. */
export function isJsonValue(value: unknown): value is JsonValue {
  return validateJsonValue(value).length === 0;
}
/** Returns whether a value is a schema version supported by this release. */
export function isSchemaVersion(value: unknown): value is SchemaVersion {
  return value === CURRENT_SCHEMA_VERSION;
}
/** Returns whether a value is a valid portable generator definition. */
export function isGeneratorDefinition(
  value: unknown,
): value is GeneratorDefinition {
  return validateGeneratorDefinition(value).length === 0;
}
/** Returns whether a value is a valid current generator document. */
export function isDocument(value: unknown): value is GeneratorDocumentV1 {
  return validateDocument(value).length === 0;
}
/** Returns whether a value is valid portable generator metadata. */
export function isGeneratorMetadata(
  value: unknown,
): value is GeneratorMetadata {
  return validateGeneratorMetadata(value).length === 0;
}
/** Asserts that a value is portable JSON. */
export function assertJsonValue(
  value: unknown,
  path: ValidationPath = [],
): asserts value is JsonValue {
  const [issue] = validateJsonValue(value, path);
  if (issue !== undefined) throw new JsonValueError(issue.path, issue.message);
}
/** Asserts that a value is a supported schema version. */
export function assertSchemaVersion(
  value: unknown,
  path: ValidationPath = ["schemaVersion"],
): asserts value is SchemaVersion {
  const failure = findSchemaVersionValueFailure(value, path);
  if (failure !== undefined) throw new SchemaVersionError(failure);
}
/** Asserts that a value is a valid portable generator definition. */
export function assertGeneratorDefinition(
  value: unknown,
  path: ValidationPath = [],
): asserts value is GeneratorDefinition {
  const [failure] = validateGeneratorDefinition(value, path);
  if (failure !== undefined) throw new GeneratorDefinitionError(failure);
}
/** Asserts that a value is valid portable generator metadata. */
export function assertGeneratorMetadata(
  value: unknown,
  path: ValidationPath = [],
): asserts value is GeneratorMetadata {
  const [failure] = validateGeneratorMetadata(value, path);
  if (failure !== undefined) throw new GeneratorMetadataError(failure);
}
/** Asserts that a value is a valid current generator document. */
export function assertDocument(
  value: unknown,
  path: ValidationPath = [],
): asserts value is GeneratorDocumentV1 {
  const [issue] = validateDocument(value, path);
  if (issue !== undefined) throw new GeneratorDocumentError(issue);
}
/** Parses a document or throws its first validation failure. */
export function parseDocument(
  value: unknown,
  path: ValidationPath = [],
): GeneratorDocumentV1 {
  const parser = resolveDocumentParser(value, path);
  return parser(value, path);
}
/** Validates a document without throwing. */
export function safeParseDocument(
  value: unknown,
  path: ValidationPath = [],
): GeneratorDocumentParseResult {
  const [failure] = validateDocument(value, path);
  return failure === undefined
    ? { success: true, value: value as GeneratorDocumentV1 }
    : { success: false, failure };
}

/**
 * Applies one declared migration and validates its result through the normal
 * version parser. Migrations are never applied implicitly by `parseDocument`.
 */
export function migrateDocument(
  value: unknown,
  migration: DocumentMigration,
): GeneratorDocumentV1 {
  assertDocumentMigration(migration);
  assertJsonValue(value);
  if (!isJsonRecord(value)) {
    throw new GeneratorDocumentError(
      documentFailure("generator_document_not_object", []),
    );
  }
  const sourceVersion = value.schemaVersion;
  if (
    !Number.isSafeInteger(sourceVersion) ||
    sourceVersion !== migration.from
  ) {
    throw new SchemaVersionError({
      code: "schema_version_unsupported",
      path: ["schemaVersion"],
      severity: "error",
      message: `schemaVersion must be ${migration.from} before this migration.`,
      details: { supportedVersions: [migration.to] },
    });
  }

  const source = JSON.parse(JSON.stringify(value)) as JsonObject;
  let migrated: unknown;
  try {
    migrated = migration.migrate(source);
  } catch (cause) {
    throw normalizeConstructaError(cause, {
      kind: "configuration",
      code: "INVALID_CONFIGURATION",
      path: ["migration"],
      message: "Document migration failed.",
    });
  }
  return parseDocument(migrated);
}

type DocumentParser = (
  value: unknown,
  path: ValidationPath,
) => GeneratorDocumentV1;

const DOCUMENT_PARSERS: ReadonlyMap<SchemaVersion, DocumentParser> = new Map([
  [CURRENT_SCHEMA_VERSION, parseCurrentDocument],
]);

function resolveDocumentParser(
  value: unknown,
  path: ValidationPath,
): DocumentParser {
  if (!isJsonRecord(value) || !Object.hasOwn(value, "schemaVersion")) {
    assertDocument(value, path);
    throw new ConstructaError({
      kind: "system",
      code: "INVALID_CONFIGURATION",
      path,
      message:
        "Document validation unexpectedly succeeded without a schema version.",
    });
  }
  const parser = DOCUMENT_PARSERS.get(value.schemaVersion as SchemaVersion);
  if (parser === undefined) {
    const failure = findSchemaVersionValueFailure(
      value.schemaVersion,
      appendPathSegment(path, "schemaVersion"),
    );
    if (failure !== undefined) throw new SchemaVersionError(failure);
  }
  return parser ?? parseCurrentDocument;
}

function parseCurrentDocument(
  value: unknown,
  path: ValidationPath,
): GeneratorDocumentV1 {
  assertDocument(value, path);
  return value;
}

function assertDocumentMigration(migration: DocumentMigration): void {
  if (
    typeof migration !== "object" ||
    migration === null ||
    !Number.isSafeInteger(migration.from) ||
    migration.from < 0 ||
    !isSchemaVersion(migration.to) ||
    typeof migration.migrate !== "function"
  ) {
    throw new ConstructaError({
      kind: "configuration",
      code: "INVALID_CONFIGURATION",
      path: ["migration"],
      message:
        "A migration must declare a non-negative source version, a supported target version, and a migrate function.",
    });
  }
}

/**
 * Serializes a portable definition with recursively sorted object keys and a
 * trailing newline. The result is intended for stable diffs, not execution.
 */
export function serializeDefinition(value: unknown): string {
  assertGeneratorDefinition(value);
  return serializeCanonicalJson(value);
}

/** Serializes a validated versioned document using the same canonical format. */
export function serializeDocument(value: unknown): string {
  assertDocument(value);
  return serializeCanonicalJson(value);
}

function serializeCanonicalJson(value: JsonValue): string {
  return `${JSON.stringify(canonicalizeJson(value), null, 2)}\n`;
}

function canonicalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (isJsonRecord(value)) {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalizeJson(value[key] as JsonValue);
    }
    return result;
  }
  return value;
}

/** Returns the validation issue when a value is not portable JSON. */
export function validateJsonValue(
  value: unknown,
  path: ValidationPath = [],
): readonly ValidationIssue[] {
  const error = findJsonValueError(value, path);
  return error === undefined
    ? []
    : [{ code: "invalid_json_value", path: error.path, message: error.reason }];
}

function findJsonValueError(
  value: unknown,
  path: ValidationPath,
): { path: ValidationPath; reason: string } | undefined {
  return findJsonValueErrorInternal(value, path, new Set());
}

/** Returns all independent document validation issues in deterministic order. */
export function validateDocument(
  value: unknown,
  path: ValidationPath = [],
): readonly GeneratorDocumentFailure[] {
  const jsonError = findJsonValueError(value, path);
  if (jsonError !== undefined) {
    return [
      documentFailure(
        "generator_document_not_json",
        jsonError.path,
        jsonError.reason,
      ),
    ];
  }
  if (!isJsonRecord(value)) {
    return [documentFailure("generator_document_not_object", path)];
  }

  const issues: GeneratorDocumentFailure[] = [];
  if (Object.hasOwn(value, "configuration") && Object.hasOwn(value, "type")) {
    issues.push(documentFailure("configuration_envelope_removed", path));
  }
  for (const key of Object.keys(value)) {
    if (!GENERATOR_DOCUMENT_TOP_LEVEL_KEYS.includes(key as never)) {
      issues.push(
        documentFailure(
          "top_level_property_unknown",
          appendPathSegment(path, key),
          `Unknown top-level property: ${key}`,
        ),
      );
    }
  }

  const versionFailure = findSchemaVersionFailure(value, path);
  if (versionFailure !== undefined) issues.push(versionFailure);
  for (const property of ["name", "description"] as const) {
    if (Object.hasOwn(value, property) && typeof value[property] !== "string") {
      issues.push(
        documentFailure(
          property === "name" ? "name_invalid" : "description_invalid",
          appendPathSegment(path, property),
        ),
      );
    }
  }
  if (!Object.hasOwn(value, "definition")) {
    issues.push(
      documentFailure(
        "definition_missing",
        appendPathSegment(path, "definition"),
      ),
    );
  } else {
    issues.push(
      ...validateGeneratorDefinition(
        value.definition,
        appendPathSegment(path, "definition"),
      ),
    );
  }
  return issues;
}

/** Returns definition issues. Nested typed definitions are validated recursively. */
export function validateGeneratorDefinition(
  value: unknown,
  path: ValidationPath = [],
): readonly GeneratorDefinitionFailure[] {
  const jsonError = findJsonValueError(value, path);
  if (jsonError !== undefined) {
    return [
      definitionFailure(
        "generator_definition_not_json",
        jsonError.path,
        jsonError.reason,
      ),
    ];
  }
  if (!isJsonRecord(value)) {
    return [definitionFailure("generator_definition_not_object", path)];
  }

  const issues: GeneratorDefinitionFailure[] = [];
  collectDefinitionMetadataIssues(value as JsonObject, path, issues, true);
  return issues;
}
/** Returns metadata validation failures without throwing. */
export function validateGeneratorMetadata(
  value: unknown,
  path: ValidationPath = [],
): readonly GeneratorMetadataFailure[] {
  const failure = findGeneratorMetadataFailure(value, path);
  return failure === undefined ? [] : [failure];
}

function findGeneratorMetadataFailure(
  value: unknown,
  path: ValidationPath = [],
): GeneratorMetadataFailure | undefined {
  const jsonError = findJsonValueError(value, path);
  if (jsonError !== undefined) {
    return metadataFailure(
      "generator_metadata_not_json",
      jsonError.path,
      jsonError.reason,
    );
  }
  if (!isJsonRecord(value)) {
    return metadataFailure("generator_metadata_not_object", path);
  }

  const unknownKey = Object.keys(value).find(
    (key) => !GENERATOR_METADATA_KEYS.includes(key as never),
  );
  if (unknownKey !== undefined) {
    return metadataFailure(
      "metadata_property_unknown",
      appendPathSegment(path, unknownKey),
      `Unknown metadata property: ${unknownKey}`,
    );
  }

  for (const property of ["typeId", "category", "outputCategory"] as const) {
    if (
      Object.hasOwn(value, property) &&
      (typeof value[property] !== "string" || !isMetadataId(value[property]))
    ) {
      const code =
        property === "typeId"
          ? "metadata_type_id_invalid"
          : property === "category"
            ? "metadata_category_invalid"
            : "metadata_output_category_invalid";
      return metadataFailure(code, appendPathSegment(path, property));
    }
  }

  for (const property of [
    "displayName",
    "description",
    "documentationUrl",
  ] as const) {
    if (Object.hasOwn(value, property) && typeof value[property] !== "string") {
      const code =
        property === "displayName"
          ? "metadata_display_name_invalid"
          : property === "description"
            ? "metadata_description_invalid"
            : "metadata_documentation_url_invalid";
      return metadataFailure(code, appendPathSegment(path, property));
    }
  }

  if (Object.hasOwn(value, "examples") && !Array.isArray(value.examples)) {
    return metadataFailure(
      "metadata_examples_invalid",
      appendPathSegment(path, "examples"),
    );
  }

  return undefined;
}
function findSchemaVersionFailure(
  value: unknown,
  path: ValidationPath = [],
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
function findSchemaVersionValueFailure(
  value: unknown,
  path: ValidationPath = ["schemaVersion"],
): SchemaVersionFailure | undefined {
  return isSchemaVersion(value)
    ? undefined
    : createSchemaVersionFailure("schema_version_unsupported", path);
}

function createSchemaVersionFailure(
  code: SchemaVersionFailureCode,
  path: ValidationPath,
): SchemaVersionFailure {
  return {
    code,
    message:
      code === "schema_version_missing"
        ? `schemaVersion is required and must be ${CURRENT_SCHEMA_VERSION}`
        : `schemaVersion must be ${CURRENT_SCHEMA_VERSION}`,
    path,
    severity: "error",
    details: { supportedVersions: SUPPORTED_SCHEMA_VERSIONS },
  };
}
function definitionFailure(
  code: GeneratorDefinitionFailureCode,
  path: ValidationPath,
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
function metadataFailure(
  code: GeneratorMetadataFailureCode,
  path: ValidationPath,
  message?: string,
): GeneratorMetadataFailure {
  const messages: Record<GeneratorMetadataFailureCode, string> = {
    generator_metadata_not_json:
      "generator metadata must be portable JSON data",
    generator_metadata_not_object: "generator metadata must be a JSON object",
    metadata_type_id_invalid: "typeId must be a stable metadata ID",
    metadata_display_name_invalid: "displayName must be a string when present",
    metadata_description_invalid: "description must be a string when present",
    metadata_category_invalid: "category must be a stable metadata ID",
    metadata_output_category_invalid:
      "outputCategory must be a stable metadata ID",
    metadata_documentation_url_invalid:
      "documentationUrl must be a string when present",
    metadata_examples_invalid: "examples must be an array when present",
    metadata_property_unknown: "unknown metadata properties are not allowed",
  };
  return { code, message: message ?? messages[code], path, severity: "error" };
}
function documentFailure(
  code: Exclude<GeneratorDocumentFailureCode, SchemaVersionFailureCode>,
  path: ValidationPath,
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
function appendPathSegment(
  path: ValidationPath,
  segment: ValidationPathSegment,
): ValidationPath {
  return [...path, segment];
}

function validateConstructaErrorOptions(options: ConstructaErrorOptions): void {
  if (!CONSTRUCTA_ERROR_KINDS.includes(options.kind)) {
    throw new TypeError("kind must be a Constructa error kind");
  }
  if (!/^[A-Z][A-Z0-9_]*$/u.test(options.code)) {
    throw new TypeError("code must be an uppercase stable error code");
  }
  if (typeof options.message !== "string" || options.message.length === 0) {
    throw new TypeError("message must be a non-empty string");
  }
  for (const segment of options.path) {
    if (
      typeof segment !== "string" &&
      (typeof segment !== "number" || !Number.isSafeInteger(segment))
    ) {
      throw new TypeError("path segments must be strings or safe integers");
    }
  }
  if (
    options.details !== undefined &&
    (!isJsonRecord(options.details) || !isJsonValue(options.details))
  ) {
    throw new TypeError("details must be a portable JSON object");
  }
}

function isMetadataId(value: string) {
  return /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value);
}

function collectDefinitionMetadataIssues(
  value: JsonObject,
  path: ValidationPath,
  issues: GeneratorDefinitionFailure[],
  isDefinition: boolean,
): void {
  if (isDefinition) {
    if (!Object.hasOwn(value, "type")) {
      issues.push(
        definitionFailure(
          "generator_type_missing",
          appendPathSegment(path, "type"),
        ),
      );
    } else if (
      typeof value.type !== "string" ||
      value.type.trim().length === 0
    ) {
      issues.push(
        definitionFailure(
          "generator_type_invalid",
          appendPathSegment(path, "type"),
        ),
      );
    }
    for (const key of Object.keys(value)) {
      if (key !== "type" && DOCUMENT_METADATA_KEYS.has(key)) {
        issues.push(
          definitionFailure(
            "definition_document_metadata",
            appendPathSegment(path, key),
          ),
        );
      }
    }
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "type") continue;
    collectNestedDefinitionMetadataIssues(
      child,
      appendPathSegment(path, key),
      issues,
    );
  }
}

function collectNestedDefinitionMetadataIssues(
  value: JsonValue,
  path: ValidationPath,
  issues: GeneratorDefinitionFailure[],
): void {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      collectNestedDefinitionMetadataIssues(
        value[index],
        appendPathSegment(path, index),
        issues,
      );
    }
    return;
  }
  if (!isJsonRecord(value)) return;
  collectDefinitionMetadataIssues(
    value,
    path,
    issues,
    Object.hasOwn(value, "type"),
  );
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
  path: ValidationPath,
  ancestors: Set<object>,
): { path: ValidationPath; reason: string } | undefined {
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
  path: ValidationPath,
  ancestors: Set<object>,
): { path: ValidationPath; reason: string } | undefined {
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
  path: ValidationPath,
  ancestors: Set<object>,
): { path: ValidationPath; reason: string } | undefined {
  const extraProperty = Object.keys(value).find((key) => !isArrayIndexKey(key));
  if (extraProperty !== undefined)
    return {
      path: appendPathSegment(path, extraProperty),
      reason: "array object properties would be omitted from JSON",
    };
  const propertyError = findUnsupportedOwnProperty(value, path, ["length"]);
  if (propertyError !== undefined) return propertyError;
  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value))
      return {
        path: appendPathSegment(path, index),
        reason: "sparse array slots are not JSON-compatible",
      };
    const itemError = findJsonValueErrorInternal(
      value[index],
      appendPathSegment(path, index),
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
  path: ValidationPath,
  ancestors: Set<object>,
): { path: ValidationPath; reason: string } | undefined {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype)
    return { path, reason: "object must be a plain JSON record" };
  const propertyError = findUnsupportedOwnProperty(value, path);
  if (propertyError !== undefined) return propertyError;
  for (const key of Object.keys(value)) {
    const itemError = findJsonValueErrorInternal(
      (value as Record<string, unknown>)[key],
      appendPathSegment(path, key),
      ancestors,
    );
    if (itemError !== undefined) return itemError;
  }
  return undefined;
}
function findUnsupportedOwnProperty(
  value: object,
  path: ValidationPath,
  allowedNonEnumerableProperties: readonly string[] = [],
): { path: ValidationPath; reason: string } | undefined {
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
        path: appendPathSegment(path, key),
        reason: "accessor properties are not portable JSON data",
      };
    if (!descriptor.enumerable && !allowed.has(key))
      return {
        path: appendPathSegment(path, key),
        reason: "non-enumerable properties would be omitted from JSON",
      };
  }
  return undefined;
}
