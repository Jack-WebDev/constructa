import { Button } from "@constructa/ui/components/button";
import { useState } from "react";

import {
  addBuilderObjectField,
  type BuilderDocumentDraft,
  type BuilderFieldDraft,
  type BuilderUiId,
  getBuilderObjectFields,
} from "./state";

type NestedObjectEditorProps = {
  readonly breadcrumbs: readonly string[];
  readonly depth: number;
  readonly draft: BuilderDocumentDraft;
  readonly objectPath: readonly (string | number)[];
  readonly onDraftChange: (draft: BuilderDocumentDraft) => void;
  readonly onFieldFocus: (fieldId: BuilderUiId) => void;
  readonly registerFieldRef: (
    fieldId: BuilderUiId,
    element: HTMLLIElement | null,
  ) => void;
};

/** Recursively presents fields owned by a nested object definition. */
export function NestedObjectEditor({
  breadcrumbs,
  depth,
  draft,
  objectPath,
  onDraftChange,
  onFieldFocus,
  registerFieldRef,
}: NestedObjectEditorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const fields = getBuilderObjectFields(draft, objectPath);
  const objectName = breadcrumbs.at(-1) ?? "object";

  function addField() {
    const result = addBuilderObjectField(draft, objectPath);
    if (!result.success) return;
    onDraftChange(result.draft);
    onFieldFocus(result.field.id);
  }

  return (
    <section
      aria-label={`Nested object ${breadcrumbs.join(" / ")}, depth ${depth}`}
      className="mt-3 border-l pl-4"
      data-depth={depth}
    >
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
          onClick={() => setCollapsed((isCollapsed) => !isCollapsed)}
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
      {collapsed ? null : fields.length === 0 ? (
        <p className="mt-2 text-muted-foreground text-sm">
          No fields in this object.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {fields.map((field) => (
            <NestedField
              breadcrumbs={breadcrumbs}
              depth={depth}
              draft={draft}
              field={field}
              key={field.id}
              onDraftChange={onDraftChange}
              onFieldFocus={onFieldFocus}
              registerFieldRef={registerFieldRef}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function NestedField({
  breadcrumbs,
  depth,
  draft,
  field,
  onDraftChange,
  onFieldFocus,
  registerFieldRef,
}: Omit<NestedObjectEditorProps, "objectPath"> & {
  readonly field: BuilderFieldDraft;
}) {
  const isObject = getGeneratorType(field.definition) === "object";

  return (
    <li
      aria-label={`Field ${field.name}`}
      className="rounded border bg-muted/30 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      ref={(element) => registerFieldRef(field.id, element)}
      tabIndex={-1}
    >
      <span className="font-medium">{field.name}</span>
      <span className="ml-2 text-muted-foreground">
        {isObject
          ? "Object"
          : (getGeneratorType(field.definition) ?? "Unknown generator")}
      </span>
      {isObject ? (
        <NestedObjectEditor
          breadcrumbs={[...breadcrumbs, field.name]}
          depth={depth + 1}
          draft={draft}
          objectPath={field.path}
          onDraftChange={onDraftChange}
          onFieldFocus={onFieldFocus}
          registerFieldRef={registerFieldRef}
        />
      ) : null}
    </li>
  );
}

function getGeneratorType(definition: unknown): string | undefined {
  if (typeof definition !== "object" || definition === null) return undefined;
  const type = (definition as { readonly type?: unknown }).type;
  return typeof type === "string" ? type : undefined;
}
