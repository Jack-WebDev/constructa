import { Button } from "@constructa/ui/components/button";
import { Input } from "@constructa/ui/components/input";
import { Label } from "@constructa/ui/components/label";
import {
  BUILT_IN_GENERATOR_CATALOG,
  type ValidationPath,
} from "constructa-sdk";
import { type RefObject, useState } from "react";

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
import {
  addBuilderObjectField,
  type BuilderDocumentDraft,
  type BuilderFieldDraft,
  type BuilderFieldMoveDirection,
  type BuilderUiId,
  getBuilderDefinition,
  getBuilderObjectFields,
  moveBuilderField,
  removeBuilderField,
  renameBuilderField,
  selectBuilderDefinitionGenerator,
  selectBuilderFieldGenerator,
  updateBuilderDefinition,
} from "./state";
import { TemplateReferencePicker } from "./template-reference-picker";

type DefinitionEditorProps = {
  readonly draft: BuilderDocumentDraft;
  readonly onDraftChange: (draft: BuilderDocumentDraft) => void;
  readonly onFieldFocus: (fieldId: BuilderUiId) => void;
  readonly onEmptyFocus: () => void;
  readonly addFieldButtonRef: RefObject<HTMLButtonElement | null>;
  readonly registerFieldRef: (
    fieldId: BuilderUiId,
    element: HTMLLIElement | null,
  ) => void;
  readonly validationIssues: readonly BuilderValidationIssue[];
};

/**
 * The recursive definition-editing module. Its interface is deliberately
 * limited to a draft, its validation projection, and focus adapters; object,
 * array, and template edits all pass through this one seam.
 */
export function DefinitionEditor(props: DefinitionEditorProps) {
  return (
    <ObjectFields {...props} breadcrumbs={[]} objectPath={["definition"]} />
  );
}

type ObjectFieldsProps = DefinitionEditorProps & {
  readonly breadcrumbs: readonly string[];
  readonly objectPath: ValidationPath;
};

function ObjectFields({
  breadcrumbs,
  draft,
  objectPath,
  onDraftChange,
  addFieldButtonRef,
  onEmptyFocus,
  onFieldFocus,
  registerFieldRef,
  validationIssues,
}: ObjectFieldsProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const fields = getBuilderObjectFields(draft, objectPath);
  const isRoot = breadcrumbs.length === 0;
  const objectName = breadcrumbs.at(-1) ?? "generator";

  function addField() {
    const result = addBuilderObjectField(draft, objectPath);
    if (!result.success) return;
    onDraftChange(result.draft);
    onFieldFocus(result.field.id);
  }

  return (
    <section
      aria-label={
        isRoot
          ? "Generator fields"
          : `Nested object ${breadcrumbs.join(" / ")}, depth ${breadcrumbs.length}`
      }
      className={isRoot ? "" : "mt-3 border-l pl-4"}
      data-depth={isRoot ? undefined : breadcrumbs.length}
    >
      {isRoot ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-medium text-lg" id="builder-fields-title">
              Fields
            </h2>
            <p className="text-muted-foreground text-sm">
              Add fields to the generator object.
            </p>
          </div>
          <Button
            className="h-10 rounded-xl text-sm shadow-lg shadow-primary/15"
            onClick={addField}
            ref={addFieldButtonRef}
            type="button"
          >
            Add field
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="mr-auto">
            <nav
              aria-label="Field breadcrumb"
              className="text-muted-foreground text-xs"
            >
              Fields / {breadcrumbs.join(" / ")}
            </nav>
            <h3 className="font-medium text-sm">{objectName} fields</h3>
          </div>
          <Button
            onClick={() => setCollapsed((value) => !value)}
            size="sm"
            type="button"
            variant="outline"
          >
            {collapsed ? "Expand" : "Collapse"} {objectName}
          </Button>
          <Button onClick={addField} size="sm" type="button" variant="outline">
            Add field to {objectName}
          </Button>
        </div>
      )}
      {collapsed ? null : fields.length === 0 ? (
        <p
          className={
            isRoot
              ? "mt-4 rounded-xl border border-border/80 border-dashed bg-muted/30 p-4 text-muted-foreground text-sm"
              : "mt-2 text-muted-foreground text-sm"
          }
        >
          {isRoot
            ? "No fields yet. Add one to start defining generated data."
            : "No fields in this object."}
        </p>
      ) : (
        <ul className={isRoot ? "mt-4 space-y-3" : "mt-2 space-y-2"}>
          {fields.map((field, index) => (
            <FieldRow
              addFieldButtonRef={addFieldButtonRef}
              breadcrumbs={breadcrumbs}
              draft={draft}
              field={field}
              fieldIndex={index}
              fieldCount={fields.length}
              key={field.id}
              nextFieldId={fields[index + 1]?.id ?? fields[index - 1]?.id}
              onEmptyFocus={onEmptyFocus}
              onDraftChange={onDraftChange}
              onAnnouncement={setAnnouncement}
              onFieldFocus={onFieldFocus}
              registerFieldRef={registerFieldRef}
              validationIssues={validationIssues}
            />
          ))}
        </ul>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

type FieldRowProps = Pick<
  DefinitionEditorProps,
  | "addFieldButtonRef"
  | "draft"
  | "onDraftChange"
  | "onEmptyFocus"
  | "onFieldFocus"
  | "registerFieldRef"
  | "validationIssues"
> & {
  readonly breadcrumbs: readonly string[];
  readonly field: BuilderFieldDraft;
  readonly fieldCount: number;
  readonly fieldIndex: number;
  readonly nextFieldId: BuilderUiId | undefined;
  readonly onAnnouncement?: (message: string) => void;
};

function FieldRow({
  breadcrumbs,
  draft,
  field,
  fieldCount,
  fieldIndex,
  onDraftChange,
  onAnnouncement,
  addFieldButtonRef,
  onFieldFocus,
  onEmptyFocus,
  nextFieldId,
  registerFieldRef,
  validationIssues,
}: FieldRowProps) {
  const [name, setName] = useState(field.name);
  const [nameError, setNameError] = useState<string>();
  const [configurationOpen, setConfigurationOpen] = useState(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [pendingGeneratorType, setPendingGeneratorType] = useState<string>();
  const [removalPending, setRemovalPending] = useState(false);
  const [search, setSearch] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const typeId = getGeneratorType(field.definition);
  const catalogEntry =
    typeId === undefined
      ? undefined
      : BUILT_IN_GENERATOR_CATALOG.find((entry) => entry.typeId === typeId);
  const fieldIssues = getDefinitionValidationIssues(
    validationIssues,
    field.path,
  );

  function rename() {
    const result = renameBuilderField(draft, field.id, name);
    if (!result.success) {
      setNameError(result.error.message);
      return;
    }
    setName(result.field.name);
    setNameError(undefined);
    onDraftChange(result.draft);
    setAnnouncement(`Field renamed to ${result.field.name}.`);
  }

  function remove() {
    const result = removeBuilderField(draft, field.id);
    setRemovalPending(false);
    if (!result.success) return;
    onDraftChange(result.draft);
    if (nextFieldId === undefined) onEmptyFocus();
    else onFieldFocus(nextFieldId);
    onAnnouncement?.(`Field ${result.field.name} removed.`);
  }

  function move(direction: BuilderFieldMoveDirection) {
    const result = moveBuilderField(draft, field.id, direction);
    if (!result.success) return;
    onDraftChange(result.draft);
    onFieldFocus(result.field.id);
    setAnnouncement(`Field ${result.field.name} moved ${direction}.`);
  }

  function selectGenerator(nextTypeId: string) {
    if (nextTypeId !== typeId && hasGeneratorConfiguration(field.definition)) {
      setPendingGeneratorType(nextTypeId);
      return;
    }
    const result = selectBuilderFieldGenerator(draft, field.id, nextTypeId);
    if (!result.success) return;
    onDraftChange(result.draft);
    setGeneratorOpen(false);
    setAnnouncement(
      `Field ${field.name} now uses ${getCatalogName(nextTypeId)}.`,
    );
  }

  return (
    <li
      aria-label={`Field ${field.name}`}
      aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
      className="rounded-xl border border-border/80 bg-background/35 px-3 py-3 text-sm shadow-sm transition-colors hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
      id={`builder-field-${field.id}`}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target || !event.altKey) return;
        if (event.key === "ArrowUp" && fieldIndex > 0) {
          event.preventDefault();
          move("up");
        }
        if (event.key === "ArrowDown" && fieldIndex < fieldCount - 1) {
          event.preventDefault();
          move("down");
        }
      }}
      ref={(element) => registerFieldRef(field.id, element)}
      tabIndex={-1}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-describedby={
            nameError === undefined ? undefined : `field-name-error-${field.id}`
          }
          aria-invalid={nameError !== undefined}
          aria-label={`Field name: ${field.name}`}
          className="h-9 max-w-56 rounded-lg font-medium"
          onBlur={rename}
          onChange={(event) => setName(event.target.value)}
          type="text"
          value={name}
        />
        <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
          {catalogEntry?.displayName ?? "Unknown generator"}
        </span>
        <div className="flex w-full gap-1 sm:ml-auto sm:w-auto">
          <Button
            className="rounded-lg"
            onClick={() => setGeneratorOpen((value) => !value)}
            size="sm"
            type="button"
            variant="outline"
          >
            Change generator
          </Button>
          <Button
            className="rounded-lg"
            onClick={() => setConfigurationOpen((value) => !value)}
            size="sm"
            type="button"
            variant="outline"
          >
            Configure
          </Button>
          <Button
            aria-label={`Move ${field.name} up`}
            className="rounded-lg"
            disabled={fieldIndex === 0}
            onClick={() => move("up")}
            size="sm"
            type="button"
            variant="outline"
          >
            Move up
          </Button>
          <Button
            aria-label={`Move ${field.name} down`}
            className="rounded-lg"
            disabled={fieldIndex === fieldCount - 1}
            onClick={() => move("down")}
            size="sm"
            type="button"
            variant="outline"
          >
            Move down
          </Button>
          <Button
            className="rounded-lg"
            onClick={() => setRemovalPending(true)}
            size="sm"
            type="button"
            variant="destructive"
          >
            Remove
          </Button>
        </div>
      </div>
      {nameError === undefined ? null : (
        <p
          className="mt-2 text-destructive"
          id={`field-name-error-${field.id}`}
          role="alert"
        >
          {nameError}
        </p>
      )}
      {configurationOpen ? (
        <DefinitionConfiguration
          addFieldButtonRef={addFieldButtonRef}
          breadcrumbs={breadcrumbs}
          definition={asDefinitionProperties(field.definition)}
          draft={draft}
          fieldName={field.name}
          path={field.path}
          validationIssues={validationIssues}
          onDraftChange={onDraftChange}
          onEmptyFocus={onEmptyFocus}
          onClose={() => setConfigurationOpen(false)}
          onFieldFocus={onFieldFocus}
          registerFieldRef={registerFieldRef}
        />
      ) : (
        <BuilderInlineValidationIssues issues={fieldIssues} />
      )}
      {typeId === "object" && !configurationOpen ? (
        <ObjectFields
          addFieldButtonRef={addFieldButtonRef}
          breadcrumbs={[...breadcrumbs, field.name]}
          draft={draft}
          objectPath={field.path}
          onDraftChange={onDraftChange}
          onEmptyFocus={onEmptyFocus}
          onFieldFocus={onFieldFocus}
          registerFieldRef={registerFieldRef}
          validationIssues={validationIssues}
        />
      ) : null}
      {generatorOpen ? (
        <section
          aria-label={`Select generator for ${field.name}`}
          className="mt-3 border-t pt-3"
        >
          <Input
            aria-label={`Search generators for ${field.name}`}
            className="mt-2"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search generators"
            type="search"
            value={search}
          />
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {BUILT_IN_GENERATOR_CATALOG.filter(
              (entry) =>
                entry.displayName
                  .toLowerCase()
                  .includes(search.toLowerCase()) ||
                entry.typeId.includes(search.toLowerCase()),
            ).map((entry) => (
              <li key={entry.typeId}>
                <Button
                  className="h-auto w-full justify-start whitespace-normal px-2 py-2 text-left"
                  onClick={() => selectGenerator(entry.typeId)}
                  type="button"
                  variant="outline"
                >
                  <span>
                    <span className="block font-medium">
                      {entry.displayName}
                    </span>
                    <span className="block text-muted-foreground">
                      {entry.description}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {pendingGeneratorType === undefined ? null : (
        <div
          className="mt-3 flex items-center gap-2 border-t pt-3"
          role="alertdialog"
        >
          <div className="mr-auto">
            <p className="font-medium">Discard configuration?</p>
            <p className="text-muted-foreground">
              Changing generators removes this field&apos;s current
              configuration.
            </p>
          </div>
          <Button
            onClick={() => setPendingGeneratorType(undefined)}
            size="sm"
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              const result = selectBuilderFieldGenerator(
                draft,
                field.id,
                pendingGeneratorType,
              );
              if (result.success) {
                onDraftChange(result.draft);
                setGeneratorOpen(false);
                setAnnouncement(
                  `Field ${field.name} now uses ${getCatalogName(pendingGeneratorType)}.`,
                );
              }
              setPendingGeneratorType(undefined);
            }}
            size="sm"
            type="button"
          >
            Discard and change
          </Button>
        </div>
      )}
      {removalPending ? (
        <div
          aria-label={`Remove ${field.name}?`}
          className="mt-3 flex items-center gap-2 border-t pt-3"
          role="alertdialog"
        >
          <div className="mr-auto">
            <p>Remove {field.name}?</p>
            <p className="text-muted-foreground">
              This removes the field and its configuration.
            </p>
          </div>
          <Button
            onClick={() => setRemovalPending(false)}
            size="sm"
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            onClick={remove}
            size="sm"
            type="button"
            variant="destructive"
          >
            Remove field
          </Button>
        </div>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </li>
  );
}

type DefinitionConfigurationProps = Pick<
  DefinitionEditorProps,
  | "addFieldButtonRef"
  | "onDraftChange"
  | "onEmptyFocus"
  | "onFieldFocus"
  | "registerFieldRef"
> & {
  readonly breadcrumbs: readonly string[];
  readonly definition: DefinitionProperties;
  readonly draft: BuilderDocumentDraft;
  readonly fieldName: string;
  readonly onClose: () => void;
  readonly path: ValidationPath;
  readonly validationIssues: readonly BuilderValidationIssue[];
};

function DefinitionConfiguration({
  breadcrumbs,
  definition,
  draft,
  fieldName,
  onClose,
  onDraftChange,
  onFieldFocus,
  onEmptyFocus,
  addFieldButtonRef,
  path,
  registerFieldRef,
  validationIssues,
}: DefinitionConfigurationProps) {
  const typeId = getGeneratorType(definition);
  const registration =
    typeId === undefined ? undefined : getGeneratorEditor(typeId);
  const Editor = registration?.Editor;
  const templateParentPath =
    typeId === "template" ? getParentObjectDefinitionPath(path) : undefined;
  const definitionIssues = getDefinitionValidationIssues(
    validationIssues,
    path,
  );

  function update(properties: DefinitionProperties) {
    const result = updateBuilderDefinition(draft, path, properties);
    if (result.success) onDraftChange(result.draft);
  }

  return (
    <section
      aria-label={`Configure ${fieldName}`}
      className="mt-3 border-t pt-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Configure {fieldName}</h3>
        <Button onClick={onClose} size="sm" type="button" variant="ghost">
          Close
        </Button>
      </div>
      <div className="mt-3">
        {Editor === undefined ? (
          <p role="alert">The selected generator is not available.</p>
        ) : (
          <Editor
            definition={definition}
            issues={definitionIssues}
            onChange={update}
          />
        )}
        {typeId === "array" ? (
          <ArrayDefinitionEditor
            addFieldButtonRef={addFieldButtonRef}
            breadcrumbs={breadcrumbs}
            draft={draft}
            onDraftChange={onDraftChange}
            onEmptyFocus={onEmptyFocus}
            onFieldFocus={onFieldFocus}
            path={path}
            registerFieldRef={registerFieldRef}
            validationIssues={validationIssues}
          />
        ) : null}
        {typeId === "object" ? (
          <ObjectFields
            addFieldButtonRef={addFieldButtonRef}
            breadcrumbs={[...breadcrumbs, fieldName]}
            draft={draft}
            objectPath={path}
            onDraftChange={onDraftChange}
            onEmptyFocus={onEmptyFocus}
            onFieldFocus={onFieldFocus}
            registerFieldRef={registerFieldRef}
            validationIssues={validationIssues}
          />
        ) : null}
        {typeId === "template" && templateParentPath !== undefined ? (
          <TemplateReferencePicker
            fields={getBuilderObjectFields(draft, templateParentPath)}
            onInsert={(reference) =>
              update({
                ...definition,
                source: `${typeof definition.source === "string" ? definition.source : ""}{${reference}}`,
              })
            }
            templateFieldName={fieldName}
          />
        ) : null}
      </div>
    </section>
  );
}

type ArrayDefinitionEditorProps = Pick<
  DefinitionConfigurationProps,
  | "addFieldButtonRef"
  | "breadcrumbs"
  | "draft"
  | "onDraftChange"
  | "onEmptyFocus"
  | "onFieldFocus"
  | "registerFieldRef"
> & {
  readonly path: ValidationPath;
  readonly validationIssues: readonly BuilderValidationIssue[];
};

function ArrayDefinitionEditor({
  addFieldButtonRef,
  breadcrumbs,
  draft,
  onDraftChange,
  onEmptyFocus,
  onFieldFocus,
  path,
  registerFieldRef,
  validationIssues,
}: ArrayDefinitionEditorProps) {
  const itemPath = getArrayItemDefinitionPath(path);
  const item = getBuilderDefinition(draft, itemPath);
  const itemType = getGeneratorType(item);
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
      <DefinitionConfiguration
        addFieldButtonRef={addFieldButtonRef}
        breadcrumbs={breadcrumbs}
        definition={item}
        draft={draft}
        fieldName="array item"
        onClose={() => undefined}
        onDraftChange={onDraftChange}
        onEmptyFocus={onEmptyFocus}
        onFieldFocus={onFieldFocus}
        path={itemPath}
        registerFieldRef={registerFieldRef}
        validationIssues={validationIssues}
      />
    </section>
  );
}

function getGeneratorType(definition: unknown): string | undefined {
  return typeof definition === "object" &&
    definition !== null &&
    typeof (definition as { readonly type?: unknown }).type === "string"
    ? (definition as { readonly type: string }).type
    : undefined;
}

function asDefinitionProperties(value: unknown): DefinitionProperties {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DefinitionProperties)
    : {};
}

function hasGeneratorConfiguration(definition: unknown): boolean {
  return (
    typeof definition === "object" &&
    definition !== null &&
    Object.keys(definition).some((key) => key !== "type")
  );
}

function getCatalogName(typeId: string): string {
  return (
    BUILT_IN_GENERATOR_CATALOG.find((entry) => entry.typeId === typeId)
      ?.displayName ?? typeId
  );
}
