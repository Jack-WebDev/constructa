import { Button } from "@constructa/ui/components/button";
import { serializeDocument } from "constructa-sdk";
import { useState } from "react";

import {
  type ClipboardWriter,
  copyToClipboard,
} from "../quick-generate/result-preview";
import { validateBuilderDraft } from "./builder-validation";
import type { BuilderDocumentDraft, BuilderDraftError } from "./state";
import { toGeneratorDocument } from "./state";

export type BuilderDocumentExport =
  | { readonly success: true; readonly source: string }
  | { readonly success: false; readonly errors: readonly BuilderDraftError[] };

/** Serializes only the validated, portable versioned generator document. */
export function createBuilderDocumentExport(
  draft: BuilderDocumentDraft,
): BuilderDocumentExport {
  const conversion = toGeneratorDocument(draft);
  if (!conversion.success) return { success: false, errors: conversion.errors };

  const validationErrors = validateBuilderDraft(draft);
  if (validationErrors.length > 0) {
    return { success: false, errors: validationErrors };
  }
  return { success: true, source: serializeDocument(conversion.document) };
}

export type DocumentDownloader = (source: string, filename: string) => void;

const downloadDocument: DocumentDownloader = (source, filename) => {
  const blob = new Blob([source], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

/** Offers canonical copy and download actions for the current Builder draft. */
export function BuilderDocumentExport({
  clipboard,
  download = downloadDocument,
  draft,
}: {
  readonly clipboard?: ClipboardWriter;
  readonly download?: DocumentDownloader;
  readonly draft: BuilderDocumentDraft;
}) {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<BuilderDraftError>();

  function exportDocument(): string | undefined {
    const result = createBuilderDocumentExport(draft);
    if (!result.success) {
      setError(result.errors[0]);
      setMessage(undefined);
      return undefined;
    }
    setError(undefined);
    return result.source;
  }

  async function copyDocument() {
    const source = exportDocument();
    if (source === undefined) return;
    try {
      await copyToClipboard(source, clipboard);
      setMessage("Document JSON copied.");
    } catch {
      setError({
        code: "COPY_FAILED",
        kind: "system",
        message: "Unable to copy the document JSON.",
        path: [],
      });
    }
  }

  function downloadCurrentDocument() {
    const source = exportDocument();
    if (source === undefined) return;
    try {
      download(source, "generator-document.json");
      setMessage("Document JSON downloaded.");
    } catch {
      setError({
        code: "DOWNLOAD_FAILED",
        kind: "system",
        message: "Unable to download the document JSON.",
        path: [],
      });
    }
  }

  return (
    <section aria-labelledby="document-export-title" className="border-t pt-6">
      <h2 className="font-medium text-lg" id="document-export-title">
        Export generator document
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Exports the validated versioned document only; previews and Builder-only
        state are excluded.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={() => void copyDocument()}
          type="button"
          variant="outline"
        >
          Copy document JSON
        </Button>
        <Button
          onClick={downloadCurrentDocument}
          type="button"
          variant="outline"
        >
          Download document JSON
        </Button>
      </div>
      {message === undefined ? null : (
        <p
          aria-live="polite"
          className="mt-3 text-muted-foreground text-sm"
          role="status"
        >
          {message}
        </p>
      )}
      {error === undefined ? null : (
        <p
          aria-live="assertive"
          className="mt-3 text-destructive text-sm"
          role="alert"
        >
          Export unavailable: {error.message}
          {error.kind === "system"
            ? null
            : ` (${error.kind} / ${error.code} at ${formatPath(error.path)})`}
        </p>
      )}
    </section>
  );
}

function formatPath(path: readonly (string | number)[]): string {
  return path.length === 0 ? "document" : path.join(".");
}
