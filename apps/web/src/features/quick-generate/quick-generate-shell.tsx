import { Button } from "@constructa/ui/components/button";
import { Label } from "@constructa/ui/components/label";
import {
  BUILT_IN_GENERATOR_CATALOG,
  choice,
  date,
  decimal,
  type GeneratorDefinition,
  generate,
  integer,
  string,
} from "constructa-sdk";
import { useState } from "react";

import type { DefinitionProperties } from "../editor/controls";
import {
  type EditorValidationIssue,
  getGeneratorEditor,
} from "../editor/registry";
import {
  DefinitionErrorSummary,
  toFieldIssues,
} from "../errors/error-presentation";
import {
  ResultPreview,
  type ResultPreviewError,
  type ResultPreviewState,
} from "./result-preview";

const DEFAULT_TYPE_ID = "integer";

export function QuickGenerateShell() {
  const [typeId, setTypeId] = useState(DEFAULT_TYPE_ID);
  const [definition, setDefinition] = useState(() =>
    createDefinitionDraft(DEFAULT_TYPE_ID),
  );
  const [generation, setGeneration] = useState<ResultPreviewState>({
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
    setIssues(validateQuickGenerateDraft(properties));
    setGeneration({ status: "idle" });
  }

  function generateValue() {
    try {
      setGeneration({
        status: "success",
        value: generate(definition as GeneratorDefinition),
      });
    } catch (cause) {
      const error = toGenerationError(cause);
      if (error.kind === "configuration") {
        setIssues(toFieldIssues([error]));
      }
      setGeneration({ status: "error", error });
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
          <DefinitionErrorSummary issues={issues} />
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

      <ResultPreview state={generation} />
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

function toGenerationError(cause: unknown): ResultPreviewError {
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

function isGenerationError(cause: unknown): cause is ResultPreviewError {
  if (typeof cause !== "object" || cause === null) return false;
  const value = cause as Partial<ResultPreviewError>;
  return (
    typeof value.code === "string" &&
    typeof value.kind === "string" &&
    typeof value.message === "string" &&
    Array.isArray(value.path)
  );
}

function validateQuickGenerateDraft(
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
    } else if (definition.type === "choice") {
      choice(definition.values as never);
    } else if (definition.type === "string") {
      string({
        length: definition.length as number,
        charset: definition.charset as string,
      });
    } else if (definition.type === "date") {
      date({ min: definition.min as string, max: definition.max as string });
    }
    return [];
  } catch (cause) {
    if (isGenerationError(cause)) {
      return [{ message: cause.message, path: cause.path }];
    }
    return [];
  }
}
