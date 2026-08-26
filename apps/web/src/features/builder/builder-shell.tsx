import { Button } from "@constructa/ui/components/button";
import { Input } from "@constructa/ui/components/input";
import { generate } from "constructa-sdk";
import { useEffect, useRef, useState } from "react";

import { getCatalogEntry, searchGeneratorCatalog } from "../catalog/catalog";
import type { DefinitionProperties } from "../editor/controls";
import {
  type EditorValidationIssue,
  getGeneratorEditor,
} from "../editor/registry";
import { ArrayFieldEditor } from "./array-field-editor";
import { BuilderIdentityEditor } from "./identity-editor";
import { NestedObjectEditor } from "./nested-object-editor";
import {
  addBuilderField,
  type BuilderFieldMoveDirection,
  createBuilderDraft,
  getBuilderFields,
  getBuilderObjectFields,
  moveBuilderField,
  removeBuilderField,
  renameBuilderField,
  selectBuilderFieldGenerator,
  toGeneratorDocument,
  updateBuilderFieldDefinition,
} from "./state";
import { TemplateReferencePicker } from "./template-reference-picker";

const INITIAL_DOCUMENT = {
  schemaVersion: 1,
  definition: { type: "object", fields: {} },
};

export function BuilderShell() {
  const [draft, setDraft] = useState(() =>
    createBuilderDraft(INITIAL_DOCUMENT),
  );
  const [focusTarget, setFocusTarget] = useState<
    { readonly type: "field"; readonly id: string } | { readonly type: "add" }
  >();
  const [fieldToRemove, setFieldToRemove] = useState<string>();
  const [fieldToChange, setFieldToChange] = useState<string>();
  const [fieldToConfigure, setFieldToConfigure] = useState<string>();
  const [generatorSearches, setGeneratorSearches] = useState<
    Record<string, string>
  >({});
  const [pendingGeneratorSelection, setPendingGeneratorSelection] = useState<
    { readonly fieldId: string; readonly typeId: string } | undefined
  >();
  const [fieldNames, setFieldNames] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [configurationIssues, setConfigurationIssues] = useState<
    Record<string, readonly EditorValidationIssue[]>
  >({});
  const [announcement, setAnnouncement] = useState("");
  const fieldRefs = useRef(new Map<string, HTMLLIElement>());
  const addFieldButtonRef = useRef<HTMLButtonElement>(null);
  const fields = getBuilderFields(draft);

  useEffect(() => {
    if (focusTarget === undefined) return;
    if (focusTarget.type === "field") {
      fieldRefs.current.get(focusTarget.id)?.focus();
    } else {
      addFieldButtonRef.current?.focus();
    }
    setFocusTarget(undefined);
  }, [focusTarget]);

  function addField() {
    const result = addBuilderField(draft);
    if (!result.success) return;
    setDraft(result.draft);
    setFocusTarget({ type: "field", id: result.field.id });
    setAnnouncement(`Field ${result.field.name} added.`);
  }

  function renameField(fieldId: string, name: string) {
    const result = renameBuilderField(draft, fieldId, name);
    if (!result.success) {
      setFieldErrors((errors) => ({
        ...errors,
        [fieldId]: result.error.message,
      }));
      return;
    }
    setDraft(result.draft);
    setFieldNames((names) => {
      const { [fieldId]: _name, ...remainingNames } = names;
      return remainingNames;
    });
    setFieldErrors((errors) => {
      const { [fieldId]: _error, ...remainingErrors } = errors;
      return remainingErrors;
    });
    setAnnouncement(`Field renamed to ${result.field.name}.`);
  }

  function removeField(fieldId: string) {
    const index = fields.findIndex((field) => field.id === fieldId);
    const result = removeBuilderField(draft, fieldId);
    setFieldToRemove(undefined);
    if (!result.success) return;

    const nextField = fields[index + 1] ?? fields[index - 1];
    setDraft(result.draft);
    setFocusTarget(
      nextField === undefined
        ? { type: "add" }
        : { type: "field", id: nextField.id },
    );
    setAnnouncement(`Field ${result.field.name} removed.`);
  }

  function moveField(fieldId: string, direction: BuilderFieldMoveDirection) {
    const result = moveBuilderField(draft, fieldId, direction);
    if (!result.success) return;

    setDraft(result.draft);
    setFocusTarget({ type: "field", id: result.field.id });
    setAnnouncement(`Field ${result.field.name} moved ${direction}.`);
  }

  function selectFieldGenerator(fieldId: string, typeId: string) {
    const result = selectBuilderFieldGenerator(draft, fieldId, typeId);
    setPendingGeneratorSelection(undefined);
    if (!result.success) return;

    setDraft(result.draft);
    setFieldToChange(undefined);
    setFocusTarget({ type: "field", id: result.field.id });
    const entry = getCatalogEntry(typeId);
    setAnnouncement(
      `Field ${result.field.name} now uses ${entry?.displayName ?? typeId}.`,
    );
  }

  function requestGeneratorSelection(fieldId: string, typeId: string) {
    const field = fields.find((candidate) => candidate.id === fieldId);
    if (field === undefined) return;
    if (
      getGeneratorType(field.definition) !== typeId &&
      hasGeneratorConfiguration(field.definition)
    ) {
      setPendingGeneratorSelection({ fieldId, typeId });
      return;
    }
    selectFieldGenerator(fieldId, typeId);
  }

  function configureField(fieldId: string, properties: DefinitionProperties) {
    const result = updateBuilderFieldDefinition(draft, fieldId, properties);
    if (!result.success) return;

    setDraft(result.draft);
    setConfigurationIssues((issues) => ({
      ...issues,
      [fieldId]: getConfigurationIssues(result.draft, result.field),
    }));
  }

  function openConfiguration(fieldId: string) {
    const field = fields.find((candidate) => candidate.id === fieldId);
    if (field === undefined) return;
    setFieldToConfigure(fieldId);
    setConfigurationIssues((issues) => ({
      ...issues,
      [fieldId]: getConfigurationIssues(draft, field),
    }));
  }

  function registerFieldRef(fieldId: string, element: HTMLLIElement | null) {
    if (element === null) fieldRefs.current.delete(fieldId);
    else fieldRefs.current.set(fieldId, element);
  }

  function insertTemplateReference(fieldId: string, reference: string) {
    const field = fields.find((candidate) => candidate.id === fieldId);
    if (field === undefined) return;
    const definition = asDefinitionProperties(field.definition);
    const source =
      typeof definition.source === "string" ? definition.source : "";
    configureField(fieldId, {
      ...definition,
      source: `${source}{${reference}}`,
    });
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
      <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground uppercase tracking-wider">
            Builder
          </p>
          <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">
            Build a generator.
          </h1>
          <p className="text-muted-foreground">
            Start with document details, then add the fields your generated data
            needs.
          </p>
        </div>
        <div className="mt-8 border-t pt-6">
          <BuilderIdentityEditor draft={draft} onDraftChange={setDraft} />
        </div>
        <section
          aria-labelledby="builder-fields-title"
          className="mt-8 border-t pt-6"
        >
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
              className="h-11 text-sm"
              onClick={addField}
              ref={addFieldButtonRef}
              type="button"
            >
              Add field
            </Button>
          </div>
          {fields.length === 0 ? (
            <p className="mt-4 text-muted-foreground text-sm">
              No fields yet. Add one to start defining generated data.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {fields.map((field, index) => {
                const typeId = getGeneratorType(field.definition);
                const catalogEntry =
                  typeId === undefined ? undefined : getCatalogEntry(typeId);
                const generatorSearch = generatorSearches[field.id] ?? "";
                const generatorOptions =
                  searchGeneratorCatalog(generatorSearch);
                const pendingSelection =
                  pendingGeneratorSelection?.fieldId === field.id
                    ? pendingGeneratorSelection
                    : undefined;
                const editor =
                  typeId === undefined ? undefined : getGeneratorEditor(typeId);
                const Editor = editor?.Editor;
                const siblingFields = getBuilderObjectFields(
                  draft,
                  field.path.slice(0, -2),
                );

                return (
                  <li
                    aria-label={`Field ${field.name}`}
                    aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                    className="rounded border bg-muted/30 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    key={field.id}
                    onKeyDown={(event) => {
                      if (event.currentTarget !== event.target || !event.altKey)
                        return;
                      if (event.key === "ArrowUp" && index > 0) {
                        event.preventDefault();
                        moveField(field.id, "up");
                      }
                      if (
                        event.key === "ArrowDown" &&
                        index < fields.length - 1
                      ) {
                        event.preventDefault();
                        moveField(field.id, "down");
                      }
                    }}
                    ref={(element) => {
                      registerFieldRef(field.id, element);
                    }}
                    tabIndex={-1}
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        aria-describedby={
                          fieldErrors[field.id] === undefined
                            ? undefined
                            : `field-name-error-${field.id}`
                        }
                        aria-invalid={fieldErrors[field.id] !== undefined}
                        aria-label={`Field name: ${field.name}`}
                        className="max-w-56 font-medium"
                        onBlur={(event) =>
                          renameField(field.id, event.target.value)
                        }
                        onChange={(event) =>
                          setFieldNames((names) => ({
                            ...names,
                            [field.id]: event.target.value,
                          }))
                        }
                        type="text"
                        value={fieldNames[field.id] ?? field.name}
                      />
                      <span className="text-muted-foreground">
                        {catalogEntry?.displayName ?? "Unknown generator"}
                      </span>
                      <div className="ml-auto flex gap-1">
                        <Button
                          onClick={() => setFieldToChange(field.id)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Change generator
                        </Button>
                        <Button
                          onClick={() => openConfiguration(field.id)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Configure
                        </Button>
                        <Button
                          aria-label={`Move ${field.name} up`}
                          disabled={index === 0}
                          onClick={() => moveField(field.id, "up")}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Move up
                        </Button>
                        <Button
                          aria-label={`Move ${field.name} down`}
                          disabled={index === fields.length - 1}
                          onClick={() => moveField(field.id, "down")}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Move down
                        </Button>
                        <Button
                          onClick={() => setFieldToRemove(field.id)}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {fieldErrors[field.id] === undefined ? null : (
                      <p
                        className="mt-2 text-destructive"
                        id={`field-name-error-${field.id}`}
                        role="alert"
                      >
                        {fieldErrors[field.id]}
                      </p>
                    )}
                    {fieldToConfigure !== field.id ? null : (
                      <section
                        aria-labelledby={`field-configuration-title-${field.id}`}
                        className="mt-3 border-t pt-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3
                            className="font-medium"
                            id={`field-configuration-title-${field.id}`}
                          >
                            Configure {catalogEntry?.displayName ?? "field"}
                          </h3>
                          <Button
                            onClick={() => setFieldToConfigure(undefined)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Close
                          </Button>
                        </div>
                        <div className="mt-3">
                          {Editor === undefined ? (
                            <p role="alert">
                              The selected generator is not available.
                            </p>
                          ) : (
                            <Editor
                              definition={asDefinitionProperties(
                                field.definition,
                              )}
                              issues={configurationIssues[field.id]}
                              onChange={(properties) =>
                                configureField(field.id, properties)
                              }
                            />
                          )}
                          {Editor === undefined ||
                          hasGeneratorConfiguration(field.definition) ? null : (
                            <p className="text-muted-foreground text-sm">
                              This generator has no editable configuration.
                            </p>
                          )}
                          {typeId !== "array" ? null : (
                            <ArrayFieldEditor
                              definition={asDefinitionProperties(
                                field.definition,
                              )}
                              issues={configurationIssues[field.id] ?? []}
                              onChange={(properties) =>
                                configureField(field.id, properties)
                              }
                            />
                          )}
                          {typeId !== "template" ? null : (
                            <TemplateReferencePicker
                              fields={siblingFields}
                              onInsert={(reference) =>
                                insertTemplateReference(field.id, reference)
                              }
                              templateFieldName={field.name}
                            />
                          )}
                        </div>
                      </section>
                    )}
                    {fieldToChange !== field.id ? null : (
                      <section
                        aria-labelledby={`field-generator-title-${field.id}`}
                        className="mt-3 border-t pt-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3
                            className="font-medium"
                            id={`field-generator-title-${field.id}`}
                          >
                            Select generator
                          </h3>
                          <Button
                            onClick={() => setFieldToChange(undefined)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Close
                          </Button>
                        </div>
                        <Input
                          aria-label={`Search generators for ${field.name}`}
                          className="mt-2"
                          onChange={(event) =>
                            setGeneratorSearches((searches) => ({
                              ...searches,
                              [field.id]: event.target.value,
                            }))
                          }
                          placeholder="Search generators"
                          type="search"
                          value={generatorSearch}
                        />
                        {generatorOptions.length === 0 ? (
                          <p className="mt-2 text-muted-foreground text-sm">
                            No generators found.
                          </p>
                        ) : (
                          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                            {generatorOptions.map((entry) => (
                              <li key={entry.typeId}>
                                <Button
                                  className="h-auto w-full justify-start whitespace-normal px-2 py-2 text-left"
                                  onClick={() =>
                                    requestGeneratorSelection(
                                      field.id,
                                      entry.typeId,
                                    )
                                  }
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
                        )}
                      </section>
                    )}
                    {pendingSelection === undefined ? null : (
                      <div
                        aria-describedby={`discard-generator-description-${field.id}`}
                        aria-labelledby={`discard-generator-title-${field.id}`}
                        className="mt-3 flex items-center gap-2 border-t pt-3"
                        role="alertdialog"
                      >
                        <div className="mr-auto">
                          <p
                            className="font-medium"
                            id={`discard-generator-title-${field.id}`}
                          >
                            Discard configuration?
                          </p>
                          <p
                            className="text-muted-foreground"
                            id={`discard-generator-description-${field.id}`}
                          >
                            Changing generators removes this field&apos;s
                            current configuration.
                          </p>
                        </div>
                        <Button
                          onClick={() =>
                            setPendingGeneratorSelection(undefined)
                          }
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() =>
                            selectFieldGenerator(
                              field.id,
                              pendingSelection.typeId,
                            )
                          }
                          size="sm"
                          type="button"
                        >
                          Discard and change
                        </Button>
                      </div>
                    )}
                    {fieldToRemove !== field.id ? null : (
                      <div
                        aria-describedby={`remove-field-description-${field.id}`}
                        aria-labelledby={`remove-field-title-${field.id}`}
                        className="mt-3 flex items-center gap-2 border-t pt-3"
                        role="alertdialog"
                      >
                        <div className="mr-auto">
                          <p
                            className="font-medium"
                            id={`remove-field-title-${field.id}`}
                          >
                            Remove {field.name}?
                          </p>
                          <p
                            className="text-muted-foreground"
                            id={`remove-field-description-${field.id}`}
                          >
                            This removes the field and its configuration.
                          </p>
                        </div>
                        <Button
                          onClick={() => setFieldToRemove(undefined)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => removeField(field.id)}
                          size="sm"
                          type="button"
                          variant="destructive"
                        >
                          Remove field
                        </Button>
                      </div>
                    )}
                    {typeId !== "object" ? null : (
                      <NestedObjectEditor
                        breadcrumbs={[field.name]}
                        depth={1}
                        draft={draft}
                        objectPath={field.path}
                        onDraftChange={setDraft}
                        onFieldFocus={(id) =>
                          setFocusTarget({ type: "field", id })
                        }
                        registerFieldRef={registerFieldRef}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </section>
      </section>
    </main>
  );
}

function getGeneratorType(definition: unknown): string | undefined {
  if (typeof definition !== "object" || definition === null) return undefined;
  const type = (definition as { readonly type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}

function hasGeneratorConfiguration(definition: unknown): boolean {
  if (typeof definition !== "object" || definition === null) return false;
  return Object.keys(definition).some((key) => key !== "type");
}

function asDefinitionProperties(definition: unknown): DefinitionProperties {
  return typeof definition === "object" && definition !== null
    ? (definition as DefinitionProperties)
    : {};
}

function getConfigurationIssues(
  draft: Parameters<typeof toGeneratorDocument>[0],
  field: { readonly definition: unknown; readonly name: string },
): readonly EditorValidationIssue[] {
  const conversion = toGeneratorDocument(draft);
  if (conversion.success) {
    if (getGeneratorType(field.definition) !== "template") return [];
    try {
      generate(conversion.document.definition);
      return [];
    } catch (cause) {
      const error = asBuilderError(cause);
      return error === undefined ? [] : [{ message: error.message, path: [] }];
    }
  }
  const prefix = ["definition", "fields", field.name];
  return conversion.errors.flatMap((error) => {
    if (!prefix.every((segment, index) => error.path[index] === segment)) {
      return [];
    }
    return [{ message: error.message, path: error.path.slice(prefix.length) }];
  });
}

function asBuilderError(
  cause: unknown,
): { readonly message: string } | undefined {
  return typeof cause === "object" &&
    cause !== null &&
    typeof (cause as { readonly message?: unknown }).message === "string"
    ? { message: (cause as { readonly message: string }).message }
    : undefined;
}
