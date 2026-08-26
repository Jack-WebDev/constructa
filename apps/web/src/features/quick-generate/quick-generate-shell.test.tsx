import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";

import { QuickGenerateShell } from "./quick-generate-shell";

afterEach(cleanup);

describe("QuickGenerateShell", () => {
  it("starts with an anonymous integer generator and renders a generated result", () => {
    render(<QuickGenerateShell />);

    expect(
      screen.getByRole("heading", { name: "Generate one value." }),
    ).not.toBeNull();
    expect(screen.getByLabelText("Generator")).toHaveProperty(
      "value",
      "integer",
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(screen.getByRole("status").textContent).toMatch(/^\d+$/u);
  });

  it("replaces the selected definition and exposes its configuration controls", () => {
    render(<QuickGenerateShell />);

    fireEvent.change(screen.getByLabelText("Generator"), {
      target: { value: "date" },
    });

    expect(screen.getByLabelText("Minimum date")).toHaveProperty(
      "value",
      "2026-01-01",
    );
    expect(screen.getByLabelText("Maximum date")).toHaveProperty(
      "value",
      "2026-12-31",
    );
  });

  it("surfaces shared validation errors with their stable code and path", () => {
    render(<QuickGenerateShell />);

    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText("Maximum"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "INVALID_RANGE at min",
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "min must be less than or equal to max",
    );
  });

  it("shows shared numeric validation beside the invalid control while preserving the draft", () => {
    render(<QuickGenerateShell />);

    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "200" },
    });

    expect(screen.getByLabelText("Minimum")).toHaveProperty("value", "200");
    expect(
      screen.getByText("min must be less than or equal to max"),
    ).not.toBeNull();
    expect(screen.getByLabelText("Minimum").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("keeps the shell callable without props", () => {
    expectTypeOf(QuickGenerateShell).parameters.toEqualTypeOf<[]>();
  });
});
