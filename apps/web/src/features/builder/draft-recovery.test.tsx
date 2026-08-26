import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  BUILDER_DRAFT_EXPIRY_MS,
  BUILDER_DRAFT_SAVE_DELAY_MS,
  BUILDER_DRAFT_STORAGE_KEY,
  type BuilderDraftRecovery,
  BuilderDraftRecoveryNotice,
  type DraftStorage,
  loadBuilderDraft,
  saveBuilderDraft,
} from "./draft-recovery";
import { createBuilderDraft } from "./state";

class MemoryStorage implements DraftStorage {
  readonly entries = new Map<string, string>();
  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }
  removeItem(key: string) {
    this.entries.delete(key);
  }
  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
}

const draft = createBuilderDraft({
  schemaVersion: 1,
  definition: { type: "object", fields: {} },
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("builder draft recovery", () => {
  it("saves only the portable draft document and loads it before expiry", () => {
    const storage = new MemoryStorage();
    expect(saveBuilderDraft(storage, draft, 100)).toBe(true);
    expect(
      JSON.parse(storage.getItem(BUILDER_DRAFT_STORAGE_KEY) ?? "{}"),
    ).toEqual({ version: 1, savedAt: 100, document: draft.document });
    expect(loadBuilderDraft(storage, 100)).toEqual({
      status: "restorable",
      document: draft.document,
    });
  });

  it("discards expired and corrupt persisted data", () => {
    const storage = new MemoryStorage();
    saveBuilderDraft(storage, draft, 0);
    expect(loadBuilderDraft(storage, BUILDER_DRAFT_EXPIRY_MS + 1)).toEqual({
      status: "discarded",
      reason: "expired",
    });
    expect(storage.getItem(BUILDER_DRAFT_STORAGE_KEY)).toBeNull();
    storage.setItem(BUILDER_DRAFT_STORAGE_KEY, "not json");
    expect(loadBuilderDraft(storage)).toEqual({
      status: "discarded",
      reason: "corrupt",
    });
  });

  it("offers restore or discard before it begins local persistence", async () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    saveBuilderDraft(
      storage,
      createBuilderDraft({
        schemaVersion: 1,
        definition: { type: "object", fields: { id: { type: "uuid" } } },
      }),
      Date.now(),
    );
    const onRestore = vi.fn();
    render(
      <BuilderDraftRecoveryNotice
        draft={draft}
        onRestore={onRestore}
        storage={storage}
      />,
    );

    expect(screen.getByRole("alertdialog").textContent).toContain(
      "local draft",
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore draft" }));
    expect(onRestore).toHaveBeenCalledWith(
      expect.objectContaining({ schemaVersion: 1 }),
    );
    await act(async () => {
      vi.advanceTimersByTime(BUILDER_DRAFT_SAVE_DELAY_MS);
    });
    expect(loadBuilderDraft(storage).status).toBe("restorable");
  });

  it("states the local-only privacy notice", () => {
    render(
      <BuilderDraftRecoveryNotice
        draft={draft}
        onRestore={vi.fn()}
        storage={new MemoryStorage()}
      />,
    );
    expect(screen.getByText(/saved only in this browser/u)).not.toBeNull();
  });

  it("keeps recovery results typed", () => {
    expectTypeOf<
      ReturnType<typeof loadBuilderDraft>
    >().toEqualTypeOf<BuilderDraftRecovery>();
  });
});
