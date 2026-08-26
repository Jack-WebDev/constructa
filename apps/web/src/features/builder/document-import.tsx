import { Button } from "@constructa/ui/components/button";
import { Input } from "@constructa/ui/components/input";
import { Label } from "@constructa/ui/components/label";
import { Textarea } from "@constructa/ui/components/textarea";
import type { GeneratorDocumentV1 } from "constructa-sdk";
import { useRef, useState } from "react";

import { validateBuilderDraft } from "./builder-validation";
import { type BuilderDraftError, createBuilderDraft } from "./state";

/** Maximum UTF-8 size accepted by the browser import surface. */
export const MAX_DOCUMENT_IMPORT_BYTES = 1_000_000;

export type BuilderDocumentImportResult =
  | { readonly success: true; readonly document: GeneratorDocumentV1 }
  | { readonly success: false; readonly errors: readonly BuilderDraftError[] };

/**
 * Parses and validates a versioned portable document without changing builder
 * state. Bare definitions are intentionally not accepted by this workflow.
 */
export function parseBuilderDocumentImport(
  source: string,
  maxBytes = MAX_DOCUMENT_IMPORT_BYTES,
): BuilderDocumentImportResult {
  const size = new TextEncoder().encode(source).byteLength;
  if (size > maxBytes) {
    return {
      success: false,
      errors: [
        {
          code: "IMPORT_TOO_LARGE",
          kind: "configuration",
          message: `The document exceeds the ${maxBytes.toLocaleString()} byte import limit.`,
          path: [],
        },
      ],
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return {
      success: false,
      errors: [
        {
          code: "INVALID_JSON",
          kind: "configuration",
          message: "Enter valid JSON for a generator document.",
          path: [],
        },
      ],
    };
  }

  const draft = createBuilderDraft(value);
  const errors = validateBuilderDraft(draft);
  if (errors.length > 0) return { success: false, errors };

  // validateBuilderDraft first runs the SDK document parser, so this cast is
  // guarded by the shared document boundary rather than UI-owned validation.
  return { success: true, document: draft.document as GeneratorDocumentV1 };
}

export type ImportFileReader = (file: File) => Promise<string>;

const readImportFile: ImportFileReader = (file) => file.text();

/** Provides paste and file import with review-before-replace confirmation. */
export function BuilderDocumentImport({
  onImport,
  readFile = readImportFile,
}: {
  readonly onImport: (document: GeneratorDocumentV1) => void;
  readonly readFile?: ImportFileReader;
}) {
  const [source, setSource] = useState("");
  const [errors, setErrors] = useState<readonly BuilderDraftError[]>([]);
  const [pendingDocument, setPendingDocument] = useState<GeneratorDocumentV1>();
  const fileRequest = useRef(0);

  function review(sourceToReview: string) {
    const result = parseBuilderDocumentImport(sourceToReview);
    if (!result.success) {
      setPendingDocument(undefined);
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setPendingDocument(result.document);
  }

  async function importFile(file: File | undefined) {
    if (file === undefined) return;
    const request = ++fileRequest.current;
    if (file.size > MAX_DOCUMENT_IMPORT_BYTES) {
      review(" ".repeat(MAX_DOCUMENT_IMPORT_BYTES + 1));
      return;
    }
    try {
      const fileSource = await readFile(file);
      if (request !== fileRequest.current) return;
      setSource(fileSource);
      review(fileSource);
    } catch {
      if (request !== fileRequest.current) return;
      setPendingDocument(undefined);
      setErrors([
        {
          code: "IMPORT_READ_FAILED",
          kind: "system",
          message: "The selected file could not be read.",
          path: [],
        },
      ]);
    }
  }

  return (
    <section aria-labelledby="document-import-title" className="border-t pt-6">
      <div className="space-y-1">
        <h2 className="font-medium text-lg" id="document-import-title">
          Import generator document
        </h2>
        <p className="text-muted-foreground text-sm">
          Paste or choose a versioned JSON document. Import replaces the current
          builder after review.
        </p>
      </div>
      <div className="mt-4 grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="builder-document-import">
            Generator document JSON
          </Label>
          <Textarea
            id="builder-document-import"
            onChange={(event) => setSource(event.target.value)}
            placeholder='{"schemaVersion": 1, "definition": { "type": "object", "fields": {} }}'
            value={source}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="builder-document-file">
            Choose generator document file
          </Label>
          <Input
            accept="application/json,.json"
            id="builder-document-file"
            onChange={(event) => void importFile(event.target.files?.[0])}
            type="file"
          />
        </div>
        <div>
          <Button
            onClick={() => review(source)}
            type="button"
            variant="outline"
          >
            Review import
          </Button>
        </div>
      </div>
      {errors.length === 0 ? null : (
        <div
          aria-live="assertive"
          className="mt-4 text-destructive text-sm"
          role="alert"
        >
          <p className="font-medium">Document import unavailable</p>
          <ul className="mt-1 list-inside list-disc">
            {errors.map((error, index) => (
              <li key={`${error.path.join(".")}:${error.code}:${index}`}>
                {formatPath(error.path)}: {error.message} ({error.kind} /{" "}
                {error.code})
              </li>
            ))}
          </ul>
        </div>
      )}
      {pendingDocument === undefined ? null : (
        <div
          aria-describedby="confirm-document-import-description"
          aria-labelledby="confirm-document-import-title"
          className="mt-4 flex flex-wrap items-center gap-2 rounded border p-3"
          role="alertdialog"
        >
          <div className="mr-auto">
            <p className="font-medium" id="confirm-document-import-title">
              Replace current builder?
            </p>
            <p
              className="text-muted-foreground text-sm"
              id="confirm-document-import-description"
            >
              The imported document is valid and will replace the current fields
              and details.
            </p>
          </div>
          <Button
            onClick={() => setPendingDocument(undefined)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onImport(pendingDocument);
              setPendingDocument(undefined);
            }}
            type="button"
          >
            Import document
          </Button>
        </div>
      )}
    </section>
  );
}

function formatPath(path: readonly (string | number)[]): string {
  return path.length === 0 ? "document" : path.join(".");
}
