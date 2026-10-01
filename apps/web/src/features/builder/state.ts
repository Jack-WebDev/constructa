import {
  BUILT_IN_GENERATOR_CATALOG,
  type GeneratorDocumentV1,
  safeParseDocument,
  type ValidationPath,
} from "constructa-sdk";

import {
  getArrayItemDefinitionPath,
  getDefinitionAtPath,
  getObjectFieldDefinitionPath,
  getObjectFieldsAtPath,
  getParentObjectDefinitionPath,
  replaceDefinitionAtPath,
} from "./definition-path";

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

/** The result of removing a root object field. */
export type BuilderFieldRemove =
  | {
      readonly success: true;
      readonly draft: BuilderDocumentDraft;
      readonly field: BuilderFieldDraft;
    }
  | { readonly success: false; readonly error: BuilderDraftError };

/** The result of renaming a root object field. */
export type BuilderFieldRename =
  | {
      readonly success: true;
      readonly draft: BuilderDocumentDraft;
      readonly field: BuilderFieldDraft;
    }
  | { readonly success: false; readonly error: BuilderDraftError };

/** A supported direction for moving a root object field. */
export type BuilderFieldMoveDirection = "up" | "down";

/** The result of moving one root object field in presentation order. */
export type BuilderFieldMove =
  | {
      readonly success: true;
      readonly draft: BuilderDocumentDraft;
      readonly field: BuilderFieldDraft;
    }
  | { readonly success: false; readonly error: BuilderDraftError };

/** The result of replacing a field's definition with an allowlisted generator. */
export type BuilderFieldGeneratorSelection =
  | {
      readonly success: true;
      readonly draft: BuilderDocumentDraft;
      readonly field: BuilderFieldDraft;
    }
  | { readonly success: false; readonly error: BuilderDraftError };

/** The result of updating a field's flat portable definition properties. */
export type BuilderFieldDefinitionUpdate =
  | {
      readonly success: true;
      readonly draft: BuilderDocumentDraft;
      readonly field: BuilderFieldDraft;
    }
  | { readonly success: false; readonly error: BuilderDraftError };

/** The result of updating a definition at any recursive definition path. */
export type BuilderDefinitionUpdate =
  | { readonly success: true; readonly draft: BuilderDocumentDraft }
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
  return getBuilderObjectFields(draft, ["definition"]);
}

/** Returns the direct fields for an object definition at a canonical path. */
export function getBuilderObjectFields(
  draft: BuilderDocumentDraft,
  objectPath: ValidationPath,
): readonly BuilderFieldDraft[] {
  const fields = getObjectFieldsAtPath(draft?.document, objectPath);
  if (fields === undefined) return [];
  return Object.entries(fields).flatMap(([name, definition]) => {
    const path = getObjectFieldDefinitionPath(objectPath, name);
    const id = getBuilderDefinitionId(draft, path);
    return id === undefined ? [] : [{ definition, id, name, path }];
  });
}

/** Returns a raw definition at an object-field or array-item definition path. */
export function getBuilderDefinition(
  draft: BuilderDocumentDraft,
  path: ValidationPath,
): Readonly<Record<string, unknown>> | undefined {
  return getDefinitionAtPath(draft.document, path);
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
  const path = getObjectFieldDefinitionPath(["definition"], name);
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

/** Adds a safe default field to the object definition at the supplied path. */
export function addBuilderObjectField(
  draft: BuilderDocumentDraft,
  objectPath: ValidationPath,
  options?: CreateBuilderDraftOptions,
): BuilderFieldAdd {
  const fields = getObjectFieldsAtPath(draft?.document, objectPath);
  const document = asRecord(draft?.document);
  const rootDefinition =
    document === undefined ? undefined : asRecord(document.definition);
  if (
    fields === undefined ||
    document === undefined ||
    rootDefinition === undefined
  ) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "Fields can only be added to an object generator.",
        path: [...objectPath],
      },
    };
  }

  const name = nextFieldName(fields);
  const updatedDefinition = replaceDefinitionAtPath(
    rootDefinition,
    objectPath,
    {
      ...getDefinitionAtPath(document, objectPath),
      fields: { ...fields, [name]: { type: "boolean" } },
    },
  );
  if (updatedDefinition === undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "Fields can only be added to an object generator.",
        path: [...objectPath],
      },
    };
  }
  const nextDraft = replaceBuilderDraftDocument(
    draft,
    { ...document, definition: updatedDefinition },
    options,
  );
  const path = getObjectFieldDefinitionPath(objectPath, name);
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

/** Removes a root object field selected by its stable builder identity. */
export function removeBuilderField(
  draft: BuilderDocumentDraft,
  fieldId: BuilderUiId,
): BuilderFieldRemove {
  const field = getBuilderField(draft, fieldId);
  if (field === undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The field to remove no longer exists.",
        path: ["definition", "fields"],
      },
    };
  }
  const objectPath = getParentObjectDefinitionPath(field.path);
  const fields =
    objectPath === undefined
      ? undefined
      : getObjectFieldsAtPath(draft.document, objectPath);
  if (objectPath === undefined || fields === undefined)
    return invalidFieldOperation("removed");

  const { [field.name]: _removed, ...remainingFields } = fields;
  const nextDraft = replaceObjectFields(draft, objectPath, remainingFields);
  return nextDraft === undefined
    ? invalidFieldOperation("removed")
    : { success: true, draft: nextDraft, field };
}

/**
 * Renames a root object field while preserving UI identities for that field
 * and any nested definitions below it.
 */
export function renameBuilderField(
  draft: BuilderDocumentDraft,
  fieldId: BuilderUiId,
  name: string,
): BuilderFieldRename {
  const field = getBuilderField(draft, fieldId);
  if (field === undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The field to rename no longer exists.",
        path: ["definition", "fields"],
      },
    };
  }
  const objectPath = getParentObjectDefinitionPath(field.path);
  const fields =
    objectPath === undefined
      ? undefined
      : getObjectFieldsAtPath(draft.document, objectPath);
  if (objectPath === undefined || fields === undefined)
    return invalidFieldOperation("renamed");

  const error = validateFieldName(name, field.name, fields);
  if (error !== undefined) return { success: false, error };
  if (name === field.name) return { success: true, draft, field };

  const updatedFields: Record<string, unknown> = {};
  for (const [fieldName, fieldDefinition] of Object.entries(fields)) {
    updatedFields[fieldName === field.name ? name : fieldName] =
      fieldDefinition;
  }
  const renamedIdentities = draft.definitionIdentities.map((identity) => ({
    ...identity,
    path: renameFieldPath(identity.path, field.path, name),
  }));
  const preparedDraft = { ...draft, definitionIdentities: renamedIdentities };
  const nextDraft = replaceObjectFields(
    preparedDraft,
    objectPath,
    updatedFields,
  );
  if (nextDraft === undefined) return invalidFieldOperation("renamed");
  const updatedField = getBuilderField(nextDraft, fieldId);
  if (updatedField === undefined) {
    return {
      success: false,
      error: {
        code: "SYSTEM_ERROR",
        kind: "system",
        message: "Unable to update the field identity.",
        path: getObjectFieldDefinitionPath(objectPath, name),
      },
    };
  }
  return { success: true, draft: nextDraft, field: updatedField };
}

/**
 * Moves a root object field without changing its name, definition, or path.
 * Dependency scheduling remains owned by the shared generation engine.
 */
export function moveBuilderField(
  draft: BuilderDocumentDraft,
  fieldId: BuilderUiId,
  direction: BuilderFieldMoveDirection,
): BuilderFieldMove {
  const field = getBuilderField(draft, fieldId);
  if (field === undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The field to move no longer exists.",
        path: ["definition", "fields"],
      },
    };
  }
  const objectPath = getParentObjectDefinitionPath(field.path);
  const fields =
    objectPath === undefined
      ? undefined
      : getObjectFieldsAtPath(draft.document, objectPath);
  if (objectPath === undefined || fields === undefined)
    return invalidFieldOperation("moved");
  if (direction !== "up" && direction !== "down") {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "A field move direction must be up or down.",
        path: ["definition", "fields"],
      },
    };
  }

  const fieldList = getBuilderObjectFields(draft, objectPath);
  const index = fieldList.findIndex((field) => field.id === fieldId);
  if (index < 0) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The field to move no longer exists.",
        path: ["definition", "fields"],
      },
    };
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  const movedField = fieldList[index];
  if (targetIndex < 0 || targetIndex >= fieldList.length) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: `The field is already ${direction === "up" ? "first" : "last"}.`,
        path: movedField.path,
      },
    };
  }

  const orderedFields = Object.entries(fields);
  const target = orderedFields[targetIndex];
  orderedFields[targetIndex] = orderedFields[index];
  orderedFields[index] = target;

  const nextDraft = replaceObjectFields(
    draft,
    objectPath,
    Object.fromEntries(orderedFields),
  );
  return nextDraft === undefined
    ? invalidFieldOperation("moved")
    : { success: true, draft: nextDraft, field: movedField };
}

/**
 * Replaces a field definition with the selected built-in generator's safe
 * example. Existing generator-specific configuration is deliberately dropped.
 */
export function selectBuilderFieldGenerator(
  draft: BuilderDocumentDraft,
  fieldId: BuilderUiId,
  typeId: string,
): BuilderFieldGeneratorSelection {
  const field = getBuilderField(draft, fieldId);
  if (field === undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The field to update no longer exists.",
        path: ["definition", "fields"],
      },
    };
  }
  const objectPath = getParentObjectDefinitionPath(field.path);
  const fields =
    objectPath === undefined
      ? undefined
      : getObjectFieldsAtPath(draft.document, objectPath);
  if (objectPath === undefined || fields === undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message:
          "Field generators can only be selected on an object generator.",
        path: ["definition"],
      },
    };
  }

  const catalogEntry =
    typeof typeId === "string"
      ? BUILT_IN_GENERATOR_CATALOG.find((entry) => entry.typeId === typeId)
      : undefined;
  const definition = catalogEntry?.examples[0];
  if (definition === undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The selected generator is not available.",
        path: ["definition", "fields", field.name, "type"],
      },
    };
  }
  if (getDefinitionType(field.definition) === typeId) {
    return { success: true, draft, field };
  }

  const nextDraft = replaceDefinitionDraft(
    draft,
    field.path,
    structuredClone(definition),
  );
  const updatedField =
    nextDraft === undefined ? undefined : getBuilderField(nextDraft, fieldId);
  if (updatedField === undefined) {
    return {
      success: false,
      error: {
        code: "SYSTEM_ERROR",
        kind: "system",
        message: "Unable to update the field generator.",
        path: field.path,
      },
    };
  }
  if (nextDraft === undefined) return invalidFieldOperation("moved");
  return { success: true, draft: nextDraft, field: updatedField };
}

/**
 * Updates one field through flat portable generator properties. Invalid drafts
 * are retained so the shared parser can report feedback without losing input.
 */
export function updateBuilderFieldDefinition(
  draft: BuilderDocumentDraft,
  fieldId: BuilderUiId,
  definition: unknown,
): BuilderFieldDefinitionUpdate {
  const field = getBuilderField(draft, fieldId);
  if (field === undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The field to update no longer exists.",
        path: ["definition", "fields"],
      },
    };
  }
  const objectPath = getParentObjectDefinitionPath(field.path);
  const fields =
    objectPath === undefined
      ? undefined
      : getObjectFieldsAtPath(draft.document, objectPath);
  if (objectPath === undefined || fields === undefined)
    return invalidFieldDefinitionUpdate();

  const properties = asRecord(definition);
  const currentType = getDefinitionType(field.definition);
  if (properties === undefined || typeof properties.type !== "string") {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "Field configuration must be a flat generator definition.",
        path: [...field.path],
      },
    };
  }
  if (properties.type !== currentType) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "Field configuration cannot change the selected generator.",
        path: [...field.path, "type"],
      },
    };
  }

  const nextDraft = replaceDefinitionDraft(draft, field.path, {
    ...properties,
  });
  const updatedField =
    nextDraft === undefined ? undefined : getBuilderField(nextDraft, fieldId);
  if (updatedField === undefined) {
    return {
      success: false,
      error: {
        code: "SYSTEM_ERROR",
        kind: "system",
        message: "Unable to update the field configuration.",
        path: field.path,
      },
    };
  }
  if (nextDraft === undefined) return invalidFieldDefinitionUpdate();
  return { success: true, draft: nextDraft, field: updatedField };
}

/**
 * Updates a definition at any recursive path. Its type is fixed so callers
 * cannot accidentally use configuration edits to select another generator.
 */
export function updateBuilderDefinition(
  draft: BuilderDocumentDraft,
  path: ValidationPath,
  definition: unknown,
): BuilderDefinitionUpdate {
  const current = getDefinitionAtPath(draft.document, path);
  const next = asRecord(definition);
  if (
    current === undefined ||
    next === undefined ||
    typeof next.type !== "string"
  ) {
    return invalidDefinitionUpdate(path);
  }
  if (next.type !== getDefinitionType(current)) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "Field configuration cannot change the selected generator.",
        path: [...path, "type"],
      },
    };
  }
  const nextDraft = replaceDefinitionDraft(draft, path, { ...next });
  return nextDraft === undefined
    ? invalidDefinitionUpdate(path)
    : { success: true, draft: nextDraft };
}

/** Replaces a definition with an allowlisted generator example at any depth. */
export function selectBuilderDefinitionGenerator(
  draft: BuilderDocumentDraft,
  path: ValidationPath,
  typeId: string,
): BuilderDefinitionUpdate {
  const current = getDefinitionAtPath(draft.document, path);
  const entry = BUILT_IN_GENERATOR_CATALOG.find(
    (candidate) => candidate.typeId === typeId,
  );
  const definition = entry?.examples[0];
  if (current === undefined || definition === undefined) {
    return {
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The selected generator is not available.",
        path: [...path, "type"],
      },
    };
  }
  if (getDefinitionType(current) === typeId) return { success: true, draft };
  const nextDraft = replaceDefinitionDraft(
    draft,
    path,
    structuredClone(definition),
  );
  return nextDraft === undefined
    ? invalidDefinitionUpdate(path)
    : { success: true, draft: nextDraft };
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
        getObjectFieldDefinitionPath(path, name),
        identities,
        createId,
      );
    }
  }
  if (Object.hasOwn(record, "item")) {
    collectDefinitionIdentities(
      record.item,
      getArrayItemDefinitionPath(path),
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

function getBuilderField(
  draft: BuilderDocumentDraft,
  fieldId: BuilderUiId,
): BuilderFieldDraft | undefined {
  const identity = draft.definitionIdentities.find(
    (candidate) =>
      candidate.id === fieldId &&
      getParentObjectDefinitionPath(candidate.path) !== undefined,
  );
  const name = identity?.path.at(-1);
  const definition =
    identity === undefined
      ? undefined
      : getDefinitionAtPath(draft.document, identity.path);
  return typeof name === "string" &&
    definition !== undefined &&
    identity !== undefined
    ? { definition, id: identity.id, name, path: identity.path }
    : undefined;
}

function replaceDefinitionDraft(
  draft: BuilderDocumentDraft,
  path: ValidationPath,
  replacement: Record<string, unknown>,
): BuilderDocumentDraft | undefined {
  const document = asRecord(draft.document);
  const rootDefinition =
    document === undefined ? undefined : asRecord(document.definition);
  if (document === undefined || rootDefinition === undefined) return undefined;
  const definition = replaceDefinitionAtPath(rootDefinition, path, replacement);
  return definition === undefined
    ? undefined
    : replaceBuilderDraftDocument(draft, { ...document, definition });
}

function replaceObjectFields(
  draft: BuilderDocumentDraft,
  objectPath: ValidationPath,
  fields: Record<string, unknown>,
): BuilderDocumentDraft | undefined {
  const objectDefinition = getDefinitionAtPath(draft.document, objectPath);
  return objectDefinition?.type !== "object"
    ? undefined
    : replaceDefinitionDraft(draft, objectPath, {
        ...objectDefinition,
        fields,
      });
}

function nextFieldName(fields: Record<string, unknown>): string {
  if (!Object.hasOwn(fields, "field")) return "field";
  let suffix = 2;
  while (Object.hasOwn(fields, `field${suffix}`)) suffix += 1;
  return `field${suffix}`;
}

function invalidFieldOperation(
  operation: "removed" | "renamed" | "moved",
): BuilderFieldRemove | BuilderFieldRename | BuilderFieldMove {
  return {
    success: false,
    error: {
      code: "INVALID_CONFIGURATION",
      kind: "configuration",
      message: `Fields can only be ${operation} on an object generator.`,
      path: ["definition"],
    },
  };
}

function invalidFieldDefinitionUpdate(): BuilderFieldDefinitionUpdate {
  return {
    success: false,
    error: {
      code: "INVALID_CONFIGURATION",
      kind: "configuration",
      message:
        "Field configuration can only be updated on an object generator.",
      path: ["definition"],
    },
  };
}

function validateFieldName(
  name: unknown,
  currentName: string,
  fields: Record<string, unknown>,
): BuilderDraftError | undefined {
  const path = ["definition", "fields", currentName];
  if (typeof name !== "string" || name.trim().length === 0) {
    return {
      code: "INVALID_CONFIGURATION",
      kind: "configuration",
      message: "Field names cannot be empty.",
      path,
    };
  }
  if (["__proto__", "constructor", "prototype"].includes(name)) {
    return {
      code: "INVALID_CONFIGURATION",
      kind: "configuration",
      message: "This field name is not allowed.",
      path,
    };
  }
  if (name !== currentName && Object.hasOwn(fields, name)) {
    return {
      code: "INVALID_CONFIGURATION",
      kind: "configuration",
      message: "Field names must be unique.",
      path,
    };
  }
  return undefined;
}

function renameFieldPath(
  path: ValidationPath,
  previousPath: ValidationPath,
  nextName: string,
): ValidationPath {
  if (
    path.length < previousPath.length ||
    !previousPath.every((segment, index) => path[index] === segment)
  ) {
    return path;
  }
  return [
    ...previousPath.slice(0, -1),
    nextName,
    ...path.slice(previousPath.length),
  ];
}

function invalidDefinitionUpdate(
  path: ValidationPath,
): BuilderDefinitionUpdate {
  return {
    success: false,
    error: {
      code: "INVALID_CONFIGURATION",
      kind: "configuration",
      message: "Field configuration must be a flat generator definition.",
      path: [...path],
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function getDefinitionType(definition: unknown): string | undefined {
  const record = asRecord(definition);
  return typeof record?.type === "string" ? record.type : undefined;
}

function pathKey(path: ValidationPath): string {
  return JSON.stringify(path);
}

function pathsEqual(left: ValidationPath, right: ValidationPath): boolean {
  return pathKey(left) === pathKey(right);
}
