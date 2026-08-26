import { describe, expect, expectTypeOf, it } from "vitest";

import {
  GENERATOR_CATEGORIES,
  getCatalogEntry,
  normalizeSearchQuery,
  searchGeneratorCatalog,
} from "../catalog";

describe("generator catalog search", () => {
  it("normalizes name, description, and tag searches with deterministic ranking", () => {
    expect(normalizeSearchQuery("  NuMbEr ")).toBe("number");
    expect(
      searchGeneratorCatalog("number").map((entry) => entry.typeId),
    ).toEqual(["decimal", "integer"]);
    expect(
      searchGeneratorCatalog("calendar").map((entry) => entry.typeId),
    ).toEqual(["date"]);
    expect(
      searchGeneratorCatalog("local references").map((entry) => entry.typeId),
    ).toEqual(["template"]);
  });

  it("returns stable category filters and empty results", () => {
    expect(GENERATOR_CATEGORIES.map((category) => category.id)).toEqual([
      "composition",
      "numeric",
      "primitive",
    ]);
    expect(
      searchGeneratorCatalog("", "numeric").map((entry) => entry.typeId),
    ).toEqual(["decimal", "integer"]);
    expect(searchGeneratorCatalog("uuid", "numeric")).toEqual([]);
    expect(searchGeneratorCatalog("does not exist")).toEqual([]);
  });

  it("resolves stable type IDs without changing the catalog type surface", () => {
    expect(getCatalogEntry("uuid")?.displayName).toBe("UUID");
    expect(getCatalogEntry("missing")).toBeUndefined();
    expectTypeOf(getCatalogEntry).returns.toEqualTypeOf<
      import("constructa-sdk").BuiltInGeneratorCatalogEntry | undefined
    >();
  });
});
