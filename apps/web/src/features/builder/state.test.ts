import { describe, expect, expectTypeOf, it } from "vitest";

import {
  addBuilderField,
  type BuilderDocumentConversion,
  type BuilderDocumentDraft,
  createBuilderDraft,
  getBuilderDefinitionId,
  getBuilderDocumentIdentity,
  replaceBuilderDraftDocument,
  toGeneratorDocument,
  updateBuilderDocumentIdentity,
} from "./state";

function deterministicIds(): () => string {
  let index = 0;
  return () => {
    index += 1;
    return `ui-${index}`;
  };
}

describe("builder document draft state", () => {
  it("assigns stable UI-only identities to the root and nested definitions", () => {
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: {
            account: {
              type: "object",
              fields: { id: { type: "uuid" } },
            },
          },
        },
      },
      { createId: deterministicIds() },
    );

    expect(draft.id).toBe("ui-1");
    expect(draft.definitionIdentities).toEqual([
      { id: "ui-2", path: ["definition"] },
      { id: "ui-3", path: ["definition", "fields", "account"] },
      {
        id: "ui-4",
        path: ["definition", "fields", "account", "fields", "id"],
      },
    ]);
    expect(
      getBuilderDefinitionId(draft, ["definition", "fields", "account"]),
    ).toBe("ui-3");
  });

  it("preserves identities for unchanged paths across component-independent updates", () => {
    const createId = deterministicIds();
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        definition: { type: "object", fields: { id: { type: "uuid" } } },
      },
      { createId },
    );
    const updated = replaceBuilderDraftDocument(
      draft,
      {
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: { id: { type: "uuid" }, active: { type: "boolean" } },
        },
      },
      { createId },
    );

    expect(updated.id).toBe(draft.id);
    expect(getBuilderDefinitionId(updated, ["definition"])).toBe(
      getBuilderDefinitionId(draft, ["definition"]),
    );
    expect(
      getBuilderDefinitionId(updated, ["definition", "fields", "id"]),
    ).toBe(getBuilderDefinitionId(draft, ["definition", "fields", "id"]));
    expect(
      getBuilderDefinitionId(updated, ["definition", "fields", "active"]),
    ).toBe("ui-4");
  });

  it("preserves malformed drafts and returns the shared parser error", () => {
    const document = {
      schemaVersion: 1,
      definition: { type: "integer", min: "not-a-number", max: 10 },
    };
    const draft = createBuilderDraft(document, {
      createId: deterministicIds(),
    });
    const conversion = toGeneratorDocument(draft);

    expect(draft.document).toBe(document);
    expect(conversion).toEqual({
      success: false,
      errors: [
        expect.objectContaining({
          code: "INVALID_RANGE",
          kind: "configuration",
          path: ["definition", "min"],
        }),
      ],
    });
  });

  it("converts valid documents without exporting UI identities", () => {
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        name: "Employee",
        definition: {
          type: "object",
          fields: {
            id: { type: "uuid" },
            age: { type: "integer", min: 18, max: 65 },
          },
        },
      },
      { createId: deterministicIds() },
    );
    const conversion = toGeneratorDocument(draft);

    expect(conversion.success).toBe(true);
    if (!conversion.success) throw new Error("Expected a valid document");
    expect(conversion.document).toEqual(draft.document);
    expect(JSON.stringify(conversion.document)).not.toContain("ui-");
  });

  it("updates document identity without adding metadata to nested definitions", () => {
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: { id: { type: "uuid" } },
        },
      },
      { createId: deterministicIds() },
    );
    const result = updateBuilderDocumentIdentity(draft, {
      name: "",
      description: "Generates test employees.",
    });

    expect(result.success).toBe(true);
    if (!result.success)
      throw new Error("Expected the identity update to work");
    expect(getBuilderDocumentIdentity(result.draft)).toEqual({
      name: "",
      description: "Generates test employees.",
    });
    expect(result.draft.document).toEqual({
      schemaVersion: 1,
      name: "",
      description: "Generates test employees.",
      definition: {
        type: "object",
        fields: { id: { type: "uuid" } },
      },
    });
  });

  it("preserves invalid identity drafts and surfaces their shared error path", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: { type: "boolean" },
    });
    const result = updateBuilderDocumentIdentity(draft, { name: 42 });

    expect(result.success).toBe(true);
    if (!result.success)
      throw new Error("Expected the identity update to work");
    expect(toGeneratorDocument(result.draft)).toEqual({
      success: false,
      errors: [
        expect.objectContaining({
          code: "INVALID_CONFIGURATION",
          kind: "configuration",
          path: ["name"],
        }),
      ],
    });
  });

  it("adds a valid Boolean field with a stable UI identity", () => {
    const createId = deterministicIds();
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        definition: { type: "object", fields: {} },
      },
      { createId },
    );
    const result = addBuilderField(draft, { createId });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected a field to be added");
    expect(result.field).toEqual({
      id: "ui-3",
      name: "field",
      path: ["definition", "fields", "field"],
      definition: { type: "boolean" },
    });
    expect(getBuilderDefinitionId(result.draft, result.field.path)).toBe(
      result.field.id,
    );
    expect(toGeneratorDocument(result.draft).success).toBe(true);
  });

  it("chooses a unique field name without replacing existing fields", () => {
    const createId = deterministicIds();
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: {
            field: { type: "uuid" },
            field2: { type: "boolean" },
          },
        },
      },
      { createId },
    );
    const result = addBuilderField(draft, { createId });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected a field to be added");
    expect(result.field.name).toBe("field3");
    expect(result.field.definition).toEqual({ type: "boolean" });
    expect(
      (result.draft.document as { definition: { fields: object } }).definition
        .fields,
    ).toEqual({
      field: { type: "uuid" },
      field2: { type: "boolean" },
      field3: { type: "boolean" },
    });
  });

  it("rejects add-field when the root draft is not an object without mutation", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: { type: "integer", min: 1, max: 10 },
    });
    const result = addBuilderField(draft);

    expect(result).toEqual({
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "Fields can only be added to an object generator.",
        path: ["definition"],
      },
    });
    expect(toGeneratorDocument(draft).success).toBe(true);
  });

  it("rejects identity changes when the draft does not contain a document object", () => {
    const result = updateBuilderDocumentIdentity(createBuilderDraft(null), {
      name: "Employee",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "Builder identity requires a document object.",
        path: [],
      },
    });
  });

  it("handles an empty external state as an invalid document instead of throwing", () => {
    const conversion = toGeneratorDocument({} as BuilderDocumentDraft);

    expect(conversion).toEqual({
      success: false,
      errors: [
        expect.objectContaining({
          code: "INVALID_CONFIGURATION",
          kind: "configuration",
          path: [],
        }),
      ],
    });
  });

  it("keeps the draft and conversion type surfaces explicit", () => {
    expectTypeOf<BuilderDocumentDraft["document"]>().toEqualTypeOf<unknown>();
    expectTypeOf<BuilderDocumentConversion>().toMatchTypeOf<{
      readonly success: boolean;
    }>();
  });
});
