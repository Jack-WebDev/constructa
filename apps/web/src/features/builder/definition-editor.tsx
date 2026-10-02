import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@constructa/ui/components/alert-dialog";
import { Button } from "@constructa/ui/components/button";
import { Input } from "@constructa/ui/components/input";
import { Label } from "@constructa/ui/components/label";
import type { ValidationPath } from "constructa-sdk";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";

import type { DefinitionProperties } from "../editor/controls";
import { getGeneratorEditor } from "../editor/registry";
import {
  BuilderInlineValidationIssues,
  type BuilderValidationIssue,
  getDefinitionValidationIssues,
} from "./builder-validation";
import {
  getArrayItemDefinitionPath,
  getParentObjectDefinitionPath,
} from "./definition-path";
import { GeneratorPicker } from "./generator-picker";
import {
  addBuilderObjectField,
  type BuilderDocumentDraft,
  type BuilderFieldDraft,
  getBuilderDefinition,
  getBuilderObjectFields,
  moveBuilderField,
  removeBuilderField,
  renameBuilderField,
  selectBuilderDefinitionGenerator,
  updateBuilderDefinition,
} from "./state";
import { TemplateReferencePicker } from "./template-reference-picker";

export type DefinitionEditorProps = {
  readonly draft: BuilderDocumentDraft;
  readonly onDraftChange: (draft: BuilderDocumentDraft) => void;
  readonly onSelect: (path: ValidationPath | undefined) => void;
  readonly selectedPath: ValidationPath | undefined;
  readonly validationIssues: readonly BuilderValidationIssue[];
};

/**
 * Owns recursive definition composition while the tree and editor each retain
 * a single, distinct job: showing shape and configuring the selection.
 */
export function DefinitionEditor(props: DefinitionEditorProps) {
  const [query, setQuery] = useState("");

  return (
    <section aria-labelledby="builder-fields-title" className="min-h-0">
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="font-semibold text-base" id="builder-fields-title">
            Dataset structure
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Define the fields that make up your dataset.
          </p>
        </div>
        {getBuilderObjectFields(props.draft, ["definition"]).length > 0 ? (
          <AddFieldButton {...props} objectPath={["definition"]} />
        ) : null}
      </div>
      <div className="relative mx-4 mt-4">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Label className="sr-only" htmlFor="builder-field-search">
          Search fields
        </Label>
        <Input
          className="h-9 rounded-lg border-border/70 bg-muted/35 pl-9 text-xs"
          id="builder-field-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search fields..."
          type="search"
          value={query}
        />
      </div>
      <div className="px-3 py-3">
        <DefinitionTree {...props} objectPath={["definition"]} query={query} />
      </div>
    </section>
  );
}

function DefinitionTree(
  props: DefinitionEditorProps & {
    readonly objectPath: ValidationPath;
    readonly query: string;
  },
) {
  const allFields = getBuilderObjectFields(props.draft, props.objectPath);
  const normalizedQuery = props.query.trim().toLocaleLowerCase();
  const fields = allFields.filter((field) => {
    return (
      normalizedQuery === "" ||
      field.name.toLocaleLowerCase().includes(normalizedQuery) ||
      definitionSummary(field.definition, 0)
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    );
  });
  if (fields.length === 0) {
    if (allFields.length > 0) {
      return (
        <p className="px-3 py-6 text-center text-muted-foreground text-xs">
          No matching fields.
        </p>
      );
    }
    return props.objectPath.length === 1 ? (
      <EmptyStructure {...props} />
    ) : (
      <div className="px-3 py-3 text-muted-foreground text-sm">
        No fields in this object yet.
        <div className="mt-2">
          <AddFieldButton {...props} />
        </div>
      </div>
    );
  }

  return (
    <ul aria-label="Data structure" className="space-y-0.5">
      {fields.map((field, index) => (
        <DefinitionTreeItem
          {...props}
          field={field}
          fieldCount={fields.length}
          fieldIndex={index}
          key={field.id}
        />
      ))}
    </ul>
  );
}

function DefinitionTreeItem(
  props: DefinitionEditorProps & {
    readonly field: BuilderFieldDraft;
    readonly fieldCount: number;
    readonly fieldIndex: number;
    readonly query: string;
  },
) {
  const { draft, field, fieldCount, fieldIndex, onDraftChange, onSelect } =
    props;
  const [expanded, setExpanded] = useState(true);
  const type = getDefinitionType(field.definition);
  const childCount =
    type === "object" ? getBuilderObjectFields(draft, field.path).length : 0;
  const isSelected = pathsEqual(field.path, props.selectedPath);
  const issues = getDefinitionValidationIssues(
    props.validationIssues,
    field.path,
  );
  const canExpand = type === "object" || type === "array";

  function move(direction: "up" | "down") {
    const result = moveBuilderField(draft, field.id, direction);
    if (result.success) onDraftChange(result.draft);
  }

  return (
    <li id={`builder-field-${field.id}`}>
      <div
        className={`group flex min-h-12 items-center gap-1 rounded-lg border-l-2 px-2 ${
          isSelected
            ? "border-primary bg-primary/8"
            : "border-transparent hover:bg-muted/55"
        }`}
      >
        <GripVertical
          aria-hidden="true"
          className="size-3 shrink-0 text-muted-foreground/70"
        />
        {canExpand ? (
          <Button
            aria-label={`${expanded ? "Collapse" : "Expand"} ${field.name}`}
            className="size-6 p-0"
            onClick={() => setExpanded((value) => !value)}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            {expanded ? <ChevronDown /> : <ChevronRight />}
          </Button>
        ) : (
          <span className="size-6" />
        )}
        <button
          aria-current={isSelected ? "true" : undefined}
          className="min-w-0 flex-1 py-1.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onClick={() => onSelect(field.path)}
          type="button"
        >
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-sm">{field.name}</span>
            {issues.length > 0 ? (
              <TriangleAlert
                aria-label="Has validation issue"
                className="size-3.5 text-destructive"
              />
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-muted-foreground text-xs">
            {definitionSummary(field.definition, childCount)}
          </span>
        </button>
        {isSelected ? (
          <span className="flex items-center gap-0.5">
            <Button
              aria-label={`Move ${field.name} up`}
              disabled={fieldIndex === 0}
              onClick={() => move("up")}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              ↑
            </Button>
            <Button
              aria-label={`Move ${field.name} down`}
              disabled={fieldIndex === fieldCount - 1}
              onClick={() => move("down")}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              ↓
            </Button>
          </span>
        ) : null}
      </div>
      {canExpand && expanded ? (
        <div className="ml-6 border-border/70 border-l pl-1">
          {type === "object" ? (
            <DefinitionTree {...props} objectPath={field.path} />
          ) : (
            <ArrayTreeItem {...props} path={field.path} />
          )}
        </div>
      ) : null}
    </li>
  );
}

function ArrayTreeItem(
  props: Pick<DefinitionEditorProps, "draft" | "onSelect" | "selectedPath"> & {
    readonly path: ValidationPath;
  },
) {
  const itemPath = getArrayItemDefinitionPath(props.path);
  const item = getBuilderDefinition(props.draft, itemPath);
  if (item === undefined) return null;
  return (
    <button
      aria-current={
        pathsEqual(itemPath, props.selectedPath) ? "true" : undefined
      }
      className="w-full px-3 py-2 text-left text-muted-foreground text-xs hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring"
      onClick={() => props.onSelect(itemPath)}
      type="button"
    >
      Each item · {definitionSummary(item, 0)}
    </button>
  );
}

function AddFieldButton(
  props: Pick<DefinitionEditorProps, "draft" | "onDraftChange" | "onSelect"> & {
    readonly objectPath: ValidationPath;
  },
) {
  function addField() {
    const result = addBuilderObjectField(props.draft, props.objectPath);
    if (result.success) {
      props.onDraftChange(result.draft);
      props.onSelect(result.field.path);
    }
  }
  return (
    <Button className="shrink-0" onClick={addField} size="sm" type="button">
      <Plus /> Add field
    </Button>
  );
}

function EmptyStructure(
  props: Pick<DefinitionEditorProps, "draft" | "onDraftChange" | "onSelect">,
) {
  return (
    <div className="px-3 py-10 text-center">
      <p className="font-medium text-sm">Build your data</p>
      <p className="mx-auto mt-2 max-w-56 text-muted-foreground text-xs">
        Start with a field, choose what it should contain, then see the result
        in the preview.
      </p>
      <div className="mt-4">
        <AddFieldButton {...props} objectPath={["definition"]} />
      </div>
    </div>
  );
}

/** Contextual editor for the selected field or array item. */
export function FieldConfiguration(props: DefinitionEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const definition =
    props.selectedPath === undefined
      ? undefined
      : getBuilderDefinition(props.draft, props.selectedPath);
  const selectedField =
    props.selectedPath === undefined
      ? undefined
      : findField(props.draft, props.selectedPath);
  if (definition === undefined || props.selectedPath === undefined) {
    return (
      <section
        aria-labelledby="field-configuration-title"
        className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6"
      >
        <ConfigurationHeader />
        <EmptyConfiguration />
      </section>
    );
  }

  const type = getDefinitionType(definition);
  const Editor =
    type === undefined ? undefined : getGeneratorEditor(type)?.Editor;
  const issues = getDefinitionValidationIssues(
    props.validationIssues,
    props.selectedPath,
  );

  function update(properties: DefinitionProperties) {
    const result = updateBuilderDefinition(
      props.draft,
      props.selectedPath as ValidationPath,
      properties,
    );
    if (result.success) props.onDraftChange(result.draft);
  }

  function chooseGenerator(typeId: string) {
    const result = selectBuilderDefinitionGenerator(
      props.draft,
      props.selectedPath as ValidationPath,
      typeId,
    );
    if (result.success) {
      props.onDraftChange(result.draft);
      setPickerOpen(false);
    }
  }

  function rename(name: string) {
    if (selectedField === undefined) return;
    const result = renameBuilderField(props.draft, selectedField.id, name);
    if (result.success) props.onDraftChange(result.draft);
  }

  return (
    <section
      aria-labelledby="field-configuration-title"
      className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6"
    >
      <ConfigurationHeader definition={definition} />
      <p className="sr-only">{pathLabels(props.selectedPath).join(" / ")}</p>
      {selectedField === undefined ? null : (
        <div className="mt-5 grid gap-1.5">
          <Label htmlFor="field-name">Field name</Label>
          <Input
            defaultValue={selectedField.name}
            id="field-name"
            key={selectedField.id}
            onBlur={(event) => rename(event.target.value)}
          />
        </div>
      )}
      <section className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-sm">Generator</h3>
            <p className="mt-1 text-muted-foreground text-xs">
              {definitionSummary(definition, 0)}
            </p>
          </div>
          <Button
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((value) => !value)}
            size="sm"
            type="button"
            variant="outline"
          >
            {pickerOpen ? "Close picker" : "Change generator"}
          </Button>
        </div>
        {pickerOpen ? (
          <GeneratorPicker onSelect={chooseGenerator} selectedType={type} />
        ) : null}
      </section>
      <section className="mt-5 border-border/70 border-t pt-5">
        <h3 className="font-semibold text-sm">Generator options</h3>
        {Editor === undefined ? (
          <p className="mt-3 text-destructive text-sm">
            This generator is unavailable.
          </p>
        ) : (
          <div className="mt-4">
            <Editor definition={definition} issues={issues} onChange={update} />
          </div>
        )}
        {type === "object" ? (
          <ObjectSettings {...props} path={props.selectedPath} />
        ) : null}
        {type === "array" ? (
          <ArraySettings {...props} path={props.selectedPath} />
        ) : null}
        {type === "template" ? (
          <TemplateSettings
            definition={definition}
            draft={props.draft}
            onChange={update}
            path={props.selectedPath}
          />
        ) : null}
        <BuilderInlineValidationIssues issues={issues} />
      </section>
      {selectedField === undefined ? null : (
        <FieldActions
          draft={props.draft}
          field={selectedField}
          onDraftChange={props.onDraftChange}
          onSelect={props.onSelect}
        />
      )}
    </section>
  );
}

function FieldActions({
  draft,
  field,
  onDraftChange,
  onSelect,
}: {
  readonly draft: BuilderDocumentDraft;
  readonly field: BuilderFieldDraft;
  readonly onDraftChange: (draft: BuilderDocumentDraft) => void;
  readonly onSelect: (path: ValidationPath | undefined) => void;
}) {
  function removeField() {
    const result = removeBuilderField(draft, field.id);
    if (!result.success) return;
    onDraftChange(result.draft);
    onSelect(undefined);
  }

  return (
    <details className="mt-8 border-border/70 border-t pt-4">
      <summary className="cursor-pointer font-medium text-muted-foreground text-sm marker:text-muted-foreground">
        Field actions
      </summary>
      <div className="mt-3">
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button size="sm" type="button" variant="destructive" />}
          >
            Remove field
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove “{field.name}”?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the field and any nested configuration inside it.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep field</AlertDialogCancel>
              <AlertDialogAction
                onClick={removeField}
                type="button"
                variant="destructive"
              >
                Remove field
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </details>
  );
}

function EmptyConfiguration() {
  return (
    <section className="grid min-h-80 place-items-center px-6 text-center">
      <div>
        <p className="font-medium text-sm">Choose a field to configure</p>
        <p className="mt-2 max-w-64 text-muted-foreground text-sm">
          Select a field from the structure to choose a generator and refine its
          settings.
        </p>
      </div>
    </section>
  );
}

function ConfigurationHeader({
  definition,
}: {
  readonly definition?: DefinitionProperties;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-base" id="field-configuration-title">
          Field configuration
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Configure how this field generates data.
        </p>
      </div>
      {definition === undefined ? null : (
        <span className="rounded-lg bg-primary/10 px-2.5 py-1 font-medium text-[10px] text-primary">
          {definitionSummary(definition, 0)}
        </span>
      )}
    </div>
  );
}

function ObjectSettings(
  props: Pick<DefinitionEditorProps, "draft" | "onDraftChange" | "onSelect"> & {
    readonly path: ValidationPath;
  },
) {
  return (
    <div className="mt-5 border-border/70 border-t pt-4">
      <p className="text-muted-foreground text-sm">
        This object contains named fields. Add fields from the structure panel.
      </p>
      <div className="mt-3">
        <AddFieldButton {...props} objectPath={props.path} />
      </div>
    </div>
  );
}

function ArraySettings(
  props: DefinitionEditorProps & { readonly path: ValidationPath },
) {
  const itemPath = getArrayItemDefinitionPath(props.path);
  const item = getBuilderDefinition(props.draft, itemPath);
  if (item === undefined)
    return (
      <p className="mt-4 text-destructive text-sm">
        The array item is unavailable.
      </p>
    );
  return (
    <div className="mt-5 border-border/70 border-t pt-4">
      <h4 className="font-medium text-sm">Each item is</h4>
      <p className="mt-1 text-muted-foreground text-xs">
        This sets what every value in this array contains.
      </p>
      <GeneratorPicker
        onSelect={(typeId) => {
          const result = selectBuilderDefinitionGenerator(
            props.draft,
            itemPath,
            typeId,
          );
          if (result.success) props.onDraftChange(result.draft);
        }}
        selectedType={getDefinitionType(item)}
      />
      <Button
        className="mt-4"
        onClick={() => props.onSelect(itemPath)}
        size="sm"
        type="button"
        variant="outline"
      >
        Configure item
      </Button>
      <BuilderInlineValidationIssues
        issues={getDefinitionValidationIssues(props.validationIssues, itemPath)}
      />
    </div>
  );
}

function TemplateSettings({
  definition,
  draft,
  onChange,
  path,
}: {
  readonly definition: DefinitionProperties;
  readonly draft: BuilderDocumentDraft;
  readonly onChange: (properties: DefinitionProperties) => void;
  readonly path: ValidationPath;
}) {
  const parentPath = getParentObjectDefinitionPath(path);
  if (parentPath === undefined) return null;
  return (
    <TemplateReferencePicker
      fields={getBuilderObjectFields(draft, parentPath)}
      onInsert={(reference) =>
        onChange({
          ...definition,
          source: `${typeof definition.source === "string" ? definition.source : ""}{${reference}}`,
        })
      }
      templateFieldName="field"
    />
  );
}

function findField(
  draft: BuilderDocumentDraft,
  path: ValidationPath,
): BuilderFieldDraft | undefined {
  const parent = getParentObjectDefinitionPath(path);
  return parent === undefined
    ? undefined
    : getBuilderObjectFields(draft, parent).find((field) =>
        pathsEqual(field.path, path),
      );
}

function getDefinitionType(definition: unknown): string | undefined {
  return typeof definition === "object" &&
    definition !== null &&
    typeof (definition as { readonly type?: unknown }).type === "string"
    ? (definition as { readonly type: string }).type
    : undefined;
}

function definitionSummary(definition: unknown, fieldCount: number): string {
  const type = getDefinitionType(definition);
  if (type === "object")
    return `Object · ${fieldCount} ${fieldCount === 1 ? "field" : "fields"}`;
  if (type === "array") return "Array";
  if (type === "integer") {
    const record = definition as Record<string, unknown>;
    if (typeof record.min === "number" && typeof record.max === "number")
      return `Integer · ${record.min}–${record.max}`;
  }
  return type === undefined
    ? "Unknown"
    : type.charAt(0).toUpperCase() + type.slice(1);
}

function pathsEqual(
  left: readonly (string | number)[],
  right: readonly (string | number)[] | undefined,
): boolean {
  return (
    right !== undefined &&
    left.length === right.length &&
    left.every((part, index) => part === right[index])
  );
}

function pathLabels(path: ValidationPath): readonly string[] {
  const labels: string[] = ["Dataset"];
  for (let index = 2; index < path.length; index += 2) {
    const name = path[index];
    if (typeof name === "string") labels.push(name);
  }
  if (path.at(-1) === "items") labels.push("item");
  return labels;
}
