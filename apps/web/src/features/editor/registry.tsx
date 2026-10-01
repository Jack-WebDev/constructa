import { Label } from "@constructa/ui/components/label";
import {
  BUILT_IN_GENERATOR_CATALOG,
  type ValidationPath,
} from "constructa-sdk";
import type { ComponentType, ReactNode } from "react";

import type { BuilderValidationIssue } from "../builder/builder-validation";
import {
  type BuilderDocumentDraft,
  getBuilderDefinition,
  getBuilderObjectFields,
  selectBuilderDefinitionGenerator,
} from "../builder/state";
import { TemplateReferencePicker } from "../builder/template-reference-picker";
import {
  getFieldIssue,
  type WebFieldIssue,
} from "../errors/error-presentation";
import {
  DateControl,
  type DefinitionProperties,
  ListControl,
  NumberControl,
  SelectControl,
  TextControl,
} from "./controls";

export type EditorProps = {
  /** The current flat generator definition, including its `type`. */
  readonly definition: DefinitionProperties;
  readonly disabled?: boolean;
  readonly issues?: readonly EditorValidationIssue[];
  /** Receives flat generator properties; no UI-specific configuration envelope. */
  readonly onChange: (properties: DefinitionProperties) => void;
};

export type EditorValidationIssue = WebFieldIssue;

/**
 * Context for a composite generator editor. The registry owns which type uses
 * nested definitions, object fields, or template references. The builder
 * supplies the recursive renderers and remains the sole owner of draft state.
 */
export type CompositeEditorProps = {
  readonly breadcrumbs: readonly string[];
  readonly definition: DefinitionProperties;
  readonly draft: BuilderDocumentDraft;
  readonly fieldName: string;
  readonly onDefinitionChange: (definition: DefinitionProperties) => void;
  readonly onDraftChange: (draft: BuilderDocumentDraft) => void;
  readonly path: ValidationPath;
  readonly renderDefinitionConfiguration: (
    definition: DefinitionProperties,
    fieldName: string,
    path: ValidationPath,
    validationIssues: readonly BuilderValidationIssue[],
  ) => ReactNode;
  readonly renderObjectFields: (
    breadcrumbs: readonly string[],
    objectPath: ValidationPath,
  ) => ReactNode;
  readonly validationIssues: readonly BuilderValidationIssue[];
};

export type GeneratorEditorRegistration = {
  readonly typeId: string;
  readonly Editor: ComponentType<EditorProps>;
  /** Renders the type-specific child-definition presentation, when needed. */
  readonly CompositeEditor?: ComponentType<CompositeEditorProps>;
};

const charsetOptions = [
  { value: "alphabetic", label: "Alphabetic" },
  { value: "numeric", label: "Numeric" },
  { value: "alphanumeric", label: "Alphanumeric" },
  { value: "hex", label: "Hexadecimal" },
] as const;

/**
 * Web-owned presentation mapping for the semantic built-in catalog. Generator
 * validation remains in the shared SDK parser and execution engine.
 */
export const WEB_EDITOR_REGISTRY: readonly GeneratorEditorRegistration[] =
  Object.freeze([
    {
      typeId: "array",
      Editor: ArrayEditor,
      CompositeEditor: ArrayCompositeEditor,
    },
    { typeId: "boolean", Editor: EmptyEditor },
    { typeId: "choice", Editor: ChoiceEditor },
    { typeId: "date", Editor: DateEditor },
    { typeId: "decimal", Editor: DecimalEditor },
    { typeId: "integer", Editor: IntegerEditor },
    {
      typeId: "object",
      Editor: EmptyEditor,
      CompositeEditor: ObjectCompositeEditor,
    },
    { typeId: "string", Editor: StringEditor },
    {
      typeId: "template",
      Editor: TemplateEditor,
      CompositeEditor: TemplateCompositeEditor,
    },
    { typeId: "uuid", Editor: EmptyEditor },
  ] satisfies readonly GeneratorEditorRegistration[]);

const editorsByType = new Map(
  WEB_EDITOR_REGISTRY.map((registration) => [
    registration.typeId,
    registration,
  ]),
);

/** Returns the web editor registered for a semantic generator type. */
export function getGeneratorEditor(
  typeId: string,
): GeneratorEditorRegistration | undefined {
  return editorsByType.get(typeId);
}

/** Ensures every built-in semantic catalog entry has a web presentation mapping. */
export function getBuiltInEditorRegistry(): readonly GeneratorEditorRegistration[] {
  return BUILT_IN_GENERATOR_CATALOG.map((entry) => {
    const registration = getGeneratorEditor(entry.typeId);
    if (registration === undefined) {
      throw new Error(`No web editor is registered for ${entry.typeId}.`);
    }
    return registration;
  });
}

function IntegerEditor({
  definition,
  disabled,
  issues,
  onChange,
}: EditorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberControl
        {...controlProps(
          definition,
          disabled,
          issues,
          onChange,
          "min",
          "Minimum",
        )}
      />
      <NumberControl
        {...controlProps(
          definition,
          disabled,
          issues,
          onChange,
          "max",
          "Maximum",
        )}
      />
    </div>
  );
}

function DecimalEditor({
  definition,
  disabled,
  issues,
  onChange,
}: EditorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <NumberControl
        {...controlProps(
          definition,
          disabled,
          issues,
          onChange,
          "min",
          "Minimum",
        )}
      />
      <NumberControl
        {...controlProps(
          definition,
          disabled,
          issues,
          onChange,
          "max",
          "Maximum",
        )}
      />
      <NumberControl
        {...controlProps(
          definition,
          disabled,
          issues,
          onChange,
          "precision",
          "Precision",
        )}
      />
    </div>
  );
}

function StringEditor({ definition, disabled, issues, onChange }: EditorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberControl
        {...controlProps(
          definition,
          disabled,
          issues,
          onChange,
          "length",
          "Length",
        )}
      />
      <SelectControl
        {...controlProps(
          definition,
          disabled,
          issues,
          onChange,
          "charset",
          "Character set",
        )}
        options={charsetOptions}
      />
    </div>
  );
}

function DateEditor({ definition, disabled, issues, onChange }: EditorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <DateControl
        {...controlProps(
          definition,
          disabled,
          issues,
          onChange,
          "min",
          "Minimum date",
        )}
      />
      <DateControl
        {...controlProps(
          definition,
          disabled,
          issues,
          onChange,
          "max",
          "Maximum date",
        )}
      />
    </div>
  );
}

function ChoiceEditor({ definition, disabled, issues, onChange }: EditorProps) {
  return (
    <ListControl
      {...controlProps(
        definition,
        disabled,
        issues,
        onChange,
        "values",
        "Choices",
      )}
    />
  );
}

function TemplateEditor({
  definition,
  disabled,
  issues,
  onChange,
}: EditorProps) {
  return (
    <TextControl
      {...controlProps(
        definition,
        disabled,
        issues,
        onChange,
        "source",
        "Template",
      )}
    />
  );
}

function ArrayEditor({ definition, disabled, issues, onChange }: EditorProps) {
  return (
    <NumberControl
      {...controlProps(
        definition,
        disabled,
        issues,
        onChange,
        "length",
        "Length",
      )}
    />
  );
}

function ArrayCompositeEditor({
  draft,
  onDraftChange,
  path,
  renderDefinitionConfiguration,
  validationIssues,
}: CompositeEditorProps) {
  const itemPath = [...path, "item"];
  const item = getBuilderDefinition(draft, itemPath);
  const itemType = getDefinitionType(item);
  const itemIssues = validationIssues.flatMap((issue) =>
    issue.path[0] === "item" ? [{ ...issue, path: issue.path.slice(1) }] : [],
  );
  if (item === undefined)
    return (
      <p className="mt-3" role="alert">
        The array item generator is not available.
      </p>
    );

  function selectItemGenerator(typeId: string) {
    const result = selectBuilderDefinitionGenerator(draft, itemPath, typeId);
    if (result.success) onDraftChange(result.draft);
  }

  return (
    <section aria-labelledby="array-item-title" className="mt-4 border-t pt-4">
      <h4 className="font-medium" id="array-item-title">
        Array item
      </h4>
      <p className="mt-1 text-muted-foreground text-sm">
        This configures each value in one generated array, not a bulk generation
        request.
      </p>
      <div className="mt-3 grid gap-1.5">
        <Label htmlFor="array-item-generator">Array item generator</Label>
        <select
          className="h-11 w-full rounded border border-input bg-transparent px-3 text-sm"
          id="array-item-generator"
          onChange={(event) => selectItemGenerator(event.target.value)}
          value={itemType ?? ""}
        >
          {BUILT_IN_GENERATOR_CATALOG.map((entry) => (
            <option key={entry.typeId} value={entry.typeId}>
              {entry.displayName}
            </option>
          ))}
        </select>
      </div>
      {renderDefinitionConfiguration(item, "array item", itemPath, itemIssues)}
    </section>
  );
}

function ObjectCompositeEditor({
  breadcrumbs,
  fieldName,
  path,
  renderObjectFields,
}: CompositeEditorProps) {
  return renderObjectFields([...breadcrumbs, fieldName], path);
}

function TemplateCompositeEditor({
  definition,
  draft,
  fieldName,
  onDefinitionChange,
  path,
}: CompositeEditorProps) {
  const parentPath = path.at(-1) === "item" ? undefined : path.slice(0, -2);
  if (parentPath === undefined) return null;

  return (
    <TemplateReferencePicker
      fields={getBuilderObjectFields(draft, parentPath)}
      onInsert={(reference) =>
        onDefinitionChange({
          ...definition,
          source: `${typeof definition.source === "string" ? definition.source : ""}{${reference}}`,
        })
      }
      templateFieldName={fieldName}
    />
  );
}

function EmptyEditor() {
  return null;
}

function controlProps(
  definition: DefinitionProperties,
  disabled: boolean | undefined,
  issues: readonly EditorValidationIssue[] | undefined,
  onChange: (properties: DefinitionProperties) => void,
  name: string,
  label: string,
) {
  return {
    disabled,
    error: getFieldIssue(issues, name)?.message,
    label,
    name,
    onChange: (value: unknown) => onChange({ ...definition, [name]: value }),
    value: definition[name],
  };
}

function getDefinitionType(
  definition: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  return typeof definition?.type === "string" ? definition.type : undefined;
}
