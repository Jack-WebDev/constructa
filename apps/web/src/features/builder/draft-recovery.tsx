import { Button } from "@constructa/ui/components/button";
import { useEffect, useState } from "react";

import type { BuilderDocumentDraft } from "./state";

export const BUILDER_DRAFT_STORAGE_KEY = "constructa.builder-draft.v1";
export const BUILDER_DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
export const BUILDER_DRAFT_SAVE_DELAY_MS = 500;

export type DraftStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

type StoredBuilderDraft = {
  readonly savedAt: number;
  readonly version: 1;
  readonly document: unknown;
};

export type BuilderDraftRecovery =
  | { readonly status: "none" }
  | { readonly status: "restorable"; readonly document: unknown }
  | { readonly status: "discarded"; readonly reason: "corrupt" | "expired" };

/** Saves only portable draft data to the browser's local storage. */
export function saveBuilderDraft(
  storage: DraftStorage,
  draft: BuilderDocumentDraft,
  now = Date.now(),
): boolean {
  try {
    storage.setItem(
      BUILDER_DRAFT_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt: now,
        document: draft.document,
      } satisfies StoredBuilderDraft),
    );
    return true;
  } catch {
    return false;
  }
}

/** Loads a non-expired, structurally safe local draft and clears unusable data. */
export function loadBuilderDraft(
  storage: DraftStorage,
  now = Date.now(),
): BuilderDraftRecovery {
  let source: string | null;
  try {
    source = storage.getItem(BUILDER_DRAFT_STORAGE_KEY);
  } catch {
    return { status: "none" };
  }
  if (source === null) return { status: "none" };
  let stored: unknown;
  try {
    stored = JSON.parse(source);
  } catch {
    removeDraft(storage);
    return { status: "discarded", reason: "corrupt" };
  }
  if (!isStoredBuilderDraft(stored)) {
    removeDraft(storage);
    return { status: "discarded", reason: "corrupt" };
  }
  if (now - stored.savedAt > BUILDER_DRAFT_EXPIRY_MS) {
    removeDraft(storage);
    return { status: "discarded", reason: "expired" };
  }
  return { status: "restorable", document: stored.document };
}

function getLocalStorage(): DraftStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Coordinates local-only save, restore, discard, expiry, and privacy notice. */
export function BuilderDraftRecoveryNotice({
  draft,
  onRestore,
  storage = getLocalStorage(),
}: {
  readonly draft: BuilderDocumentDraft;
  readonly onRestore: (document: unknown) => void;
  readonly storage?: DraftStorage;
}) {
  const [checked, setChecked] = useState(false);
  const [recovery, setRecovery] = useState<BuilderDraftRecovery>({
    status: "none",
  });
  useEffect(() => {
    if (storage !== undefined) setRecovery(loadBuilderDraft(storage));
    setChecked(true);
  }, [storage]);
  useEffect(() => {
    if (!checked || recovery.status === "restorable" || storage === undefined)
      return;
    const timeout = window.setTimeout(() => {
      saveBuilderDraft(storage, draft);
    }, BUILDER_DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [checked, draft, recovery.status, storage]);
  function discard() {
    if (storage !== undefined) removeDraft(storage);
    setRecovery({ status: "none" });
  }
  return (
    <section aria-labelledby="draft-recovery-title" className="border-t pt-6">
      <h2 className="font-medium text-lg" id="draft-recovery-title">
        Local draft recovery
      </h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Drafts are saved only in this browser for up to 7 days. Do not use this
        device for sensitive generator documents.
      </p>
      {recovery.status === "restorable" ? (
        <div
          className="mt-3 flex flex-wrap items-center gap-2"
          role="alertdialog"
        >
          <p className="mr-auto text-sm">
            A local draft is available to restore.
          </p>
          <Button onClick={discard} type="button" variant="outline">
            Discard draft
          </Button>
          <Button
            onClick={() => {
              onRestore(recovery.document);
              setRecovery({ status: "none" });
            }}
            type="button"
          >
            Restore draft
          </Button>
        </div>
      ) : null}
      {recovery.status === "discarded" ? (
        <p
          aria-live="polite"
          className="mt-3 text-muted-foreground text-sm"
          role="status"
        >
          {recovery.reason === "expired"
            ? "An expired local draft was discarded."
            : "An unreadable local draft was discarded."}
        </p>
      ) : null}
    </section>
  );
}

function removeDraft(storage: DraftStorage): void {
  try {
    storage.removeItem(BUILDER_DRAFT_STORAGE_KEY);
  } catch {
    /* recovery is non-blocking */
  }
}
function isStoredBuilderDraft(value: unknown): value is StoredBuilderDraft {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const stored = value as Partial<StoredBuilderDraft>;
  return (
    stored.version === 1 &&
    typeof stored.savedAt === "number" &&
    Number.isFinite(stored.savedAt) &&
    typeof stored.document === "object" &&
    stored.document !== null &&
    !Array.isArray(stored.document)
  );
}
