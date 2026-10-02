import { Badge } from "@constructa/ui/components/badge";
import { Button } from "@constructa/ui/components/button";
import { Card, CardContent } from "@constructa/ui/components/card";
import { Input } from "@constructa/ui/components/input";
import { Label } from "@constructa/ui/components/label";
import { Switch } from "@constructa/ui/components/switch";
import {
  BUILT_IN_GENERATOR_CATALOG,
  choice,
  createSeededRandom,
  date,
  decimal,
  type GeneratorDefinition,
  generate,
  integer,
  type RandomSource,
  string,
} from "constructa-sdk";
import {
  ArrowRight,
  Braces,
  ChevronDown,
  Copy,
  Database,
  Layers3,
  Lightbulb,
  Play,
  RefreshCw,
  Settings2,
  Sparkles,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

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

type OutputFormat = "number" | "string";

type AdvancedOptions = {
  readonly allowNegative: boolean;
  readonly excludeValues: string;
  readonly outputFormat: OutputFormat;
  readonly padWithLeadingZeros: boolean;
  readonly seed: string;
  readonly step: number;
  readonly uniqueExamples: boolean;
};

const DEFAULT_ADVANCED_OPTIONS: AdvancedOptions = {
  allowNegative: false,
  excludeValues: "",
  outputFormat: "number",
  padWithLeadingZeros: false,
  seed: "",
  step: 1,
  uniqueExamples: false,
};

class AdvancedOptionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdvancedOptionsError";
  }
}

export function QuickGenerateShell() {
  const [typeId, setTypeId] = useState(DEFAULT_TYPE_ID);
  const [definition, setDefinition] = useState(() =>
    createDefinitionDraft(DEFAULT_TYPE_ID),
  );
  const [generation, setGeneration] = useState<ResultPreviewState>({
    status: "success",
    value: 57,
  });
  const [issues, setIssues] = useState<readonly EditorValidationIssue[]>([]);
  const [advancedOptions, setAdvancedOptions] = useState<AdvancedOptions>(
    DEFAULT_ADVANCED_OPTIONS,
  );
  const [exampleValues, setExampleValues] = useState(() =>
    createExampleValues(
      createDefinitionDraft(DEFAULT_TYPE_ID),
      DEFAULT_ADVANCED_OPTIONS,
    ),
  );
  const configurationRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const editor = getGeneratorEditor(typeId);
  const catalogEntry = BUILT_IN_GENERATOR_CATALOG.find(
    (entry) => entry.typeId === typeId,
  );

  useEffect(() => {
    if (!shouldScrollToResult(generation) || !isCompactViewport()) return;
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
    const nextDefinition = createDefinitionDraft(nextTypeId);
    setTypeId(nextTypeId);
    setDefinition(nextDefinition);
    setExampleValues(createExampleValues(nextDefinition, advancedOptions));
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
        value: formatGeneratedValue(
          generateAdvancedValue(definition, advancedOptions),
          definition,
          advancedOptions,
        ),
      });
    } catch (cause) {
      const error = toGenerationError(cause);
      if (
        error.kind === "configuration" &&
        error.path[0] !== "advancedOptions"
      ) {
        setIssues(toFieldIssues([error]));
      }
      setGeneration({ status: "error", error });
    }
  }

  function updateAdvancedOptions(nextOptions: AdvancedOptions) {
    setAdvancedOptions(nextOptions);
    setGeneration({ status: "idle" });
  }

  function generateExamples() {
    setExampleValues(createExampleValues(definition, advancedOptions));
  }

  const Editor = editor?.Editor;
  const generatorName = catalogEntry?.displayName ?? "Generator";
  const generatorDescription =
    catalogEntry?.description ?? "Generates a value from its options.";
  const outputCategory = catalogEntry?.outputCategory ?? "value";

  return (
    <main>
      <div className="relative mx-auto mt-12 w-full max-w-360 lg:col-span-2">
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Card
            aria-labelledby="quick-generate-title"
            className="rounded-2xl border-border/80 bg-card/90 py-0 shadow-foreground/5 shadow-xl"
          >
            <CardContent className="p-6">
              <Badge className="rounded-full border-0 bg-primary/10 px-3 py-1 font-medium text-[10px] text-primary uppercase tracking-wide">
                <Sparkles aria-hidden="true" className="size-3" /> Quick
                generate
              </Badge>
              <h1
                className="mt-3 font-serif text-4xl tracking-[-0.045em] sm:text-5xl"
                id="quick-generate-title"
              >
                Generate one value.
              </h1>
              <p
                className="mt-2 text-muted-foreground text-sm leading-6"
                id="quick-generate-description"
              >
                Choose what you need, set the options, and generate a sample.
              </p>

              <form
                aria-describedby="quick-generate-description"
                aria-labelledby="quick-generate-title"
                className="mt-5 border-border/70 border-t pt-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  generateValue();
                }}
                ref={configurationRef}
              >
                <Step
                  description="Choose a built-in generator to get started."
                  number={1}
                  title="Select a generator"
                >
                  <div className="relative mt-3">
                    <Layers3
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
                    />
                    <Label className="sr-only" htmlFor="generator-type">
                      Generator
                    </Label>
                    <select
                      className="h-11 w-full appearance-none rounded-lg border border-input bg-muted/35 pr-10 pl-12 font-serif text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/80"
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
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-4 py-3 text-muted-foreground text-xs">
                    <span>{generatorDescription}</span>
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[10px] text-secondary-foreground">
                      {outputCategory}
                    </span>
                  </div>
                </Step>

                <Step
                  className="mt-6"
                  description="Set the options for your generator."
                  number={2}
                  title="Configure options"
                >
                  <div className="mt-3">
                    {Editor === undefined ? (
                      <p role="alert">
                        The selected generator is not available.
                      </p>
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
                  </div>
                </Step>

                <details
                  className="group mt-4 rounded-lg border border-border/70 bg-muted/25"
                  open
                >
                  <summary className="flex h-11 cursor-pointer list-none items-center gap-3 px-4 text-muted-foreground text-xs">
                    <Settings2
                      aria-hidden="true"
                      className="size-4 text-foreground"
                    />
                    Advanced options
                    <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
                  </summary>
                  <AdvancedOptionsPanel
                    definition={definition}
                    onChange={updateAdvancedOptions}
                    options={advancedOptions}
                  />
                </details>

                <Button
                  className="mt-4 h-11 w-full rounded-lg text-sm shadow-lg shadow-primary/20"
                  type="submit"
                >
                  <Play className="size-4" /> Generate{" "}
                  <ArrowRight className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <aside aria-label="Generation result" ref={resultRef}>
            <ResultPreview onGenerate={generateValue} state={generation} />
            <GeneratorDetails
              definition={definition}
              description={generatorDescription}
              exampleValues={exampleValues}
              onGenerateExamples={generateExamples}
              title={generatorName}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

function Step({
  children,
  className,
  description,
  number,
  title,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly description: string;
  readonly number: number;
  readonly title: string;
}) {
  return (
    <section className={className}>
      <div className="flex gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent font-semibold text-accent-foreground text-sm">
          {number}
        </span>
        <div>
          <h2 className="font-serif text-lg tracking-[-0.02em]">{title}</h2>
          <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function AdvancedOptionsPanel({
  definition,
  onChange,
  options,
}: {
  readonly definition: DefinitionProperties;
  readonly onChange: (options: AdvancedOptions) => void;
  readonly options: AdvancedOptions;
}) {
  const supportsNumericRules = isNumericGenerator(definition);
  const leadingZerosDisabled = options.outputFormat !== "string";

  function update(changes: Partial<AdvancedOptions>) {
    onChange({ ...options, ...changes });
  }

  return (
    <div className="divide-y divide-border/70 border-border/70 border-t">
      <section className="px-4 py-3" aria-labelledby="reproducibility-title">
        <h3
          className="font-medium text-foreground text-xs"
          id="reproducibility-title"
        >
          Reproducibility
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Use a seed to get repeatable results.
        </p>
        <div className="mt-2 grid gap-1.5">
          <Label className="text-xs" htmlFor="quick-generate-seed">
            Seed{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Input
            className="h-9 rounded-lg text-sm"
            id="quick-generate-seed"
            onChange={(event) => update({ seed: event.target.value })}
            placeholder="e.g. 2026"
            type="text"
            value={options.seed}
          />
          <p className="text-[11px] text-muted-foreground">
            The same seed and options always produce the same result.
          </p>
        </div>
      </section>

      {supportsNumericRules ? (
        <section className="px-4 py-3" aria-labelledby="value-rules-title">
          <h3
            className="font-medium text-foreground text-xs"
            id="value-rules-title"
          >
            Value rules
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Control which numeric values can be generated.
          </p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs" htmlFor="quick-generate-step">
                Step
              </Label>
              <Input
                className="h-9 rounded-lg text-sm"
                id="quick-generate-step"
                inputMode="decimal"
                min="0.000001"
                onChange={(event) =>
                  update({ step: parsePositiveNumber(event.target.value) })
                }
                step="any"
                type="number"
                value={options.step}
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                className="text-xs"
                htmlFor="quick-generate-exclude-values"
              >
                Exclude values{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                className="h-9 rounded-lg text-sm"
                id="quick-generate-exclude-values"
                onChange={(event) =>
                  update({ excludeValues: event.target.value })
                }
                placeholder="e.g. 13, 42"
                type="text"
                value={options.excludeValues}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Switch
              checked={options.allowNegative}
              id="allow-negative-values"
              onCheckedChange={(checked) => update({ allowNegative: checked })}
            />
            <div>
              <Label className="text-xs" htmlFor="allow-negative-values">
                Allow negative values
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Include negative numbers when they are in the configured range.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {supportsNumericRules ? (
        <section className="px-4 py-3" aria-labelledby="output-format-title">
          <h3
            className="font-medium text-foreground text-xs"
            id="output-format-title"
          >
            Output format
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Choose how a numeric value should be returned.
          </p>
          <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-lg border border-border/70">
            {(["number", "string"] as const).map((format) => (
              <label
                className="flex h-9 cursor-pointer items-center justify-center gap-2 border-border/70 text-xs first:border-r has-[:checked]:bg-accent has-[:checked]:font-medium"
                key={format}
              >
                <input
                  checked={options.outputFormat === format}
                  className="sr-only"
                  name="quick-generate-output-format"
                  onChange={() => update({ outputFormat: format })}
                  type="radio"
                  value={format}
                />
                Return as {format === "number" ? "number" : "string"}
              </label>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Switch
              checked={options.padWithLeadingZeros}
              disabled={leadingZerosDisabled}
              id="pad-with-leading-zeros"
              onCheckedChange={(checked) =>
                update({ padWithLeadingZeros: checked })
              }
            />
            <div>
              <Label className="text-xs" htmlFor="pad-with-leading-zeros">
                Pad with leading zeros
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Formats string output to the width of the configured range (for
                example, 007).
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section
        className="px-4 py-3"
        aria-labelledby="generation-behavior-title"
      >
        <h3
          className="font-medium text-foreground text-xs"
          id="generation-behavior-title"
        >
          Generation behavior
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Options for generating multiple examples.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Switch
            checked={options.uniqueExamples}
            id="generate-unique-example-values"
            onCheckedChange={(checked) => update({ uniqueExamples: checked })}
          />
          <div>
            <Label className="text-xs" htmlFor="generate-unique-example-values">
              Generate unique example values
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Avoid repeated values when you generate more examples.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function GeneratorDetails({
  definition,
  description,
  exampleValues,
  onGenerateExamples,
  title,
}: {
  readonly definition: DefinitionProperties;
  readonly description: string;
  readonly exampleValues: readonly string[];
  readonly onGenerateExamples: () => void;
  readonly title: string;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const serializedDefinition = JSON.stringify(definition, null, 2);

  async function copyDefinition() {
    try {
      await navigator.clipboard.writeText(serializedDefinition);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <Card className="rounded-2xl border-border/80 bg-card/90 py-0 shadow-foreground/5 shadow-lg">
        <CardContent className="flex gap-4 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-primary">
            <Lightbulb aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-serif text-lg tracking-[-0.02em]">
              About this generator
            </h2>
            <p className="mt-1 text-muted-foreground text-xs leading-4">
              {description} Useful for IDs, counts, test data, and numeric
              fields.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 bg-card/90 py-0 shadow-foreground/5 shadow-lg">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-primary">
              <Database aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-serif text-lg tracking-[-0.02em]">
                  Example values
                </h2>
                <Button
                  className="h-8 rounded-lg px-3 text-[10px]"
                  onClick={onGenerateExamples}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw className="size-3" /> Generate more
                </Button>
              </div>
              <p className="mt-1 text-muted-foreground text-xs">
                Here are a few more examples using the same options.
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {exampleValues.map((value, index) => (
              <span
                className="grid h-12 place-items-center rounded-lg border border-border/60 bg-muted/55 font-serif text-base"
                key={`${index}-${value}`}
              >
                {value}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card
        className="rounded-2xl border-border/80 bg-card/90 py-0 shadow-foreground/5 shadow-lg"
        id="generator-definition"
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-primary">
              <Braces aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-lg tracking-[-0.02em]">
                Generator definition
              </h2>
              <p className="mt-1 text-muted-foreground text-xs">
                This is the schema for the selected {title.toLowerCase()}{" "}
                generator.
              </p>
            </div>
            <button
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[10px] hover:bg-secondary"
              onClick={copyDefinition}
              type="button"
            >
              <Copy aria-hidden="true" className="size-3" />
              {copyStatus === "copied" ? "Copied" : "Copy JSON"}
            </button>
          </div>
          {copyStatus === "error" ? (
            <p aria-live="polite" className="sr-only" role="status">
              Unable to copy generator definition.
            </p>
          ) : null}
          <pre className="mt-4 overflow-x-auto rounded-xl bg-muted/60 p-4 font-mono text-xs leading-5">
            {serializedDefinition}
          </pre>
        </CardContent>
      </Card>
    </div>
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

function createExampleValues(
  definition: DefinitionProperties,
  options: AdvancedOptions,
): readonly string[] {
  try {
    const random =
      options.seed === "" ? undefined : createSeededRandom(options.seed);
    const values: string[] = [];
    const seen = new Set<string>();
    const maxAttempts = options.uniqueExamples ? 120 : 6;

    for (
      let attempt = 0;
      attempt < maxAttempts && values.length < 6;
      attempt += 1
    ) {
      const value = formatGeneratedValue(
        generateAdvancedValue(definition, options, random),
        definition,
        options,
      );
      const formattedValue = String(value);
      if (options.uniqueExamples && seen.has(formattedValue)) continue;
      seen.add(formattedValue);
      values.push(formattedValue);
    }

    return values;
  } catch {
    return [];
  }
}

function generateAdvancedValue(
  definition: DefinitionProperties,
  options: AdvancedOptions,
  random?: RandomSource,
): unknown {
  const hasValueRules = isNumericGenerator(definition);
  const source =
    random ??
    (options.seed === "" ? undefined : createSeededRandom(options.seed));
  const executionOptions =
    source === undefined ? undefined : { random: source };

  if (!hasValueRules) {
    return generate(definition as GeneratorDefinition, executionOptions);
  }

  const excludedValues = parseExcludedValues(options.excludeValues);
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    const value = generate(definition as GeneratorDefinition, executionOptions);
    if (isAllowedNumericValue(value, definition, options, excludedValues)) {
      return value;
    }
  }

  throw new AdvancedOptionsError(
    "The advanced value rules leave no eligible values in this generator's range.",
  );
}

function isNumericGenerator(definition: DefinitionProperties): boolean {
  return definition.type === "integer" || definition.type === "decimal";
}

function isAllowedNumericValue(
  value: unknown,
  definition: DefinitionProperties,
  options: AdvancedOptions,
  excludedValues: readonly number[],
): value is number {
  if (typeof value !== "number") return false;
  if (!options.allowNegative && value < 0) return false;
  if (excludedValues.some((excluded) => Object.is(value, excluded))) {
    return false;
  }

  const stepBase = typeof definition.min === "number" ? definition.min : 0;
  const step = options.step;
  const stepsFromBase = (value - stepBase) / step;
  return Math.abs(stepsFromBase - Math.round(stepsFromBase)) < 1e-9;
}

function formatGeneratedValue(
  value: unknown,
  definition: DefinitionProperties,
  options: AdvancedOptions,
): unknown {
  if (typeof value !== "number" || options.outputFormat === "number") {
    return value;
  }
  if (!options.padWithLeadingZeros) return String(value);

  const [integerPart, decimalPart] = String(Math.abs(value)).split(".");
  const paddingWidth = numericRangeWidth(definition);
  const sign = value < 0 ? "-" : "";
  const paddedInteger = (integerPart ?? "0").padStart(paddingWidth, "0");
  return decimalPart === undefined
    ? `${sign}${paddedInteger}`
    : `${sign}${paddedInteger}.${decimalPart}`;
}

function numericRangeWidth(definition: DefinitionProperties): number {
  const lowerBound = typeof definition.min === "number" ? definition.min : 0;
  const upperBound = typeof definition.max === "number" ? definition.max : 0;
  return Math.max(
    1,
    String(Math.max(Math.abs(lowerBound), Math.abs(upperBound))).split(".")[0]
      ?.length ?? 1,
  );
}

function parseExcludedValues(value: string): readonly number[] {
  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));
}

function parsePositiveNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function hasEditableProperties(definition: DefinitionProperties): boolean {
  return Object.keys(definition).some((key) => key !== "type");
}

function toGenerationError(cause: unknown): ResultPreviewError {
  if (cause instanceof AdvancedOptionsError) {
    return {
      code: "NO_ELIGIBLE_VALUES",
      kind: "configuration",
      message: cause.message,
      path: ["advancedOptions"],
    };
  }
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
