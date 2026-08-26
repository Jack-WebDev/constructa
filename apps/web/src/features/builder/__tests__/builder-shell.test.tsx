import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";

import { BuilderShell } from "../builder-shell";

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

  it("imports a confirmed versioned document into the builder", () => {
    render(<BuilderShell />);
    const imported = {
      schemaVersion: 1,
      name: "Imported employee",
      definition: { type: "object", fields: { id: { type: "uuid" } } },
    };

    fireEvent.change(screen.getByLabelText("Generator document JSON"), {
      target: { value: JSON.stringify(imported) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review import" }));
    fireEvent.click(screen.getByRole("button", { name: "Import document" }));

    expect(screen.getByLabelText("Name")).toHaveProperty(
      "value",
      "Imported employee",
    );
    expect(
      screen.getByRole("listitem", { name: "Field id" }).textContent,
    ).toContain("UUID");
    expect(screen.getByText("Generator document imported.")).not.toBeNull();
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

  it("summarizes invalid drafts and moves focus from a validation link", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.click(screen.getByRole("button", { name: /Integer/u }));
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "200" },
    });

    const summary = screen.getByRole("alert");
    expect(summary.textContent).toContain("Fix the generator definition");
    const link = screen.getByRole("link", {
      name: /definition\.fields\.field\.min: min must be less/u,
    });
    fireEvent.click(link);
    expect(document.activeElement).toBe(
      screen.getByRole("listitem", { name: "Field field" }),
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

  it("edits one generated array's length and item definition", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.click(screen.getByRole("button", { name: /Array/u }));
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));

    expect(
      screen.getByText(
        "This configures each value in one generated array, not a bulk generation request.",
      ),
    ).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Length"), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByLabelText("Array item generator"), {
      target: { value: "uuid" },
    });

    expect(screen.getByLabelText("Length")).toHaveProperty("value", "0");
    expect(screen.getByLabelText("Array item generator")).toHaveProperty(
      "value",
      "uuid",
    );
  });

  it("shows array item validation at the item control", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.click(screen.getByRole("button", { name: /Array/u }));
    fireEvent.click(screen.getByRole("button", { name: "Configure" }));
    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "4" },
    });

    expect(
      screen.getByText("min must be less than or equal to max"),
    ).not.toBeNull();
    expect(screen.getByLabelText("Minimum").getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("inserts sibling references and surfaces template dependency feedback", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Change generator" })[1],
    );
    fireEvent.click(screen.getByRole("button", { name: /Template/u }));
    fireEvent.click(screen.getAllByRole("button", { name: "Configure" })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Insert {field}" }));

    expect(screen.getByLabelText("Template")).toHaveProperty(
      "value",
      "Hello {{world}}{field}",
    );
    fireEvent.change(screen.getByLabelText("Template"), {
      target: { value: "{missing}" },
    });
    expect(
      screen.getByText("The referenced object value could not be found."),
    ).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Template"), {
      target: { value: "{field2}" },
    });
    expect(
      screen.getByText(/Circular object value reference detected/u),
    ).not.toBeNull();
  });

  it("reports non-scalar template references without offering them for insertion", () => {
    render(<BuilderShell />);

    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Change generator" })[0],
    );
    fireEvent.click(screen.getByRole("button", { name: /Object/u }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Change generator" })[1],
    );
    fireEvent.click(screen.getByRole("button", { name: /Template/u }));
    fireEvent.click(screen.getAllByRole("button", { name: "Configure" })[1]);

    expect(screen.queryByRole("button", { name: "Insert {field}" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Template"), {
      target: { value: "{field}" },
    });
    expect(
      screen.getByText("Template references must resolve to a scalar value."),
    ).not.toBeNull();
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
