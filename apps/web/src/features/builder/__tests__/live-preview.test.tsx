import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  LIVE_PREVIEW_DEBOUNCE_MS,
  LivePreview,
  type PreviewGenerator,
} from "../live-preview";
import { type BuilderDocumentDraft, createBuilderDraft } from "../state";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function createDraft(value: string): BuilderDocumentDraft {
  return createBuilderDraft({
    schemaVersion: 1,
    definition: {
      type: "object",
      fields: { value: { type: "choice", values: [value] } },
    },
  });
}

describe("LivePreview", () => {
  it("debounces edits and runs the converted document through its preview generator", async () => {
    vi.useFakeTimers();
    const execute = vi.fn(() => ({ value: "first" }));
    render(<LivePreview draft={createDraft("first")} execute={execute} />);

    await act(async () => {
      vi.advanceTimersByTime(LIVE_PREVIEW_DEBOUNCE_MS - 1);
    });
    expect(execute).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(execute).toHaveBeenCalledWith(
      {
        type: "object",
        fields: { value: { type: "choice", values: ["first"] } },
      },
      undefined,
    );
    expect(screen.getByLabelText("Live preview result").textContent).toContain(
      "first",
    );
    vi.useRealTimers();
  });

  it("regenerates immediately and keeps the optional seed out of the draft", async () => {
    vi.useFakeTimers();
    const execute = vi.fn(() => ({ value: "sample" }));
    render(<LivePreview draft={createDraft("sample")} execute={execute} />);

    fireEvent.change(screen.getByLabelText("Preview seed (optional)"), {
      target: { value: "replay" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(execute).toHaveBeenCalledWith(expect.any(Object), {
      seed: "replay",
    });
    expect(
      screen.getByText(/not saved in the generator document/u),
    ).not.toBeNull();
    vi.useRealTimers();
  });

  it("does not let an older asynchronous result overwrite a newer draft", async () => {
    vi.useFakeTimers();
    let resolveFirst: ((value: unknown) => void) | undefined;
    let resolveSecond: ((value: unknown) => void) | undefined;
    const execute: PreviewGenerator = vi.fn(
      () =>
        new Promise((resolve) => {
          if (resolveFirst === undefined) resolveFirst = resolve;
          else resolveSecond = resolve;
        }),
    );
    const view = render(
      <LivePreview draft={createDraft("first")} execute={execute} />,
    );

    await act(async () => {
      vi.advanceTimersByTime(LIVE_PREVIEW_DEBOUNCE_MS);
      await Promise.resolve();
    });
    view.rerender(
      <LivePreview draft={createDraft("second")} execute={execute} />,
    );
    await act(async () => {
      vi.advanceTimersByTime(LIVE_PREVIEW_DEBOUNCE_MS);
      await Promise.resolve();
      resolveSecond?.({ value: "second" });
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Live preview result").textContent).toContain(
      "second",
    );

    await act(async () => {
      resolveFirst?.({ value: "first" });
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Live preview result").textContent).toContain(
      "second",
    );
    vi.useRealTimers();
  });

  it("retains invalid drafts and reports preview unavailability with shared errors", async () => {
    vi.useFakeTimers();
    const execute = vi.fn();
    render(
      <LivePreview
        draft={createBuilderDraft({
          schemaVersion: 1,
          definition: {
            type: "object",
            fields: { age: { type: "integer", min: 2, max: 1 } },
          },
        })}
        execute={execute}
      />,
    );
    await act(async () => {
      vi.advanceTimersByTime(LIVE_PREVIEW_DEBOUNCE_MS);
    });

    expect(execute).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "Preview unavailable",
    );
    expect(screen.getByRole("alert").textContent).toContain("configuration /");
    vi.useRealTimers();
  });

  it("keeps its public execution seam typed as a generator definition", () => {
    expectTypeOf<PreviewGenerator>().toMatchTypeOf<
      (definition: import("constructa-sdk").GeneratorDefinition) => unknown
    >();
  });
});
