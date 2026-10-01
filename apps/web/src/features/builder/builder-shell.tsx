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
    <main className="app-page mx-auto w-full max-w-[1600px] px-3 py-3 sm:px-5 sm:py-5">
      <section className="builder-workspace overflow-hidden border border-border/80 bg-card/70">
        <header className="flex flex-wrap items-center justify-between gap-4 border-border/70 border-b px-4 py-3 sm:px-5">
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
          <section className="grid gap-6 border-border/70 border-b bg-muted/25 px-5 py-5 lg:grid-cols-3">
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
        <div className="grid min-h-[calc(100svh-12rem)] lg:grid-cols-[minmax(15rem,.78fr)_minmax(22rem,1fr)_minmax(20rem,.9fr)]">
          <aside className="border-border/70 border-b lg:border-r lg:border-b-0">
            <DefinitionEditor
              draft={draft}
              onDraftChange={setDraft}
              onSelect={setSelectedPath}
              selectedPath={selectedPath}
              validationIssues={validationIssues}
            />
          </aside>
          <section className="border-border/70 border-b lg:border-r lg:border-b-0">
            <FieldConfiguration
              draft={draft}
              onDraftChange={setDraft}
              onSelect={setSelectedPath}
              selectedPath={selectedPath}
              validationIssues={validationIssues}
            />
          </section>
          <aside className="bg-muted/15 px-4 py-4 sm:px-5">
            <LivePreview draft={draft} />
          </aside>
        </div>
        <footer className="border-border/70 border-t px-4 py-2.5">
          <BuilderValidationSummary
            issues={validationIssues}
            onFocus={(id) => {
              const definition = draft.definitionIdentities.find(
                (candidate) => candidate.id === id,
              );
              if (definition !== undefined) setSelectedPath(definition.path);
            }}
          />
          {validationIssues.length === 0 ? (
            <p className="text-muted-foreground text-xs">✓ Definition valid</p>
          ) : null}
        </footer>
      </section>
    </main>
  );
}
