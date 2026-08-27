import { Button } from "@constructa/ui/components/button";
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
  state,
}: {
  readonly clipboard?: ClipboardWriter;
  readonly state: ResultPreviewState;
}) {
  return (
    <section
      aria-labelledby="result-title"
      className="app-surface scroll-mt-4 rounded-2xl p-5 sm:p-6"
    >
      <h2 className="font-medium text-lg" id="result-title">
        Result
      </h2>
      {state.status === "idle" ? (
        <p className="mt-3 text-muted-foreground text-sm">
          Choose a generator, set its options, then generate a value.
        </p>
      ) : null}
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
        <SuccessPreview
          clipboard={clipboard}
          key={formatPreview(state.value)}
          value={state.value}
        />
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

function SuccessPreview({
  clipboard,
  value,
}: {
  readonly clipboard?: ClipboardWriter;
  readonly value: unknown;
}) {
  const preview = formatPreview(value);
  const [copyStatus, setCopyStatus] = useState<
    "idle" | "copying" | "success" | "error"
  >("idle");
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
    <>
      <output
        aria-label="Generated result"
        aria-live="polite"
        className="result-reveal mt-3 block max-h-[50dvh] overflow-auto overscroll-contain whitespace-pre-wrap break-words rounded-xl border border-border/70 bg-muted/60 p-3 font-mono text-sm sm:max-h-96"
      >
        {visiblePreview}
      </output>
      <p aria-live="polite" className="sr-only">
        Generated result ready.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          className="h-11 rounded-xl text-sm focus-visible:ring-2"
          disabled={copyStatus === "copying"}
          onClick={copyPreview}
          type="button"
        >
          {copyStatus === "copying" ? "Copying…" : "Copy result"}
        </Button>
        {copyStatus === "success" ? (
          <p
            aria-live="polite"
            className="text-muted-foreground text-xs"
            role="status"
          >
            Copied result.
          </p>
        ) : null}
        {copyStatus === "error" ? (
          <p className="text-destructive text-xs" role="alert">
            Unable to copy the result. Check clipboard permissions and try
            again.
          </p>
        ) : null}
      </div>
      {overflow ? (
        <p className="mt-2 text-muted-foreground text-xs" role="status">
          Preview truncated; the generated value is longer than{" "}
          {MAX_PREVIEW_LENGTH.toLocaleString()} characters.
        </p>
      ) : null}
    </>
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
