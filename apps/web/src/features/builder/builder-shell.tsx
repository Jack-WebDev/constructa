import { useEffect, useMemo, useRef, useState } from "react";

import {
  BuilderValidationSummary,
  validateBuilderDraft,
} from "./builder-validation";
import { DefinitionEditor } from "./definition-editor";
import { BuilderDocumentExport } from "./document-export";
import { BuilderDocumentImport } from "./document-import";
import { BuilderDraftRecoveryNotice } from "./draft-recovery";
import { BuilderIdentityEditor } from "./identity-editor";
import { LivePreview } from "./live-preview";
import { createBuilderDraft, replaceBuilderDraftDocument } from "./state";

const INITIAL_DOCUMENT = {
  schemaVersion: 1,
  definition: { type: "object", fields: {} },
};

/** Coordinates document-level controls around the recursive definition editor. */
export function BuilderShell() {
  const [draft, setDraft] = useState(() =>
    createBuilderDraft(INITIAL_DOCUMENT),
  );
  const [focusTarget, setFocusTarget] = useState<
    { readonly type: "field"; readonly id: string } | { readonly type: "add" }
  >();
  const [announcement, setAnnouncement] = useState("");
  const fieldRefs = useRef(new Map<string, HTMLLIElement>());
  const addFieldButtonRef = useRef<HTMLButtonElement>(null);
  const validationIssues = useMemo(() => validateBuilderDraft(draft), [draft]);

  useEffect(() => {
    if (focusTarget === undefined) return;
    if (focusTarget.type === "field")
      fieldRefs.current.get(focusTarget.id)?.focus();
    else addFieldButtonRef.current?.focus();
    setFocusTarget(undefined);
  }, [focusTarget]);

  function registerFieldRef(fieldId: string, element: HTMLLIElement | null) {
    if (element === null) fieldRefs.current.delete(fieldId);
    else fieldRefs.current.set(fieldId, element);
  }

  function importDocument(
    document: Parameters<typeof replaceBuilderDraftDocument>[1],
  ) {
    setDraft((currentDraft) =>
      replaceBuilderDraftDocument(currentDraft, document),
    );
    setFocusTarget(undefined);
    setAnnouncement("Generator document imported.");
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-5 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.68fr)] lg:gap-7">
      <section className="rounded-2xl border border-border/80 bg-card/75 p-5 shadow-black/5 shadow-xl sm:p-7">
        <div className="space-y-2">
          <p className="font-medium text-primary text-xs uppercase tracking-[0.18em]">
            Builder
          </p>
          <h1 className="font-semibold text-3xl tracking-[-0.035em] sm:text-4xl">
            Build a generator.
          </h1>
          <p className="text-muted-foreground">
            Start with document details, then add the fields your generated data
            needs.
          </p>
        </div>
        <BuilderDocumentImport onImport={importDocument} />
        <BuilderDocumentExport draft={draft} />
        <BuilderDraftRecoveryNotice draft={draft} onRestore={importDocument} />
        <div className="mt-8 border-border/70 border-t pt-6">
          <BuilderIdentityEditor draft={draft} onDraftChange={setDraft} />
        </div>
        <section
          aria-labelledby="builder-fields-title"
          className="mt-8 border-border/70 border-t pt-6"
        >
          <DefinitionEditor
            addFieldButtonRef={addFieldButtonRef}
            draft={draft}
            onDraftChange={setDraft}
            onEmptyFocus={() => setFocusTarget({ type: "add" })}
            onFieldFocus={(id) => setFocusTarget({ type: "field", id })}
            registerFieldRef={registerFieldRef}
            validationIssues={validationIssues}
          />
          <BuilderValidationSummary
            issues={validationIssues}
            onFocus={(id) => setFocusTarget({ type: "field", id })}
          />
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </section>
      </section>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <LivePreview draft={draft} />
      </aside>
    </main>
  );
}
