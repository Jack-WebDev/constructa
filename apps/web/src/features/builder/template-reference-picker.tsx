import { Button } from "@constructa/ui/components/button";

import type { BuilderFieldDraft } from "./state";

type TemplateReferencePickerProps = {
  readonly fields: readonly BuilderFieldDraft[];
  readonly onInsert: (reference: string) => void;
  readonly templateFieldName: string;
};

/** Offers only scalar paths available to a template within its object scope. */
export function TemplateReferencePicker({
  fields,
  onInsert,
  templateFieldName,
}: TemplateReferencePickerProps) {
  const references = fields.flatMap((field) =>
    field.name === templateFieldName ? [] : collectScalarPaths(field),
  );

  return (
    <section
      aria-labelledby="template-references-title"
      className="mt-4 border-t pt-4"
    >
      <h4 className="font-medium" id="template-references-title">
        Insert reference
      </h4>
      <p className="mt-1 text-muted-foreground text-sm">
        References use sibling paths only, such as {"{customer.name}"}.
      </p>
      {references.length === 0 ? (
        <p className="mt-2 text-muted-foreground text-sm">
          No scalar fields are available in this object.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {references.map((reference) => (
            <Button
              key={reference}
              onClick={() => onInsert(reference)}
              size="sm"
              type="button"
              variant="outline"
            >
              Insert {`{${reference}}`}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}

function collectScalarPaths(
  field: BuilderFieldDraft,
  prefix: readonly string[] = [],
): readonly string[] {
  const definition = asRecord(field.definition);
  const path = [...prefix, field.name];
  if (definition?.type === "array") return [];
  if (definition?.type !== "object") return [path.join(".")];
  const fields = asRecord(definition.fields);
  if (fields === undefined) return [];
  return Object.entries(fields).flatMap(([name, child]) =>
    collectScalarPaths({ definition: child, id: "", name, path: [] }, path),
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
