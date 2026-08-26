import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  BuilderDocumentImport,
  type BuilderDocumentImportResult,
  MAX_DOCUMENT_IMPORT_BYTES,
  parseBuilderDocumentImport,
} from "../document-import";

afterEach(cleanup);

const VALID_DOCUMENT = {
  schemaVersion: 1,
  name: "Imported employee",
  definition: {
    type: "object",
    fields: { id: { type: "uuid" } },
  },
};

describe("builder document import", () => {
  it("parses a complete versioned document through the shared boundary", () => {
    expect(parseBuilderDocumentImport(JSON.stringify(VALID_DOCUMENT))).toEqual({
      success: true,
      document: VALID_DOCUMENT,
    });
  });

  it.each([
    ["malformed JSON", "{", "INVALID_JSON", []],
    [
      "unsupported version",
      JSON.stringify({ ...VALID_DOCUMENT, schemaVersion: 2 }),
      "INVALID_CONFIGURATION",
      ["schemaVersion"],
    ],
    [
      "unknown generator",
      JSON.stringify({ schemaVersion: 1, definition: { type: "missing" } }),
      "UNKNOWN_GENERATOR",
      ["definition", "type"],
    ],
    [
      "missing template reference",
      JSON.stringify({
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: { greeting: { type: "template", source: "{missing}" } },
        },
      }),
      "REFERENCE_NOT_FOUND",
      ["definition", "fields", "greeting"],
    ],
  ] as const)(
    "returns canonical errors for %s",
    (_name, source, code, path) => {
      const result = parseBuilderDocumentImport(source);
      expect(result.success).toBe(false);
      if (result.success) throw new Error("Expected import failure");
      expect(result.errors[0]).toMatchObject({ code, path });
    },
  );

  it("rejects sources exceeding the byte limit before parsing", () => {
    const result = parseBuilderDocumentImport("12345", 4);
    expect(result).toEqual({
      success: false,
      errors: [expect.objectContaining({ code: "IMPORT_TOO_LARGE", path: [] })],
    });
  });

  it("requires confirmation before a pasted document is imported", () => {
    const onImport = vi.fn();
    render(<BuilderDocumentImport onImport={onImport} />);

    fireEvent.change(screen.getByLabelText("Generator document JSON"), {
      target: { value: JSON.stringify(VALID_DOCUMENT) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review import" }));

    expect(screen.getByRole("alertdialog").textContent).toContain(
      "Replace current builder?",
    );
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Import document" }));
    expect(onImport).toHaveBeenCalledWith(VALID_DOCUMENT);
  });

  it("imports a selected file and preserves the current builder on failed review", async () => {
    const onImport = vi.fn();
    const file = new File(["ignored"], "employee.json", {
      type: "application/json",
    });
    render(
      <BuilderDocumentImport
        onImport={onImport}
        readFile={async () => JSON.stringify(VALID_DOCUMENT)}
      />,
    );

    fireEvent.change(screen.getByLabelText("Choose generator document file"), {
      target: { files: [file] },
    });
    await waitFor(() => expect(screen.getByRole("alertdialog")).not.toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onImport).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Generator document JSON"), {
      target: { value: "{" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review import" }));
    expect(screen.getByRole("alert").textContent).toContain("INVALID_JSON");
    expect(onImport).not.toHaveBeenCalled();
  });

  it("keeps the import result signature stable", () => {
    expectTypeOf<
      ReturnType<typeof parseBuilderDocumentImport>
    >().toEqualTypeOf<BuilderDocumentImportResult>();
    expect(MAX_DOCUMENT_IMPORT_BYTES).toBeGreaterThan(0);
  });
});
