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

  it("uses a mobile-first layout with touch-sized controls and a bounded preview", () => {
    render(<QuickGenerateShell />);

    expect(screen.getByRole("main").className).toContain(
      "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
    );
    expect(screen.getByLabelText("Generator").className).toContain("h-11");
    expect(screen.getByLabelText("Minimum").className).toContain("h-11");
    expect(
      screen.getByRole("button", { name: "Generate" }).className,
    ).toContain("h-11");

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(screen.getByRole("status").className).toContain("max-h-[50dvh]");
    expect(screen.getByRole("status").className).toContain(
      "overscroll-contain",
    );
  });

  it("preserves labelled keyboard submission and live result feedback", () => {
    render(<QuickGenerateShell />);

    const form = screen.getByRole("form", { name: "Generate one value." });
    expect(form.getAttribute("aria-describedby")).toBe(
      "quick-generate-description",
    );
    expect(screen.getByLabelText("Generator").className).toContain(
      "focus-visible:ring-2",
    );
    expect(screen.getByLabelText("Minimum").className).toContain(
      "focus-visible:ring-2",
    );

    fireEvent.submit(form);

    expect(screen.getByRole("status").getAttribute("aria-label")).toBe(
      "Generated result",
    );
    expect(screen.getByText("Generated result ready.")).not.toBeNull();
  });

  it("moves focus to the first invalid field after keyboard submission", () => {
    render(<QuickGenerateShell />);

    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "200" },
    });
    fireEvent.change(screen.getByLabelText("Maximum"), {
      target: { value: "10" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Generate one value." }));

    expect(document.activeElement).toBe(screen.getByLabelText("Minimum"));
    expect(
      screen
        .getAllByRole("alert")
        .some((alert) => alert.className.includes("text-destructive")),
    ).toBe(true);
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

    const alerts = screen.getAllByRole("alert");
    expect(alerts.at(-1)?.textContent).toContain("INVALID_RANGE at min");
    expect(alerts.at(-1)?.textContent).toContain(
      "min must be less than or equal to max",
    );
    expect(
      screen.getByRole("heading", { name: "Fix the generator definition" }),
    ).not.toBeNull();
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

  it("edits choice values as JSON without coercing their types", () => {
    render(<QuickGenerateShell />);

    fireEvent.change(screen.getByLabelText("Generator"), {
      target: { value: "choice" },
    });
    fireEvent.change(screen.getByLabelText("Choices"), {
      target: { value: '[0, false, false, "two"]' },
    });

    expect(screen.getByLabelText("Choices")).toHaveProperty(
      "value",
      '[\n  0,\n  false,\n  false,\n  "two"\n]',
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(screen.getByRole("status").textContent).toMatch(/^(0|false|two)$/u);
  });

  it("shows shared choice validation for empty and malformed drafts", () => {
    render(<QuickGenerateShell />);

    fireEvent.change(screen.getByLabelText("Generator"), {
      target: { value: "choice" },
    });
    fireEvent.change(screen.getByLabelText("Choices"), {
      target: { value: "[]" },
    });
    expect(screen.getByText("values must not be empty")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Choices"), {
      target: { value: "not json" },
    });
    expect(
      screen.getByText("choice definition must contain a values array"),
    ).not.toBeNull();
  });

  it("configures string length and character set with shared validation", () => {
    render(<QuickGenerateShell />);

    fireEvent.change(screen.getByLabelText("Generator"), {
      target: { value: "string" },
    });
    fireEvent.change(screen.getByLabelText("Length"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Character set"), {
      target: { value: "numeric" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(screen.getByRole("status").textContent).toBe("");

    fireEvent.change(screen.getByLabelText("Length"), {
      target: { value: "10001" },
    });
    expect(
      screen.getByText("length must be an integer from 0 to 10000"),
    ).not.toBeNull();
  });

  it("validates date bounds and keeps UUID configuration-free", () => {
    render(<QuickGenerateShell />);

    fireEvent.change(screen.getByLabelText("Generator"), {
      target: { value: "date" },
    });
    fireEvent.change(screen.getByLabelText("Minimum date"), {
      target: { value: "2027-01-01" },
    });
    expect(screen.getByText("min must be on or before max")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Generator"), {
      target: { value: "uuid" },
    });
    expect(
      screen.getByText("This generator has no editable configuration."),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(screen.getByRole("status").textContent).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it("keeps the shell callable without props", () => {
    expectTypeOf(QuickGenerateShell).parameters.toEqualTypeOf<[]>();
  });
});
