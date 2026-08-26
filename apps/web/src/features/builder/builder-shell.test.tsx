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

  it("renames fields through their labelled controls", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const fieldName = screen.getByRole("textbox", {
      name: "Field name: field",
    });
    fireEvent.change(fieldName, { target: { value: "active" } });
    fireEvent.blur(fieldName);

    expect(
      screen.getByRole("textbox", { name: "Field name: active" }),
    ).toHaveProperty("value", "active");
    expect(screen.getByText("Field renamed to active.")).not.toBeNull();
  });

  it("shows validation feedback and leaves an invalid field name uncommitted", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const fieldName = screen.getByRole("textbox", {
      name: "Field name: field",
    });
    fireEvent.change(fieldName, { target: { value: " " } });
    fireEvent.blur(fieldName);

    expect(screen.getByRole("alert").textContent).toBe(
      "Field names cannot be empty.",
    );
    expect(fieldName).toHaveProperty("ariaInvalid", "true");
  });

  it("requires confirmation before removing a field and recovers focus", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("alertdialog").textContent).toContain(
      "Remove field?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove field" }));

    expect(screen.queryByRole("listitem")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Add field" }),
    );
    expect(screen.getByText("Field field removed.")).not.toBeNull();
  });

  it("moves focus to the next field after removing a field from a list", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Remove field" }));

    expect(document.activeElement).toBe(
      screen.getByRole("listitem", { name: "Field field2" }),
    );
  });

  it("moves fields using non-drag controls and disables boundary controls", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    expect(
      screen.getByRole("button", { name: "Move field up" }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: "Move field2 down" }),
    ).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "Move field2 up" }));

    expect(
      screen.getAllByRole("listitem").map((field) => field.ariaLabel),
    ).toEqual(["Field field2", "Field field"]);
    expect(document.activeElement).toBe(
      screen.getByRole("listitem", { name: "Field field2" }),
    );
  });

  it("moves a focused field with the documented keyboard shortcut", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const second = screen.getByRole("listitem", { name: "Field field2" });
    fireEvent.keyDown(second, { altKey: true, key: "ArrowUp" });

    expect(
      screen.getAllByRole("listitem").map((field) => field.ariaLabel),
    ).toEqual(["Field field2", "Field field"]);
    expect(document.activeElement).toBe(second);
    expect(screen.getByText("Field field2 moved up.")).not.toBeNull();
  });

  it("searches the allowlisted generator catalog before changing a field", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "uuid" },
    });

    expect(screen.getByRole("button", { name: /UUID/u })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Integer/u })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /UUID/u }));
    expect(screen.getByText("UUID")).not.toBeNull();
    expect(screen.getByText("Field field now uses UUID.")).not.toBeNull();
  });

  it("requires explicit confirmation before discarding incompatible configuration", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.click(screen.getByRole("button", { name: /Integer/u }));
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.click(screen.getByRole("button", { name: /UUID/u }));

    expect(screen.getByRole("alertdialog").textContent).toContain(
      "Discard configuration?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("listitem", { name: "Field field" }).textContent,
    ).toContain("Integer");

    fireEvent.click(screen.getByRole("button", { name: /UUID/u }));
    fireEvent.click(screen.getByRole("button", { name: "Discard and change" }));
    expect(screen.getByText("UUID")).not.toBeNull();
    expect(screen.getByText("Field field now uses UUID.")).not.toBeNull();
  });

  it("edits flat field generator properties through web-owned controls", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.click(screen.getByRole("button", { name: /Integer/u }));
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "21" },
    });

    expect(screen.getByLabelText("Minimum")).toHaveProperty("value", "21");
    expect(screen.getByLabelText("Maximum")).toHaveProperty("value", "100");
  });

  it("preserves invalid field configuration drafts and shows canonical feedback", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.click(screen.getByRole("button", { name: /Integer/u }));
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
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

  it("renders nested object fields with breadcrumbs, depth cues, collapse, and focus mapping", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.click(screen.getByRole("button", { name: /Object/u }));

    const nestedObject = screen.getByLabelText("Nested object field, depth 1");
    expect(nestedObject.textContent).toContain("Fields / field");
    expect(nestedObject.getAttribute("data-depth")).toBe("1");
    expect(
      screen.getByRole("listitem", { name: "Field active" }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Collapse field" }));
    expect(screen.queryByRole("listitem", { name: "Field active" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand field" }));
    fireEvent.click(screen.getByRole("button", { name: "Add field to field" }));

    const matchingFields = screen.getAllByRole("listitem", {
      name: "Field field",
    });
    expect(document.activeElement).toBe(matchingFields.at(-1));
  });

  it("cancels field removal without changing the field", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.getByRole("listitem", { name: "Field field" }),
    ).not.toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("keeps the builder shell callable without props", () => {
    expectTypeOf(BuilderShell).parameters.toEqualTypeOf<[]>();
  });
});
