import {
  type GeneratorDocumentV1,
  safeParseDocument,
  type ValidationPath,
} from "constructa-sdk";

/** A stable, web-only identity for a builder document or definition node. */
export type BuilderUiId = string;

/** A generator definition's location within its enclosing portable document. */
export type BuilderDefinitionIdentity = {
  readonly id: BuilderUiId;
  readonly path: ValidationPath;
};

/**
 * Component-independent builder state. The raw document stays separate from
 * UI identities so drafts can preserve incomplete values without exporting UI
 * metadata as generator data.
 */
export type BuilderDocumentDraft = {
  readonly id: BuilderUiId;
  readonly document: unknown;
  readonly definitionIdentities: readonly BuilderDefinitionIdentity[];
};

/** A safe, shared error projection for a draft that cannot become a document. */
export type BuilderDraftError = {
  readonly code: string;
  readonly kind: string;
  readonly message: string;
  readonly path: ValidationPath;
};

/** The result of explicitly converting builder state into a portable document. */
export type BuilderDocumentConversion =
  | { readonly success: true; readonly document: GeneratorDocumentV1 }
  | { readonly success: false; readonly errors: readonly BuilderDraftError[] };

/** Editable document-only metadata. Nested definitions never receive it. */
export type BuilderDocumentIdentity = {
  readonly description?: unknown;
  readonly name?: unknown;
};

/** The result of changing a document identity draft. */
export type BuilderIdentityUpdate =
  | { readonly success: true; readonly draft: BuilderDocumentDraft }
  | { readonly success: false; readonly error: BuilderDraftError };

/** A root object field represented by the builder state model. */
export type BuilderFieldDraft = {
  readonly definition: unknown;
  readonly id: BuilderUiId;
  readonly name: string;
  readonly path: ValidationPath;
};

/** The result of adding one safe default field to the root object. */
export type BuilderFieldAdd =
  | {
      readonly success: true;
      readonly draft: BuilderDocumentDraft;
      readonly field: BuilderFieldDraft;
    }
  | { readonly success: false; readonly error: BuilderDraftError };

export type CreateBuilderDraftOptions = {
  /** Supplies deterministic IDs for tests or application-owned state stores. */
  readonly createId?: () => BuilderUiId;
};

let nextBuilderId = 0;

/** Creates editable state while leaving the supplied draft value untouched. */
export function createBuilderDraft(
  document: unknown,
  options?: CreateBuilderDraftOptions,
): BuilderDocumentDraft {
  return buildBuilderDraft(document, createIdFactory(options));
}

/**
 * Replaces a draft document while keeping IDs for definition paths that still
 * exist. Callers can therefore update values without tying React keys to data.
 */
export function replaceBuilderDraftDocument(
  draft: BuilderDocumentDraft,
  document: unknown,
  options?: CreateBuilderDraftOptions,
): BuilderDocumentDraft {
  const existingIds = new Map(
    draft.definitionIdentities.map((identity) => [
      pathKey(identity.path),
      identity.id,
    ]),
  );
  const createId = createIdFactory(options, [
    draft.id,
    ...draft.definitionIdentities.map((identity) => identity.id),
  ]);
  return buildBuilderDraft(
    document,
    (path) => {
      return existingIds.get(pathKey(path)) ?? createId(path);
    },
    draft.id,
  );
}

/** Returns the stable UI identity assigned to a definition path, when present. */
export function getBuilderDefinitionId(
  draft: BuilderDocumentDraft,
  path: ValidationPath,
): BuilderUiId | undefined {
  return draft.definitionIdentities.find((identity) =>
    pathsEqual(identity.path, path),
  )?.id;
}

/** Returns the raw document-level identity values without inspecting definitions. */
export function getBuilderDocumentIdentity(
  draft: BuilderDocumentDraft,
): BuilderDocumentIdentity {
  const document = asRecord(draft?.document);
  if (document === undefined) return {};
  return {
    ...(Object.hasOwn(document, "name") ? { name: document.name } : {}),
    ...(Object.hasOwn(document, "description")
      ? { description: document.description }
      : {}),
  };
}

/**
 * Updates top-level document identity while preserving incomplete values for
 * shared validation during conversion. Supplying `undefined` clears a field.
 */
export function updateBuilderDocumentIdentity(
  draft: BuilderDocumentDraft,
  identity: BuilderDocumentIdentity,
): BuilderIdentityUpdate {
  const document = asRecord(draft?.document);
  if (document === undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "Builder identity requires a document object.",
        path: [],
      },
    };
  }

  const updatedDocument = { ...document };
  updateIdentityProperty(updatedDocument, identity, "name");
  updateIdentityProperty(updatedDocument, identity, "description");
  return {
    success: true,
    draft: replaceBuilderDraftDocument(draft, updatedDocument),
  };
}

/** Returns root object fields in their portable declaration order. */
export function getBuilderFields(
  draft: BuilderDocumentDraft,
): readonly BuilderFieldDraft[] {
  const fields = getRootObjectFields(draft?.document);
  if (fields === undefined) return [];
  return Object.entries(fields).flatMap(([name, definition]) => {
    const path = ["definition", "fields", name];
    const id = getBuilderDefinitionId(draft, path);
    return id === undefined ? [] : [{ definition, id, name, path }];
  });
}

/**
 * Adds a configuration-free Boolean field to the root object. The generated
 * name is unique and the new definition receives its own web-only identity.
 */
export function addBuilderField(
  draft: BuilderDocumentDraft,
  options?: CreateBuilderDraftOptions,
): BuilderFieldAdd {
  const document = asRecord(draft?.document);
  const definition =
    document === undefined ? undefined : asRecord(document.definition);
  const fields =
    definition === undefined ? undefined : asRecord(definition.fields);
  if (
    document === undefined ||
    definition?.type !== "object" ||
    fields === undefined
  ) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "Fields can only be added to an object generator.",
        path: ["definition"],
      },
    };
  }

  const name = nextFieldName(fields);
  const updatedDocument = {
    ...document,
    definition: {
      ...definition,
      fields: { ...fields, [name]: { type: "boolean" } },
    },
  };
  const nextDraft = replaceBuilderDraftDocument(
    draft,
    updatedDocument,
    options,
  );
  const path = ["definition", "fields", name];
  const id = getBuilderDefinitionId(nextDraft, path);
  if (id === undefined) {
    return {
      success: false,
      error: {
        code: "SYSTEM_ERROR",
        kind: "system",
        message: "Unable to create a field identity.",
        path,
      },
    };
  }
  return {
    success: true,
    draft: nextDraft,
    field: { definition: { type: "boolean" }, id, name, path },
  };
}

/**
 * Validates the raw draft through the SDK's canonical parser without mutating
 * it. UI-only identities are deliberately excluded from the portable output.
 */
export function toGeneratorDocument(
  draft: BuilderDocumentDraft,
): BuilderDocumentConversion {
  const result = safeParseDocument(draft?.document);
  if (result.success) return { success: true, document: result.value };
  return {
    success: false,
    errors: result.issues.map((error) => ({
      code: error.code,
      kind: error.kind,
      message: error.message,
      path: error.path,
    })),
  };
}

function buildBuilderDraft(
  document: unknown,
  createId: (path: ValidationPath) => BuilderUiId,
  id: BuilderUiId = createId([]),
): BuilderDocumentDraft {
  const definitionIdentities: BuilderDefinitionIdentity[] = [];
  const documentRecord = asRecord(document);
  if (
    documentRecord !== undefined &&
    Object.hasOwn(documentRecord, "definition")
  ) {
    collectDefinitionIdentities(
      documentRecord.definition,
      ["definition"],
      definitionIdentities,
      createId,
    );
  }
  return { id, document, definitionIdentities };
}

function collectDefinitionIdentities(
  definition: unknown,
  path: ValidationPath,
  identities: BuilderDefinitionIdentity[],
  createId: (path: ValidationPath) => BuilderUiId,
): void {
  identities.push({ id: createId(path), path });
  const record = asRecord(definition);
  if (record === undefined) return;

  const fields = asRecord(record.fields);
  if (fields !== undefined) {
    for (const [name, field] of Object.entries(fields)) {
      collectDefinitionIdentities(
        field,
        [...path, "fields", name],
        identities,
        createId,
      );
    }
  }
  if (Object.hasOwn(record, "item")) {
    collectDefinitionIdentities(
      record.item,
      [...path, "item"],
      identities,
      createId,
    );
  }
}

function createIdFactory(
  options: CreateBuilderDraftOptions | undefined,
  reservedIds: readonly BuilderUiId[] = [],
): (path: ValidationPath) => BuilderUiId {
  const createdIds = new Set<BuilderUiId>(reservedIds);
  const createId = options?.createId ?? createBuilderId;
  return () => {
    const id = createId();
    if (id.length === 0 || createdIds.has(id)) {
      throw new Error("Builder UI IDs must be non-empty and unique.");
    }
    createdIds.add(id);
    return id;
  };
}

function createBuilderId(): BuilderUiId {
  nextBuilderId += 1;
  return `builder-${nextBuilderId}`;
}

function updateIdentityProperty(
  document: Record<string, unknown>,
  identity: BuilderDocumentIdentity,
  property: "name" | "description",
): void {
  if (!Object.hasOwn(identity, property)) return;
  if (identity[property] === undefined) {
    delete document[property];
  } else {
    document[property] = identity[property];
  }
}

function getRootObjectFields(
  document: unknown,
): Record<string, unknown> | undefined {
  const documentRecord = asRecord(document);
  const definition =
    documentRecord === undefined
      ? undefined
      : asRecord(documentRecord.definition);
  if (definition?.type !== "object") return undefined;
  return asRecord(definition.fields);
}

function nextFieldName(fields: Record<string, unknown>): string {
  if (!Object.hasOwn(fields, "field")) return "field";
  let suffix = 2;
  while (Object.hasOwn(fields, `field${suffix}`)) suffix += 1;
  return `field${suffix}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function pathKey(path: ValidationPath): string {
  return JSON.stringify(path);
}

function pathsEqual(left: ValidationPath, right: ValidationPath): boolean {
  return pathKey(left) === pathKey(right);
}
