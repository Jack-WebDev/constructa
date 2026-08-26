import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  copyToClipboard,
  formatPreview,
  ResultPreview,
  type ResultPreviewState,
} from "../result-preview";

afterEach(cleanup);

describe("ResultPreview", () => {
  it("renders safe primitive text and formatted JSON", () => {
    const { rerender } = render(
      <ResultPreview state={{ status: "success", value: "<img src=x>" }} />,
    );
    expect(screen.getByRole("status").textContent).toBe("<img src=x>");
    expect(document.querySelector("img")).toBeNull();

    rerender(
      <ResultPreview
        state={{ status: "success", value: { active: true, count: 0 } }}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe(
      '{\n  "active": true,\n  "count": 0\n}',
    );
  });

  it("renders empty, loading, error, and overflow states", () => {
    const { rerender } = render(<ResultPreview state={{ status: "idle" }} />);
    expect(
      screen.getByText("Configure a generator, then select Generate."),
    ).not.toBeNull();

    rerender(<ResultPreview state={{ status: "loading" }} />);
    expect(screen.getByRole("status").textContent).toBe("Generating result…");

    rerender(
      <ResultPreview
        state={{
          status: "error",
          error: {
            code: "INVALID_RANGE",
            kind: "configuration",
            message: "Invalid range",
            path: ["min"],
          },
        }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "INVALID_RANGE at min",
    );

    rerender(
      <ResultPreview
        state={{ status: "success", value: "x".repeat(10_001) }}
      />,
    );
    expect(screen.getByText(/Preview truncated/u)).not.toBeNull();
  });

  it("keeps system failures generic while preserving actionable dependency errors", () => {
    const { rerender } = render(
      <ResultPreview
        state={{
          status: "error",
          error: {
            code: "SYSTEM_ERROR",
            kind: "system",
            message: "secret internal detail",
            path: [],
          },
        }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Something went wrong while generating the result.",
    );
    expect(screen.queryByText("secret internal detail")).toBeNull();

    rerender(
      <ResultPreview
        state={{
          status: "error",
          error: {
            code: "REFERENCE_NOT_FOUND",
            kind: "dependency",
            message: "Reference profile.id was not found",
            path: ["source"],
          },
        }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Update generator references",
    );
  });

  it("has a stable preview format and state surface", () => {
    expect(formatPreview(false)).toBe("false");
    expect(formatPreview(null)).toBe("null");
    expectTypeOf<ResultPreviewState>().toMatchTypeOf<{
      readonly status: string;
    }>();
  });

  it("copies the same serialized value shown by the preview and confirms success", async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    render(
      <ResultPreview
        clipboard={clipboard}
        state={{ status: "success", value: { active: true, count: 0 } }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy result" }));

    await waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith(
        '{\n  "active": true,\n  "count": 0\n}',
      );
    });
    expect(screen.getByText("Copied result.")).not.toBeNull();
  });

  it("handles unavailable and denied clipboard access without exposing errors", async () => {
    await expect(copyToClipboard("value", undefined)).rejects.toThrow(
      "Clipboard is unavailable.",
    );
    const clipboard = {
      writeText: vi.fn().mockRejectedValue(new Error("Denied")),
    };
    render(
      <ResultPreview
        clipboard={clipboard}
        state={{ status: "success", value: "value" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy result" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Unable to copy the result. Check clipboard permissions and try again.",
        ),
      ).not.toBeNull();
    });
    expect(screen.queryByText("Denied")).toBeNull();
  });
});
