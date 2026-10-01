import { Button } from "@constructa/ui/components/button";
import { Input } from "@constructa/ui/components/input";
import { type GeneratorDefinition, generate } from "constructa-sdk";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { describeWebError, type WebError } from "../errors/error-presentation";
import type { BuilderDocumentDraft } from "./state";
import { toGeneratorDocument } from "./state";

/** The quiet period applied to builder edits before a new preview is generated. */
export const LIVE_PREVIEW_DEBOUNCE_MS = 300;

export type PreviewGenerator = (
  definition: GeneratorDefinition,
  options?: { readonly seed?: string },
) => unknown | Promise<unknown>;

type LivePreviewState =
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly value: unknown }
  | { readonly status: "unavailable"; readonly error: WebError };

const generatePreview: PreviewGenerator = (definition, options) =>
  generate(definition, options);

/**
 * Runs the current builder draft through the same portable-document and SDK
 * execution boundaries used elsewhere. The seed belongs only to this UI.
 */
export function LivePreview({
  draft,
  execute = generatePreview,
}: {
  readonly draft: BuilderDocumentDraft;
  readonly execute?: PreviewGenerator;
}) {
  const [seed, setSeed] = useState("");
  const [state, setState] = useState<LivePreviewState>({ status: "loading" });
  const requestId = useRef(0);

  const requestPreview = useCallback(
    (currentRequest = ++requestId.current) => {
      const conversion = toGeneratorDocument(draft);

      if (!conversion.success) {
        setState({ status: "unavailable", error: conversion.errors[0] });
        return;
      }

      setState({ status: "loading" });
      const options = seed === "" ? undefined : { seed };
      void Promise.resolve()
        .then(() => execute(conversion.document.definition, options))
        .then(
          (value) => {
            if (requestId.current !== currentRequest) return;
            setState({ status: "success", value });
          },
          (cause: unknown) => {
            if (requestId.current !== currentRequest) return;
            setState({ status: "unavailable", error: toWebError(cause) });
          },
        );
    },
    [draft, execute, seed],
  );

  useEffect(() => {
    // Invalidate an in-flight result as soon as the draft changes, rather
    // than waiting for the debounce timer to begin the replacement request.
    const currentRequest = ++requestId.current;
    const timeout = window.setTimeout(
      () => requestPreview(currentRequest),
      LIVE_PREVIEW_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [requestPreview]);

  return (
    <section aria-labelledby="live-preview-title" className="min-h-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.14em]">
            Live preview
          </p>
          <h2 className="mt-1 font-medium text-base" id="live-preview-title">
            Result
          </h2>
          <p className="text-muted-foreground text-sm">
            Updates shortly after you stop editing.
          </p>
        </div>
        <Button
          aria-label="Regenerate"
          onClick={() => requestPreview()}
          type="button"
          className="rounded-lg"
          variant="outline"
        >
          <RefreshCw /> New sample
        </Button>
      </div>
      <details className="mt-5 border-border/70 border-t pt-4">
        <summary className="cursor-pointer font-medium text-muted-foreground text-sm marker:text-muted-foreground">
          Preview options
        </summary>
        <div className="mt-3 grid gap-1.5">
          <label className="font-medium text-sm" htmlFor="preview-seed">
            Fixed preview seed
          </label>
          <Input
            id="preview-seed"
            onChange={(event) => setSeed(event.target.value)}
            placeholder="Leave blank for a fresh sample"
            type="text"
            value={seed}
          />
          <p className="text-muted-foreground text-xs">
            Use a seed to repeat the same sample. It is not saved with this
            generator.
          </p>
        </div>
      </details>
      {state.status === "loading" ? (
        <p
          aria-live="polite"
          className="mt-4 text-muted-foreground text-sm"
          role="status"
        >
          Updating preview…
        </p>
      ) : null}
      {state.status === "success" ? (
        <output
          aria-label="Live preview result"
          aria-live="polite"
          className="result-reveal mt-4 block max-h-[34rem] overflow-auto overscroll-contain whitespace-pre-wrap break-words border border-border/70 bg-background/70 p-3 font-mono text-sm"
        >
          {formatPreview(state.value)}
        </output>
      ) : null}
      {state.status === "unavailable" ? (
        <UnavailablePreview error={state.error} />
      ) : null}
    </section>
  );
}

function UnavailablePreview({ error }: { readonly error: WebError }) {
  const description = describeWebError(error);
  return (
    <div
      aria-live="assertive"
      className="mt-4 text-destructive text-sm"
      role="alert"
    >
      <p className="font-medium">Preview unavailable</p>
      <p>{description.message}</p>
    </div>
  );
}

function toWebError(cause: unknown): WebError {
  if (
    typeof cause === "object" &&
    cause !== null &&
    typeof (cause as Partial<WebError>).code === "string" &&
    typeof (cause as Partial<WebError>).kind === "string" &&
    typeof (cause as Partial<WebError>).message === "string" &&
    Array.isArray((cause as Partial<WebError>).path)
  ) {
    return cause as WebError;
  }
  return {
    code: "PREVIEW_FAILED",
    kind: "system",
    message: "Unable to generate a preview.",
    path: [],
  };
}

function formatPreview(value: unknown): string {
  if (typeof value === "string") return value;
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return String(value);
  }
  return JSON.stringify(value, null, 2) ?? "undefined";
}
