import { describe, expect, expectTypeOf, it } from "vitest";

import {
  array,
  boolean,
  choice,
  date,
  decimal,
  generate,
  type Infer,
  integer,
  object,
  safeParseDocument,
  serializeDocument,
  string,
  template,
  uuid,
} from "../dist/index.js";

describe("SDK README examples", () => {
  it("executes every MVP built-in through the packed public artifact", () => {
    const profile = object({
      id: uuid(),
      active: boolean(),
      age: integer({ min: 18, max: 65 }),
      rating: decimal({ min: 0, max: 5, precision: 1 }),
      joined: date({ min: "2024-01-01", max: "2024-12-31" }),
      code: string({ length: 6, charset: "hex" }),
      labels: array(choice(["new", "verified"] as const), { length: 2 }),
      name: choice(["Ada", "Grace"] as const),
      greeting: template("Hello {name}"),
    });
    const value = generate(profile, { seed: "readme" });
    expect(value).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/iu),
      active: expect.any(Boolean),
      greeting: expect.stringMatching(/^Hello (Ada|Grace)$/u),
    });
    expect(value.age).toBeGreaterThanOrEqual(18);
    expect(value.age).toBeLessThanOrEqual(65);
    expect(value.labels).toHaveLength(2);
  });

  it("compiles inference and documents parsing, serialization, seeds, and errors", () => {
    const team = object({
      role: choice(["admin", "member"] as const),
      tags: array(choice(["new", "verified"] as const), { length: 2 }),
    });
    expectTypeOf<Infer<typeof team>>().toEqualTypeOf<{
      readonly role: "admin" | "member";
      readonly tags: ("new" | "verified")[];
    }>();
    expectTypeOf(generate(team)).toEqualTypeOf<Infer<typeof team>>();
    const parsed = safeParseDocument({
      schemaVersion: 1,
      definition: { type: "integer", min: 1, max: 1 },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Expected a valid example document");
    expect(serializeDocument(parsed.value)).toContain('"schemaVersion": 1');
    expect(generate(parsed.value.definition, { seed: "fixture-v1" })).toBe(1);
    expect(() => generate({ type: "integer", min: 10, max: 1 })).toThrow(
      expect.objectContaining({ kind: "configuration", path: ["min"] }),
    );
  });
});
