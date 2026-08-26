import { BUILT_IN_GENERATOR_CATALOG } from "constructa-sdk";
import type { ComponentType } from "react";

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

export type EditorValidationIssue = {
  readonly message: string;
  readonly path: readonly (string | number)[];
};

export type GeneratorEditorRegistration = {
  readonly typeId: string;
  readonly Editor: ComponentType<EditorProps>;
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
    { typeId: "array", Editor: ArrayEditor },
    { typeId: "boolean", Editor: EmptyEditor },
    { typeId: "choice", Editor: ChoiceEditor },
    { typeId: "date", Editor: DateEditor },
    { typeId: "decimal", Editor: DecimalEditor },
    { typeId: "integer", Editor: IntegerEditor },
    { typeId: "object", Editor: EmptyEditor },
    { typeId: "string", Editor: StringEditor },
    { typeId: "template", Editor: TemplateEditor },
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
    error: issues?.find((issue) => issue.path[0] === name)?.message,
    label,
    name,
    onChange: (value: unknown) => onChange({ ...definition, [name]: value }),
    value: definition[name],
  };
}
