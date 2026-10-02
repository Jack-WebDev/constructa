import { Button } from "@constructa/ui/components/button";
import { Copy, RefreshCw } from "lucide-react";
import { useState } from "react";

import { describeWebError } from "../errors/error-presentation";

export type ResultPreviewError = {
  readonly code: string;
  readonly kind: string;
  readonly message: string;
  readonly path: readonly (string | number)[];
};

export type ResultPreviewState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly value: unknown }
  | { readonly status: "error"; readonly error: ResultPreviewError };

const MAX_PREVIEW_LENGTH = 10_000;

export type ClipboardWriter = Pick<Clipboard, "writeText">;

export function ResultPreview({
  clipboard,
  onGenerate,
  state,
}: {
  readonly clipboard?: ClipboardWriter;
  readonly onGenerate?: () => void;
  readonly state: ResultPreviewState;
}) {
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copying" | "success" | "error"
  >("idle");
  const preview = state.status === "success" ? formatPreview(state.value) : "";
  const overflow = preview.length > MAX_PREVIEW_LENGTH;
  const visiblePreview = overflow
    ? `${preview.slice(0, MAX_PREVIEW_LENGTH)}…`
    : preview;

  async function copyPreview() {
    setCopyStatus("copying");
    try {
      await copyToClipboard(preview, clipboard);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <section
      aria-labelledby="result-title"
      className="scroll-mt-4 rounded-2xl border border-border/80 bg-card/90 p-5 shadow-foreground/5 shadow-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            className="font-serif text-2xl tracking-[-0.03em]"
            id="result-title"
          >
            Result
          </h2>
          <p className="mt-1 text-muted-foreground text-xs">
            Choose a generator, set its options, then generate a value.
          </p>
        </div>
        {state.status === "success" ? (
          <div className="flex shrink-0 gap-2">
            <Button
              aria-label="Copy result"
              className="h-8 rounded-lg px-3 text-[10px]"
              disabled={copyStatus === "copying"}
              onClick={copyPreview}
              size="sm"
              type="button"
              variant="outline"
            >
              <Copy className="size-3" />
              {copyStatus === "copying" ? "Copying…" : "Copy value"}
            </Button>
            {onGenerate === undefined ? null : (
              <Button
                className="h-8 rounded-lg px-3 text-[10px]"
                onClick={onGenerate}
                size="sm"
                type="button"
                variant="outline"
              >
                <RefreshCw className="size-3" /> Generate again
              </Button>
            )}
          </div>
        ) : null}
      </div>
      {state.status === "loading" ? (
        <p
          aria-live="polite"
          className="mt-3 text-muted-foreground text-sm"
          role="status"
        >
          Generating result…
        </p>
      ) : null}
      {state.status === "success" ? (
        <>
          <output
            aria-label="Generated result"
            aria-live="polite"
            className="result-reveal mt-3 flex h-20 max-h-[50dvh] items-center overflow-auto overscroll-contain rounded-xl border border-border/70 bg-muted/60 px-5 font-serif text-5xl tracking-[-0.04em] sm:max-h-96"
          >
            {visiblePreview}
          </output>
          <p aria-live="polite" className="sr-only">
            Generated result ready.
          </p>
          {copyStatus === "success" ? (
            <p className="mt-2 text-muted-foreground text-xs" role="status">
              Copied result.
            </p>
          ) : null}
          {copyStatus === "error" ? (
            <p className="mt-2 text-destructive text-xs" role="alert">
              Unable to copy the result. Check clipboard permissions and try
              again.
            </p>
          ) : null}
          {overflow ? (
            <p className="mt-2 text-muted-foreground text-xs" role="status">
              Preview truncated; the generated value is longer than{" "}
              {MAX_PREVIEW_LENGTH.toLocaleString()} characters.
            </p>
          ) : null}
        </>
      ) : null}
      {state.status === "error" ? <ErrorPreview error={state.error} /> : null}
    </section>
  );
}

function ErrorPreview({ error }: { readonly error: ResultPreviewError }) {
  const description = describeWebError(error);

  return (
    <div
      aria-live="assertive"
      className="mt-3 space-y-1 text-destructive"
      role="alert"
    >
      <p className="font-medium">{description.title}</p>
      <p>{description.message}</p>
      {error.kind === "system" ? null : (
        <p className="font-mono text-xs">
          {error.kind} / {error.code} at {formatPath(error.path)}
        </p>
      )}
    </div>
  );
}

export function formatPreview(value: unknown): string {
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

export async function copyToClipboard(
  value: string,
  clipboard: ClipboardWriter | undefined = globalThis.navigator?.clipboard,
): Promise<void> {
  if (clipboard === undefined) {
    throw new Error("Clipboard is unavailable.");
  }
  await clipboard.writeText(value);
}

function formatPath(path: readonly (string | number)[]): string {
  return path.length === 0 ? "definition" : path.join(".");
}
