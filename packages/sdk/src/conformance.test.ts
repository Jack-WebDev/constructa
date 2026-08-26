import { describe, expect, expectTypeOf, it } from "vitest";

import {
  array,
  choice,
  generate,
  type Infer,
  integer,
  object,
  serializeDocument,
  uuid,
} from "./index";

describe("SDK PRD conformance", () => {
  it("supports zero-generic factories, literal choices, nested objects and arrays", () => {
    const definition = object({
      id: uuid(),
      role: choice(["admin", "member"] as const),
      teams: array(object({ name: choice(["platform", "product"] as const) }), {
        length: 1,
      }),
      score: integer({ min: 1, max: 1 }),
    });

    expectTypeOf<Infer<typeof definition>>().toEqualTypeOf<{
      readonly id: string;
      readonly role: "admin" | "member";
      readonly teams: { readonly name: "platform" | "product" }[];
      readonly score: number;
    }>();
    expectTypeOf(generate(definition)).toEqualTypeOf<
      Infer<typeof definition>
    >();
    expect(generate(definition, { seed: "types" }).score).toBe(1);
  });

  it("keeps serialized seeded documents executable with the same output", () => {
    const document = {
      schemaVersion: 1,
      definition: object({ value: integer({ min: 4, max: 9 }) }),
    } as const;
    const reparsed = JSON.parse(serializeDocument(document));
    expect(generate(reparsed.definition, { seed: "serialized" })).toEqual(
      generate(document.definition, { seed: "serialized" }),
    );
  });
});
