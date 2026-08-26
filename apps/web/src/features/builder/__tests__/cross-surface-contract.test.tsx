import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { generate, safeParseDocument, serializeDocument } from "constructa-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBuilderDocumentExport } from "../document-export";
import { parseBuilderDocumentImport } from "../document-import";
import { LIVE_PREVIEW_DEBOUNCE_MS, LivePreview } from "../live-preview";
import { createBuilderDraft } from "../state";

const SEEDED_DOCUMENT = {
  schemaVersion: 1,
  name: "Contract employee",
  definition: {
    type: "object",
    fields: {
      greeting: { type: "template", source: "Hello {name}" },
      name: { type: "choice", values: ["Ada", "Grace"] },
      id: { type: "uuid" },
      age: { type: "integer", min: 18, max: 65 },
      tags: {
        type: "array",
        length: 2,
        item: { type: "choice", values: ["new", "verified"] },
      },
      profile: { type: "object", fields: { active: { type: "boolean" } } },
    },
  },
} as const;

const PRIMITIVE_DOCUMENT = {
  schemaVersion: 1,
  definition: { type: "integer", min: 7, max: 7 },
} as const;

const UNKNOWN_GENERATOR_DOCUMENT = {
  schemaVersion: 1,
  definition: { type: "unknown" },
};

const MISSING_REFERENCE_DOCUMENT = {
  schemaVersion: 1,
  definition: {
    type: "object",
    fields: { greeting: { type: "template", source: "{missing}" } },
  },
};

const HOSTILE_DEPTH_DOCUMENT = {
  schemaVersion: 1,
  definition: {
    type: "object",
    fields: {
      nested: {
        type: "object",
        fields: { value: { type: "integer", min: 1, max: 1 } },
      },
    },
  },
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("cross-surface portable document contract", () => {
  it("keeps primitive documents canonical through Builder import and export", () => {
    const source = serializeDocument(PRIMITIVE_DOCUMENT);
    const imported = parseBuilderDocumentImport(source);
    expect(imported).toEqual({ success: true, document: PRIMITIVE_DOCUMENT });
    if (!imported.success) throw new Error("Expected primitive import success");
    expect(
      createBuilderDocumentExport(createBuilderDraft(imported.document)),
    ).toEqual({
      success: true,
      source,
    });
    expect(generate(imported.document.definition, { seed: "primitive" })).toBe(
      7,
    );
  });

  it("preserves seeded primitive, nested object, array, and forward-reference values", () => {
    const parsed = safeParseDocument(SEEDED_DOCUMENT);
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("Expected a valid contract document");

    const seed = "cross-surface";
    const expected = generate(SEEDED_DOCUMENT.definition, { seed });
    const serialized = serializeDocument(SEEDED_DOCUMENT);
    const imported = parseBuilderDocumentImport(serialized);
    expect(imported).toEqual({ success: true, document: SEEDED_DOCUMENT });
    if (!imported.success) throw new Error("Expected import success");
    const exported = createBuilderDocumentExport(
      createBuilderDraft(imported.document),
    );
    expect(exported).toEqual({ success: true, source: serialized });
    expect(generate(parsed.value.definition, { seed })).toEqual(expected);
    expect(generate(imported.document.definition, { seed })).toEqual(expected);
  });

  it("renders the same seeded value through the live-preview adapter", async () => {
    vi.useFakeTimers();
    const seed = "web-preview";
    const expected = generate(SEEDED_DOCUMENT.definition, { seed });
    render(<LivePreview draft={createBuilderDraft(SEEDED_DOCUMENT)} />);
    fireEvent.change(screen.getByLabelText("Preview seed (optional)"), {
      target: { value: seed },
    });
    await act(async () => {
      vi.advanceTimersByTime(LIVE_PREVIEW_DEBOUNCE_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      JSON.parse(
        screen.getByLabelText("Live preview result").textContent ?? "null",
      ),
    ).toEqual(expected);
  });

  it("preserves shared failure kind, code, and document path for an unknown generator", () => {
    const sdk = safeParseDocument(UNKNOWN_GENERATOR_DOCUMENT);
    const web = parseBuilderDocumentImport(
      JSON.stringify(UNKNOWN_GENERATOR_DOCUMENT),
    );
    expect(sdk.success).toBe(false);
    expect(web.success).toBe(false);
    if (sdk.success || web.success)
      throw new Error("Expected contract failure");
    expect(web.errors[0]).toMatchObject({
      kind: sdk.issues[0].kind,
      code: sdk.issues[0].code,
      path: sdk.issues[0].path,
    });
  });

  it("normalizes engine dependency failures to the portable document path", () => {
    expect(() => generate(MISSING_REFERENCE_DOCUMENT.definition)).toThrow(
      expect.objectContaining({
        kind: "dependency",
        code: "REFERENCE_NOT_FOUND",
        path: ["greeting"],
      }),
    );
    const web = parseBuilderDocumentImport(
      JSON.stringify(MISSING_REFERENCE_DOCUMENT),
    );
    expect(web).toEqual({
      success: false,
      errors: [
        expect.objectContaining({
          kind: "dependency",
          code: "REFERENCE_NOT_FOUND",
          path: ["definition", "fields", "greeting"],
        }),
      ],
    });
  });

  it("enforces parser depth limits on hostile nested documents", () => {
    const result = safeParseDocument(HOSTILE_DEPTH_DOCUMENT, {
      limits: { maxDepth: 1 },
    });
    expect(result).toEqual({
      success: false,
      issues: [
        expect.objectContaining({
          kind: "configuration",
          code: "PARSE_DEPTH_LIMIT",
          path: ["definition", "fields", "nested", "fields", "value"],
        }),
      ],
    });
  });
});
