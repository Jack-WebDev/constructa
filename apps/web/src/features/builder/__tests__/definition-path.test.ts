import { describe, expect, it } from "vitest";

import {
  getArrayItemDefinitionPath,
  getDefinitionAtPath,
  getObjectFieldDefinitionPath,
  getParentObjectDefinitionPath,
  getRelativeDefinitionIssuePath,
  replaceDefinitionAtPath,
} from "../definition-path";

describe("builder definition paths", () => {
  const ordersPath = ["definition", "fields", "orders"] as const;
  const itemPath = getArrayItemDefinitionPath(ordersPath);
  const document = {
    schemaVersion: 1,
    definition: {
      type: "object",
      fields: {
        orders: {
          type: "array",
          item: { type: "integer", min: 1, max: 2 },
        },
      },
    },
  };

  it("navigates fields, array items, and their containing objects", () => {
    expect(getObjectFieldDefinitionPath(["definition"], "orders")).toEqual(
      ordersPath,
    );
    expect(itemPath).toEqual(["definition", "fields", "orders", "item"]);
    expect(getParentObjectDefinitionPath(ordersPath)).toEqual(["definition"]);
    expect(getParentObjectDefinitionPath(itemPath)).toBeUndefined();
    expect(getDefinitionAtPath(document, itemPath)).toEqual({
      type: "integer",
      min: 1,
      max: 2,
    });
  });

  it("replaces a nested definition and projects only its issues", () => {
    const replacement = { type: "uuid" };
    const definition = replaceDefinitionAtPath(
      document.definition,
      itemPath,
      replacement,
    );

    expect(getDefinitionAtPath({ definition }, itemPath)).toEqual(replacement);
    expect(
      getRelativeDefinitionIssuePath([...itemPath, "min"], itemPath),
    ).toEqual(["min"]);
    expect(
      getRelativeDefinitionIssuePath(
        ["definition", "fields", "other", "min"],
        itemPath,
      ),
    ).toBeUndefined();
  });
});
