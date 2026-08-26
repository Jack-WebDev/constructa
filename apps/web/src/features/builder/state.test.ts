import { generate } from "constructa-sdk";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  addBuilderField,
  type BuilderDocumentConversion,
  type BuilderDocumentDraft,
  type BuilderFieldDefinitionUpdate,
  type BuilderFieldGeneratorSelection,
  type BuilderFieldMove,
  createBuilderDraft,
  getBuilderDefinitionId,
  getBuilderDocumentIdentity,
  getBuilderFields,
  moveBuilderField,
  removeBuilderField,
  renameBuilderField,
  replaceBuilderDraftDocument,
  selectBuilderFieldGenerator,
  toGeneratorDocument,
  updateBuilderDocumentIdentity,
  updateBuilderFieldDefinition,
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

  it("removes a field by UI identity without changing remaining identities", () => {
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: { id: { type: "uuid" }, active: { type: "boolean" } },
        },
      },
      { createId: deterministicIds() },
    );
    const active = getBuilderFields(draft).find(
      (field) => field.name === "active",
    );
    if (active === undefined) throw new Error("Expected an active field");
    const result = removeBuilderField(draft, active.id);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected the field to be removed");
    expect(result.field).toEqual(active);
    expect(getBuilderFields(result.draft)).toEqual([
      expect.objectContaining({ name: "id" }),
    ]);
    expect(
      getBuilderDefinitionId(result.draft, ["definition", "fields", "id"]),
    ).toBe(getBuilderDefinitionId(draft, ["definition", "fields", "id"]));
  });

  it("rejects removal of a missing field without mutation", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: { type: "object", fields: {} },
    });

    expect(removeBuilderField(draft, "missing")).toEqual({
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The field to remove no longer exists.",
        path: ["definition", "fields"],
      },
    });
    expect(getBuilderFields(draft)).toEqual([]);
  });

  it("renames a field and updates its nested paths without changing identities", () => {
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: {
            account: { type: "object", fields: { id: { type: "uuid" } } },
          },
        },
      },
      { createId: deterministicIds() },
    );
    const account = getBuilderFields(draft)[0];
    const accountId = account.id;
    const nestedId = getBuilderDefinitionId(draft, [
      "definition",
      "fields",
      "account",
      "fields",
      "id",
    ]);
    const result = renameBuilderField(draft, account.id, "profile");

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected the field to be renamed");
    expect(result.field).toMatchObject({ id: accountId, name: "profile" });
    expect(
      getBuilderDefinitionId(result.draft, [
        "definition",
        "fields",
        "profile",
        "fields",
        "id",
      ]),
    ).toBe(nestedId);
    expect(toGeneratorDocument(result.draft).success).toBe(true);
  });

  it.each([
    ["", "Field names cannot be empty."],
    ["   ", "Field names cannot be empty."],
    ["id", "Field names must be unique."],
    ["__proto__", "This field name is not allowed."],
    ["constructor", "This field name is not allowed."],
    ["prototype", "This field name is not allowed."],
  ])("rejects invalid field name %j without mutation", (name, message) => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: {
        type: "object",
        fields: { id: { type: "uuid" }, active: { type: "boolean" } },
      },
    });
    const active = getBuilderFields(draft).find(
      (field) => field.name === "active",
    );
    if (active === undefined) throw new Error("Expected an active field");

    expect(renameBuilderField(draft, active.id, name)).toEqual({
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message,
        path: ["definition", "fields", "active"],
      },
    });
    expect(getBuilderFields(draft).map((field) => field.name)).toEqual([
      "id",
      "active",
    ]);
  });

  it("moves fields while preserving definitions, paths, and UI identities", () => {
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: {
            first: { type: "uuid" },
            second: { type: "boolean" },
            third: { type: "integer", min: 1, max: 1 },
          },
        },
      },
      { createId: deterministicIds() },
    );
    const second = getBuilderFields(draft)[1];
    const result = moveBuilderField(draft, second.id, "up");

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected the field to move");
    expect(getBuilderFields(result.draft).map((field) => field.name)).toEqual([
      "second",
      "first",
      "third",
    ]);
    expect(result.field).toEqual(second);
    expect(
      getBuilderDefinitionId(result.draft, ["definition", "fields", "second"]),
    ).toBe(second.id);
    expect(result.draft.document).toEqual({
      schemaVersion: 1,
      definition: {
        type: "object",
        fields: {
          second: { type: "boolean" },
          first: { type: "uuid" },
          third: { type: "integer", min: 1, max: 1 },
        },
      },
    });
  });

  it("keeps reference resolution and dependency scheduling invariant after a move", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: {
        type: "object",
        fields: {
          greeting: { type: "template", source: "Hello {name}" },
          name: { type: "choice", values: ["Ada"] },
        },
      },
    });
    const greeting = getBuilderFields(draft)[0];
    const result = moveBuilderField(draft, greeting.id, "down");

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected the field to move");
    const conversion = toGeneratorDocument(result.draft);
    expect(conversion.success).toBe(true);
    if (!conversion.success) throw new Error("Expected a valid document");
    const generated = generate(conversion.document.definition, {
      seed: "field-reorder",
    });
    expect(generated).toEqual({ name: "Ada", greeting: "Hello Ada" });
    if (typeof generated !== "object" || generated === null)
      throw new Error("Expected object output");
    expect(Object.keys(generated)).toEqual(["name", "greeting"]);
  });

  it.each([
    ["up", "The field is already first.", ["definition", "fields", "first"]],
    ["down", "The field is already last.", ["definition", "fields", "second"]],
  ] as const)(
    "rejects a boundary move %s without mutation",
    (direction, message, path) => {
      const draft = createBuilderDraft({
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: { first: { type: "boolean" }, second: { type: "boolean" } },
        },
      });
      const field = getBuilderFields(draft)[direction === "up" ? 0 : 1];

      expect(moveBuilderField(draft, field.id, direction)).toEqual({
        success: false,
        error: {
          code: "INVALID_CONFIGURATION",
          kind: "configuration",
          message,
          path,
        },
      });
      expect(
        getBuilderFields(draft).map((candidate) => candidate.name),
      ).toEqual(["first", "second"]);
    },
  );

  it("rejects moving a stale field without mutation", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: { type: "object", fields: { first: { type: "boolean" } } },
    });

    expect(moveBuilderField(draft, "missing", "up")).toEqual({
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The field to move no longer exists.",
        path: ["definition", "fields"],
      },
    });
  });

  it("rejects an invalid move direction without mutation", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: { type: "object", fields: { first: { type: "boolean" } } },
    });
    const field = getBuilderFields(draft)[0];

    expect(moveBuilderField(draft, field.id, "sideways" as "up")).toEqual({
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "A field move direction must be up or down.",
        path: ["definition", "fields"],
      },
    });
  });

  it("replaces a field with an allowlisted generator and discards old configuration", () => {
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: { age: { type: "integer", min: 18, max: 65 } },
        },
      },
      { createId: deterministicIds() },
    );
    const age = getBuilderFields(draft)[0];
    const result = selectBuilderFieldGenerator(draft, age.id, "uuid");

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected the generator to change");
    expect(result.field).toEqual({
      id: age.id,
      name: "age",
      path: ["definition", "fields", "age"],
      definition: { type: "uuid" },
    });
    expect(toGeneratorDocument(result.draft).success).toBe(true);
  });

  it("rejects an unavailable field generator without mutation", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: { type: "object", fields: { age: { type: "boolean" } } },
    });
    const age = getBuilderFields(draft)[0];

    expect(selectBuilderFieldGenerator(draft, age.id, "missing")).toEqual({
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The selected generator is not available.",
        path: ["definition", "fields", "age", "type"],
      },
    });
    expect(getBuilderFields(draft)[0]).toEqual(age);
  });

  it("keeps compatible configuration when the selected generator is unchanged", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: {
        type: "object",
        fields: { age: { type: "integer", min: 18, max: 65 } },
      },
    });
    const age = getBuilderFields(draft)[0];
    const result = selectBuilderFieldGenerator(draft, age.id, "integer");

    expect(result).toEqual({ success: true, draft, field: age });
  });

  it("updates flat field properties without adding a configuration envelope", () => {
    const draft = createBuilderDraft(
      {
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: { age: { type: "integer", min: 18, max: 65 } },
        },
      },
      { createId: deterministicIds() },
    );
    const age = getBuilderFields(draft)[0];
    const result = updateBuilderFieldDefinition(draft, age.id, {
      type: "integer",
      min: 21,
      max: 70,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected configuration to update");
    expect(result.field.definition).toEqual({
      type: "integer",
      min: 21,
      max: 70,
    });
    expect(toGeneratorDocument(result.draft).success).toBe(true);
  });

  it("preserves invalid field configuration drafts for canonical validation", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: {
        type: "object",
        fields: { age: { type: "integer", min: 18, max: 65 } },
      },
    });
    const age = getBuilderFields(draft)[0];
    const result = updateBuilderFieldDefinition(draft, age.id, {
      type: "integer",
      min: "not-a-number",
      max: 65,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected invalid draft preservation");
    expect(result.field.definition).toEqual({
      type: "integer",
      min: "not-a-number",
      max: 65,
    });
    expect(toGeneratorDocument(result.draft)).toEqual({
      success: false,
      errors: [
        expect.objectContaining({
          code: "INVALID_RANGE",
          kind: "configuration",
          path: ["definition", "fields", "age", "min"],
        }),
      ],
    });
  });

  it("rejects field configuration that changes the selected generator", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: { type: "object", fields: { age: { type: "boolean" } } },
    });
    const age = getBuilderFields(draft)[0];

    expect(
      updateBuilderFieldDefinition(draft, age.id, { type: "integer" }),
    ).toEqual({
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "Field configuration cannot change the selected generator.",
        path: ["definition", "fields", "age", "type"],
      },
    });
  });

  it("rejects selecting a generator for a stale field", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: { type: "object", fields: {} },
    });

    expect(selectBuilderFieldGenerator(draft, "missing", "uuid")).toEqual({
      success: false,
      error: {
        code: "INVALID_CONFIGURATION",
        kind: "configuration",
        message: "The field to update no longer exists.",
        path: ["definition", "fields"],
      },
    });
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
    expectTypeOf<BuilderFieldMove>().toMatchTypeOf<{
      readonly success: boolean;
    }>();
    expectTypeOf<BuilderFieldGeneratorSelection>().toMatchTypeOf<{
      readonly success: boolean;
    }>();
    expectTypeOf<BuilderFieldDefinitionUpdate>().toMatchTypeOf<{
      readonly success: boolean;
    }>();
  });
});
