import { Button } from "@constructa/ui/components/button";
import { Label } from "@constructa/ui/components/label";
import {
  BUILT_IN_GENERATOR_CATALOG,
  decimal,
  type GeneratorDefinition,
  generate,
  integer,
} from "constructa-sdk";
import { useState } from "react";

import type { DefinitionProperties } from "../editor/controls";
import {
  type EditorValidationIssue,
  getGeneratorEditor,
} from "../editor/registry";

type GenerationError = {
  readonly code: string;
  readonly kind: string;
  readonly message: string;
  readonly path: readonly (string | number)[];
};

type GenerationState =
  | { readonly status: "idle" }
  | { readonly status: "success"; readonly value: unknown }
  | { readonly status: "error"; readonly error: GenerationError };

const DEFAULT_TYPE_ID = "integer";

export function QuickGenerateShell() {
  const [typeId, setTypeId] = useState(DEFAULT_TYPE_ID);
  const [definition, setDefinition] = useState(() =>
    createDefinitionDraft(DEFAULT_TYPE_ID),
  );
  const [generation, setGeneration] = useState<GenerationState>({
    status: "idle",
  });
  const [issues, setIssues] = useState<readonly EditorValidationIssue[]>([]);
  const editor = getGeneratorEditor(typeId);

  function selectGenerator(nextTypeId: string) {
    setTypeId(nextTypeId);
    setDefinition(createDefinitionDraft(nextTypeId));
    setIssues([]);
    setGeneration({ status: "idle" });
  }

  function updateDefinition(properties: DefinitionProperties) {
    setDefinition(properties);
    setIssues(validateNumericDraft(properties));
    setGeneration({ status: "idle" });
  }

  function generateValue() {
    try {
      setGeneration({
        status: "success",
        value: generate(definition as GeneratorDefinition),
      });
    } catch (cause) {
      setGeneration({ status: "error", error: toGenerationError(cause) });
    }
  }

  const Editor = editor?.Editor;

  return (
    <main className="container mx-auto grid max-w-5xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="quick-generate-title" className="space-y-6">
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground uppercase tracking-wider">
            Quick Generate
          </p>
          <h1
            className="font-semibold text-4xl tracking-tight"
            id="quick-generate-title"
          >
            Generate one value.
          </h1>
          <p className="text-muted-foreground">
            Choose a generator, adjust its definition, and run it through the
            shared engine.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="generator-type">Generator</Label>
          <select
            id="generator-type"
            onChange={(event) => selectGenerator(event.target.value)}
            value={typeId}
          >
            {BUILT_IN_GENERATOR_CATALOG.map((entry) => (
              <option key={entry.typeId} value={entry.typeId}>
                {entry.displayName}
              </option>
            ))}
          </select>
        </div>

        <section aria-labelledby="configuration-title" className="space-y-3">
          <h2 className="font-medium text-lg" id="configuration-title">
            Configuration
          </h2>
          {Editor === undefined ? (
            <p role="alert">The selected generator is not available.</p>
          ) : (
            <Editor
              definition={definition}
              issues={issues}
              onChange={updateDefinition}
            />
          )}
          {hasEditableProperties(definition) ? null : (
            <p className="text-muted-foreground text-sm">
              This generator has no editable configuration.
            </p>
          )}
        </section>

        <Button onClick={generateValue} type="button">
          Generate
        </Button>
      </section>

      <section aria-labelledby="result-title" className="rounded-lg border p-5">
        <h2 className="font-medium text-lg" id="result-title">
          Result
        </h2>
        {generation.status === "idle" ? (
          <p className="mt-3 text-muted-foreground text-sm">
            Configure a generator, then select Generate.
          </p>
        ) : null}
        {generation.status === "success" ? (
          <output
            aria-live="polite"
            className="mt-3 block overflow-auto rounded bg-muted p-3 font-mono text-sm"
          >
            {formatResult(generation.value)}
          </output>
        ) : null}
        {generation.status === "error" ? (
          <div
            aria-live="assertive"
            className="mt-3 space-y-1 text-destructive"
            role="alert"
          >
            <p>{generation.error.message}</p>
            <p className="font-mono text-xs">
              {generation.error.kind} / {generation.error.code} at{" "}
              {formatPath(generation.error.path)}
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function createDefinitionDraft(typeId: string): DefinitionProperties {
  const catalogEntry = BUILT_IN_GENERATOR_CATALOG.find(
    (entry) => entry.typeId === typeId,
  );
  const example = catalogEntry?.examples[0];
  if (example === undefined) return { type: typeId };
  return structuredClone(example) as DefinitionProperties;
}

function hasEditableProperties(definition: DefinitionProperties): boolean {
  return Object.keys(definition).some((key) => key !== "type");
}

function formatResult(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? "undefined";
}

function toGenerationError(cause: unknown): GenerationError {
  if (isGenerationError(cause)) {
    return {
      code: cause.code,
      kind: cause.kind,
      message: cause.message,
      path: cause.path,
    };
  }
  return {
    code: "SYSTEM_ERROR",
    kind: "system",
    message: "Unable to generate a value.",
    path: [],
  };
}

function isGenerationError(cause: unknown): cause is GenerationError {
  if (typeof cause !== "object" || cause === null) return false;
  const value = cause as Partial<GenerationError>;
  return (
    typeof value.code === "string" &&
    typeof value.kind === "string" &&
    typeof value.message === "string" &&
    Array.isArray(value.path)
  );
}

function formatPath(path: readonly (string | number)[]): string {
  return path.length === 0 ? "definition" : path.join(".");
}

function validateNumericDraft(
  definition: DefinitionProperties,
): readonly EditorValidationIssue[] {
  try {
    if (definition.type === "integer") {
      integer({ min: definition.min as number, max: definition.max as number });
    } else if (definition.type === "decimal") {
      decimal({
        min: definition.min as number,
        max: definition.max as number,
        precision: definition.precision as number,
      });
    }
    return [];
  } catch (cause) {
    if (isGenerationError(cause)) {
      return [{ message: cause.message, path: cause.path }];
    }
    return [];
  }
}
