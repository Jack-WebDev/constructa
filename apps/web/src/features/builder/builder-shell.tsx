import { Button } from "@constructa/ui/components/button";
import { useEffect, useRef, useState } from "react";

import { BuilderIdentityEditor } from "./identity-editor";
import { addBuilderField, createBuilderDraft, getBuilderFields } from "./state";

const INITIAL_DOCUMENT = {
  schemaVersion: 1,
  definition: { type: "object", fields: {} },
};

export function BuilderShell() {
  const [draft, setDraft] = useState(() =>
    createBuilderDraft(INITIAL_DOCUMENT),
  );
  const [fieldToFocus, setFieldToFocus] = useState<string>();
  const fieldRefs = useRef(new Map<string, HTMLLIElement>());
  const fields = getBuilderFields(draft);

  useEffect(() => {
    if (fieldToFocus === undefined) return;
    fieldRefs.current.get(fieldToFocus)?.focus();
    setFieldToFocus(undefined);
  }, [fieldToFocus]);

  function addField() {
    const result = addBuilderField(draft);
    if (!result.success) return;
    setDraft(result.draft);
    setFieldToFocus(result.field.id);
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
            <Button className="h-11 text-sm" onClick={addField} type="button">
              Add field
            </Button>
          </div>
          {fields.length === 0 ? (
            <p className="mt-4 text-muted-foreground text-sm">
              No fields yet. Add one to start defining generated data.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {fields.map((field) => (
                <li
                  aria-label={`Field ${field.name}`}
                  className="rounded border bg-muted/30 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  key={field.id}
                  ref={(element) => {
                    if (element === null) fieldRefs.current.delete(field.id);
                    else fieldRefs.current.set(field.id, element);
                  }}
                  tabIndex={-1}
                >
                  <span className="font-medium">{field.name}</span>
                  <span className="ml-2 text-muted-foreground">Boolean</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
