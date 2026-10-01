import type { ValidationPath } from "constructa-sdk";

/**
 * Navigates canonical locations within a builder document definition. This
 * module owns the `definition`, `fields`, and `item` path grammar.
 */
export function getDefinitionAtPath(
  document: unknown,
  path: ValidationPath,
): Record<string, unknown> | undefined {
  if (!isDefinitionPath(path)) return undefined;
  const documentRecord = asRecord(document);
  let definition =
    documentRecord === undefined
      ? undefined
      : asRecord(documentRecord.definition);
  for (let index = 1; definition !== undefined && index < path.length; ) {
    const segment = path[index];
    if (segment === "item") {
      definition = asRecord(definition.item);
      index += 1;
      continue;
    }
    const fieldName = path[index + 1];
    const fields =
      segment === "fields" ? asRecord(definition.fields) : undefined;
    definition =
      typeof fieldName === "string" && fields !== undefined
        ? asRecord(fields[fieldName])
        : undefined;
    index += 2;
  }
  return definition;
}

/** Returns the direct fields for an object definition at a canonical path. */
export function getObjectFieldsAtPath(
  document: unknown,
  objectPath: ValidationPath,
): Record<string, unknown> | undefined {
  const definition = getDefinitionAtPath(document, objectPath);
  return definition?.type === "object"
    ? asRecord(definition.fields)
    : undefined;
}

/** Returns the canonical location for a direct object field. */
export function getObjectFieldDefinitionPath(
  objectPath: ValidationPath,
  fieldName: string,
): ValidationPath {
  return [...objectPath, "fields", fieldName];
}

/** Returns the canonical location for an array item definition. */
export function getArrayItemDefinitionPath(
  arrayPath: ValidationPath,
): ValidationPath {
  return [...arrayPath, "item"];
}

/** Returns the containing object for a direct field, but never an array item. */
export function getParentObjectDefinitionPath(
  path: ValidationPath,
): ValidationPath | undefined {
  return isDefinitionPath(path) && path.at(-2) === "fields"
    ? path.slice(0, -2)
    : undefined;
}

/** Returns an issue path relative to a definition, when the issue belongs to it. */
export function getRelativeDefinitionIssuePath(
  issuePath: ValidationPath,
  definitionPath: ValidationPath,
): ValidationPath | undefined {
  return definitionPath.every((segment, index) => issuePath[index] === segment)
    ? issuePath.slice(definitionPath.length)
    : undefined;
}

/** Replaces one definition while preserving every surrounding definition. */
export function replaceDefinitionAtPath(
  definition: Record<string, unknown>,
  path: ValidationPath,
  replacement: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!isDefinitionPath(path)) return undefined;
  const segments = path.slice(1);
  const replace = (
    current: Record<string, unknown>,
    index: number,
  ): Record<string, unknown> | undefined => {
    if (index === segments.length) return replacement;
    if (segments[index] === "item") {
      const item = asRecord(current.item);
      if (item === undefined) return undefined;
      const updatedItem = replace(item, index + 1);
      return updatedItem === undefined
        ? undefined
        : { ...current, item: updatedItem };
    }
    const fieldName = segments[index + 1];
    const fields =
      segments[index] === "fields" ? asRecord(current.fields) : undefined;
    if (typeof fieldName !== "string" || fields === undefined) return undefined;
    const child = asRecord(fields[fieldName]);
    if (child === undefined) return undefined;
    const updatedChild = replace(child, index + 2);
    return updatedChild === undefined
      ? undefined
      : { ...current, fields: { ...fields, [fieldName]: updatedChild } };
  };
  return replace(definition, 0);
}

function isDefinitionPath(path: ValidationPath): boolean {
  if (!Array.isArray(path) || path[0] !== "definition") return false;
  for (let index = 1; index < path.length; ) {
    if (path[index] === "item") {
      index += 1;
      continue;
    }
    if (path[index] !== "fields" || typeof path[index + 1] !== "string") {
      return false;
    }
    index += 2;
  }
  return true;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
