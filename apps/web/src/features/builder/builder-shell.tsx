import { Button } from "@constructa/ui/components/button";
import { Input } from "@constructa/ui/components/input";
import { useEffect, useMemo, useRef, useState } from "react";

import { getCatalogEntry, searchGeneratorCatalog } from "../catalog/catalog";
import type { DefinitionProperties } from "../editor/controls";
import { getGeneratorEditor } from "../editor/registry";
import { ArrayFieldEditor } from "./array-field-editor";
import {
  BuilderInlineValidationIssues,
  BuilderValidationSummary,
  getDefinitionValidationIssues,
  validateBuilderDraft,
} from "./builder-validation";
import { BuilderDocumentExport } from "./document-export";
import { BuilderDocumentImport } from "./document-import";
import { BuilderDraftRecoveryNotice } from "./draft-recovery";
import { BuilderIdentityEditor } from "./identity-editor";
import { LivePreview } from "./live-preview";
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
  replaceBuilderDraftDocument,
  selectBuilderFieldGenerator,
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
  const [announcement, setAnnouncement] = useState("");
  const fieldRefs = useRef(new Map<string, HTMLLIElement>());
  const addFieldButtonRef = useRef<HTMLButtonElement>(null);
  const fields = getBuilderFields(draft);
  const validationIssues = useMemo(() => validateBuilderDraft(draft), [draft]);

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
  }

  function openConfiguration(fieldId: string) {
    const field = fields.find((candidate) => candidate.id === fieldId);
    if (field === undefined) return;
    setFieldToConfigure(fieldId);
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

  function importDocument(
    document: Parameters<typeof replaceBuilderDraftDocument>[1],
  ) {
    setDraft((currentDraft) =>
      replaceBuilderDraftDocument(currentDraft, document),
    );
    setFieldToChange(undefined);
    setFieldToConfigure(undefined);
    setFieldToRemove(undefined);
    setPendingGeneratorSelection(undefined);
    setFieldNames({});
    setFieldErrors({});
    setAnnouncement("Generator document imported.");
  }

  function restoreDocument(document: unknown) {
    importDocument(document);
    setAnnouncement("Local draft restored.");
  }

  return (
    <main className="app-page mx-auto grid max-w-7xl gap-5 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.68fr)] lg:gap-7">
      <section className="app-surface rounded-2xl p-5 sm:p-7">
        <div className="space-y-2">
          <p className="font-medium text-primary text-xs uppercase tracking-[0.18em]">
            Builder
          </p>
          <h1 className="font-semibold text-3xl tracking-[-0.035em] sm:text-4xl">
            Build a generator.
          </h1>
          <p className="text-muted-foreground">
            Name your generator, add fields, and use the preview to check your
            work as you go.
          </p>
        </div>
        <BuilderDocumentImport onImport={importDocument} />
        <BuilderDocumentExport draft={draft} />
        <BuilderDraftRecoveryNotice draft={draft} onRestore={restoreDocument} />
        <div className="mt-8 border-border/70 border-t pt-6">
          <BuilderIdentityEditor draft={draft} onDraftChange={setDraft} />
        </div>
        <section
          aria-labelledby="builder-fields-title"
          className="mt-8 border-border/70 border-t pt-6"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium text-lg" id="builder-fields-title">
                Fields
              </h2>
              <p className="text-muted-foreground text-sm">
                Add the fields your generated object should contain.
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
          {fields.length === 0 ? (
            <p className="mt-4 rounded-xl border border-border/80 border-dashed bg-muted/30 p-4 text-muted-foreground text-sm">
              No fields yet. Add one to start defining generated data.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
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
                const fieldIssues = getDefinitionValidationIssues(
                  validationIssues,
                  field.path,
                );

                return (
                  <li
                    aria-label={`Field ${field.name}`}
                    aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                    className="rounded-xl border border-border/80 bg-background/35 px-3 py-3 text-sm shadow-sm transition-[border-color,box-shadow,background-color] hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring sm:px-4"
                    id={`builder-field-${field.id}`}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        aria-describedby={
                          fieldErrors[field.id] === undefined
                            ? undefined
                            : `field-name-error-${field.id}`
                        }
                        aria-invalid={fieldErrors[field.id] !== undefined}
                        aria-label={`Field name: ${field.name}`}
                        className="h-9 max-w-56 rounded-lg font-medium"
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
                      <span className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
                        {catalogEntry?.displayName ?? "Unknown generator"}
                      </span>
                      <div className="flex w-full gap-1 sm:ml-auto sm:w-auto">
                        <Button
                          onClick={() => setFieldToChange(field.id)}
                          className="rounded-lg"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Change generator
                        </Button>
                        <Button
                          onClick={() => openConfiguration(field.id)}
                          className="rounded-lg"
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
                          className="rounded-lg"
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
                          className="rounded-lg"
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Move down
                        </Button>
                        <Button
                          onClick={() => setFieldToRemove(field.id)}
                          className="rounded-lg"
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
                    {fieldToConfigure === field.id ? null : (
                      <BuilderInlineValidationIssues issues={fieldIssues} />
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
                              issues={fieldIssues}
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
                              issues={fieldIssues}
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
                        validationIssues={validationIssues}
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
          <BuilderValidationSummary
            issues={validationIssues}
            onFocus={(id) => setFocusTarget({ type: "field", id })}
          />
        </section>
      </section>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <LivePreview draft={draft} />
      </aside>
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
