import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";

import { BuilderShell } from "./builder-shell";

afterEach(cleanup);

describe("BuilderShell", () => {
  it("edits document-level name and description through labelled controls", () => {
    render(<BuilderShell />);

    expect(
      screen.getByRole("heading", { name: "Build a generator." }),
    ).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Employee" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Generates test employees." },
    });

    expect(screen.getByLabelText("Name")).toHaveProperty("value", "Employee");
    expect(screen.getByLabelText("Description")).toHaveProperty(
      "value",
      "Generates test employees.",
    );
  });

  it("announces identity updates after a control loses focus", () => {
    render(<BuilderShell />);

    const name = screen.getByLabelText("Name");
    fireEvent.change(name, { target: { value: "Employee" } });
    fireEvent.blur(name);
    expect(screen.getByText("Document name updated.")).not.toBeNull();
  });

  it("adds a safe default field and moves focus to its new field row", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));

    const field = screen.getByRole("listitem", { name: "Field field" });
    expect(field.textContent).toContain("Boolean");
    expect(document.activeElement).toBe(field);
  });

  it("keeps the builder shell callable without props", () => {
    expectTypeOf(BuilderShell).parameters.toEqualTypeOf<[]>();
  });
});
