import { Button } from "@constructa/ui/components/button";
import type { ValidationPath } from "constructa-sdk";
import { ChevronDown, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  BuilderValidationSummary,
  validateBuilderDraft,
} from "./builder-validation";
import { DefinitionEditor, FieldConfiguration } from "./definition-editor";
import { BuilderDocumentExport } from "./document-export";
import { BuilderDocumentImport } from "./document-import";
import { BuilderDraftRecoveryNotice } from "./draft-recovery";
import { GenerationDialog } from "./generation-dialog";
import { BuilderIdentityEditor } from "./identity-editor";
import { LivePreview } from "./live-preview";
import {
  createBuilderDraft,
  getBuilderDocumentIdentity,
  getBuilderFields,
  replaceBuilderDraftDocument,
} from "./state";

const INITIAL_DOCUMENT = {
  schemaVersion: 1,
  definition: { type: "object", fields: {} },
};

/** The Builder's one document source of truth and three-region workspace. */
export function BuilderShell() {
  const [draft, setDraft] = useState(() =>
    createBuilderDraft(INITIAL_DOCUMENT),
  );
  const [selectedPath, setSelectedPath] = useState<ValidationPath>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const validationIssues = useMemo(() => validateBuilderDraft(draft), [draft]);
  const identity = getBuilderDocumentIdentity(draft);
  const datasetName =
    typeof identity.name === "string" && identity.name.trim() !== ""
      ? identity.name
      : "Untitled dataset";
  const fieldCount = getBuilderFields(draft).length;

  function importDocument(
    document: Parameters<typeof replaceBuilderDraftDocument>[1],
  ) {
    setDraft((currentDraft) =>
      replaceBuilderDraftDocument(currentDraft, document),
    );
    setSelectedPath(undefined);
  }

  return (
    <main className="app-page relative isolate min-h-svh overflow-hidden bg-background px-3 py-3 sm:px-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-[length:100%_100%] bg-center opacity-95"
        style={{ backgroundImage: 'url("/generators-bg.png")' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-background/25"
      />
      <div className="mx-auto max-w-360">
        <header className="flex flex-wrap items-center justify-between gap-4 px-1 pb-4">
          <div className="min-w-0">
            <p className="truncate font-medium text-muted-foreground text-xs">
              Constructa / Builder
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <h1 className="truncate font-medium text-xl tracking-tight">
                {datasetName}
              </h1>
              <span className="shrink-0 text-muted-foreground text-xs">
                {fieldCount} {fieldCount === 1 ? "field" : "fields"} ·
                Previewing 1 record
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              aria-expanded={detailsOpen}
              onClick={() => setDetailsOpen((value) => !value)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Settings2 /> Dataset settings
              <ChevronDown className={detailsOpen ? "rotate-180" : ""} />
            </Button>
            <GenerationDialog draft={draft} />
          </div>
        </header>
        {detailsOpen ? (
          <section className="mb-2 grid gap-5 rounded-xl border border-border/80 bg-card/85 p-5 shadow-foreground/7 shadow-md lg:grid-cols-3">
            <BuilderIdentityEditor draft={draft} onDraftChange={setDraft} />
            <BuilderDocumentImport onImport={importDocument} />
            <div>
              <BuilderDocumentExport draft={draft} />
              <BuilderDraftRecoveryNotice
                draft={draft}
                onRestore={importDocument}
              />
            </div>
          </section>
        ) : null}
        <div className="grid min-h-[calc(100svh-6.5rem)] gap-2 lg:grid-cols-[minmax(17rem,.82fr)_minmax(21rem,.92fr)_minmax(21rem,.95fr)]">
          <aside className="min-h-0 overflow-y-auto rounded-xl border border-border/80 bg-card/85 shadow-foreground/7 shadow-md">
            <DefinitionEditor
              draft={draft}
              onDraftChange={setDraft}
              onSelect={setSelectedPath}
              selectedPath={selectedPath}
              validationIssues={validationIssues}
            />
          </aside>
          <section className="min-h-0 overflow-y-auto rounded-xl border border-border/80 bg-card/85 shadow-foreground/7 shadow-md">
            <FieldConfiguration
              draft={draft}
              onDraftChange={setDraft}
              onSelect={setSelectedPath}
              selectedPath={selectedPath}
              validationIssues={validationIssues}
            />
          </section>
          <aside className="min-h-0 overflow-y-auto">
            <LivePreview draft={draft} />
          </aside>
        </div>
        {validationIssues.length > 0 ? (
          <footer className="mt-2 rounded-xl border border-destructive/30 bg-card/90 px-4 py-3 shadow-sm">
            <BuilderValidationSummary
              issues={validationIssues}
              onFocus={(id) => {
                const definition = draft.definitionIdentities.find(
                  (candidate) => candidate.id === id,
                );
                if (definition !== undefined) setSelectedPath(definition.path);
              }}
            />
          </footer>
        ) : null}
      </div>
    </main>
  );
}
