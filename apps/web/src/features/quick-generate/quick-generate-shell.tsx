import { Badge } from "@constructa/ui/components/badge";
import { Button } from "@constructa/ui/components/button";
import { Card, CardContent, CardHeader } from "@constructa/ui/components/card";
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
import { Play, Sparkles, WandSparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
  const configurationRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const editor = getGeneratorEditor(typeId);

  useEffect(() => {
    if (!shouldScrollToResult(generation) || !isCompactViewport()) {
      return;
    }
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [generation]);

  useEffect(() => {
    if (
      generation.status !== "error" ||
      generation.error.kind !== "configuration"
    ) {
      return;
    }
    configurationRef.current
      ?.querySelector<HTMLElement>('[aria-invalid="true"]')
      ?.focus();
  }, [generation]);

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
    <main className="app-page mx-auto grid max-w-6xl gap-5 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8 lg:py-12">
      <Card
        aria-labelledby="quick-generate-title"
        className="app-surface rounded-2xl py-0"
      >
        <CardHeader className="border-border/70 border-b px-5 py-5 sm:px-6">
          <Badge
            className="w-fit rounded-full border-primary/20 bg-primary/10 px-2.5 text-primary"
            variant="outline"
          >
            <Sparkles className="size-3" /> Quick generate
          </Badge>
          <div className="mt-3 space-y-2">
            <h1
              className="font-semibold text-3xl tracking-[-0.035em] sm:text-4xl"
              id="quick-generate-title"
            >
              Generate one value.
            </h1>
            <p
              className="text-muted-foreground text-sm leading-6"
              id="quick-generate-description"
            >
              Choose what you need, set the options, and generate a sample.
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-5 sm:p-6">
          <form
            aria-describedby="quick-generate-description"
            aria-labelledby="quick-generate-title"
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
              generateValue();
            }}
            ref={configurationRef}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="generator-type">Generator</Label>
              <select
                className="h-11 w-full rounded-xl border border-input bg-background/40 px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/80 dark:bg-input/30"
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

            <section
              aria-labelledby="configuration-title"
              className="space-y-3"
            >
              <h2 className="font-medium text-base" id="configuration-title">
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
            <div className="sticky bottom-0 z-10 -mx-5 mt-6 border-border/70 border-t bg-card/95 px-5 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:backdrop-blur-none">
              <Button
                className="h-11 w-full rounded-xl text-sm shadow-lg shadow-primary/15 lg:w-auto"
                type="submit"
              >
                <Play className="size-4" /> Generate
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <aside
        aria-label="Generation result"
        className="lg:sticky lg:top-24 lg:self-start"
        ref={resultRef}
      >
        <ResultPreview state={generation} />
        <div className="mt-4 hidden rounded-2xl border border-border/70 bg-muted/35 p-4 text-muted-foreground text-sm leading-6 lg:block">
          <WandSparkles className="mb-2 size-4 text-primary" />
          Only the options for your selected generator appear here. Generate a
          value whenever you are ready.
        </div>
      </aside>
    </main>
  );
}

function isCompactViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 1023px)").matches
  );
}

function shouldScrollToResult(generation: ResultPreviewState): boolean {
  return (
    generation.status === "success" ||
    (generation.status === "error" && generation.error.kind !== "configuration")
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
