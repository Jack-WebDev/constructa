import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  BuilderDocumentExport,
  type BuilderDocumentExport as BuilderDocumentExportResult,
  createBuilderDocumentExport,
} from "../document-export";
import { createBuilderDraft } from "../state";

const DOCUMENT = {
  schemaVersion: 1,
  name: "Employee",
  description: "Test employees",
  definition: { type: "object", fields: { id: { type: "uuid" } } },
};

describe("builder document export", () => {
  it("serializes a canonical portable document without Builder-only state", () => {
    let id = 0;
    const draft = createBuilderDraft(DOCUMENT, {
      createId: () => `ui-only-${++id}`,
    });
    const result = createBuilderDocumentExport(draft);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Expected export success");
    expect(JSON.parse(result.source)).toEqual(DOCUMENT);
    expect(result.source).not.toContain("ui-only");
  });

  it("rejects invalid drafts using the shared validation error", () => {
    const result = createBuilderDocumentExport(
      createBuilderDraft({
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: { age: { type: "integer", min: 2, max: 1 } },
        },
      }),
    );
    expect(result).toEqual({
      success: false,
      errors: [
        expect.objectContaining({
          kind: "configuration",
          path: ["definition", "fields", "age", "min"],
        }),
      ],
    });
  });

  it("copies and downloads the same canonical document", async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    const download = vi.fn();
    render(
      <BuilderDocumentExport
        clipboard={clipboard}
        download={download}
        draft={createBuilderDraft(DOCUMENT)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy document JSON" }));
    await vi.waitFor(() =>
      expect(clipboard.writeText).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Download document JSON" }),
    );
    const source = clipboard.writeText.mock.calls[0][0] as string;
    expect(download).toHaveBeenCalledWith(source, "generator-document.json");
    expect(screen.getByRole("status").textContent).toContain("downloaded");
  });

  it("keeps its export result type stable", () => {
    expectTypeOf<
      ReturnType<typeof createBuilderDocumentExport>
    >().toEqualTypeOf<BuilderDocumentExportResult>();
  });
});
