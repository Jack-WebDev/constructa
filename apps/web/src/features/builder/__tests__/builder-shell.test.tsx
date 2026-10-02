import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BuilderShell } from "../builder-shell";

afterEach(cleanup);

describe("BuilderShell", () => {
  it("teaches the empty-state workflow across structure, configuration, and preview", () => {
    render(<BuilderShell />);
    expect(screen.getByText("Build your data")).not.toBeNull();
    expect(screen.getByText("Choose a field to configure")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Live preview" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Generate data" }),
    ).not.toBeNull();
  });

  it("adds a field, selects a generator, and exposes its contextual settings", () => {
    render(<BuilderShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    expect(
      screen.getByRole("heading", { name: "Field configuration" }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search generators" }),
      { target: { value: "integer" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Integer/u }));
    expect(screen.getByLabelText("Minimum")).not.toBeNull();
    expect(screen.getByLabelText("Maximum")).not.toBeNull();
  });

  it("renames the selected field without exposing document controls in the workspace", () => {
    render(<BuilderShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const name = screen.getByLabelText("Field name");
    fireEvent.change(name, { target: { value: "active" } });
    fireEvent.blur(name);
    expect(screen.getByText("active")).not.toBeNull();
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("requires confirmation before removing a selected field", () => {
    render(<BuilderShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByText("Field actions"));
    fireEvent.click(screen.getByRole("button", { name: "Remove field" }));

    expect(screen.getByRole("alertdialog").textContent).toContain(
      "This removes the field and any nested configuration inside it.",
    );

    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Remove field",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Field configuration" }),
    ).not.toBeNull();
    expect(screen.getByText("Choose a field to configure")).not.toBeNull();
  });

  it("keeps nested object editing in the tree while using the same field editor", () => {
    render(<BuilderShell />);
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    fireEvent.click(screen.getByRole("button", { name: "Change generator" }));
    fireEvent.click(screen.getByRole("button", { name: /Object/u }));
    fireEvent.click(screen.getAllByRole("button", { name: "Add field" })[1]);
    expect(screen.getByText("Dataset / field / field")).not.toBeNull();
  });

  it("keeps final generation separate from the preview", () => {
    render(<BuilderShell />);
    fireEvent.click(screen.getByRole("button", { name: "Generate data" }));
    expect(
      screen.getByRole("heading", { name: "Generate data" }),
    ).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Records"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(screen.getByText("2 records generated")).not.toBeNull();
  });

  it("keeps document metadata and import/export in dataset settings", () => {
    render(<BuilderShell />);
    fireEvent.click(screen.getByRole("button", { name: "Dataset settings" }));
    expect(screen.getByLabelText("Name")).not.toBeNull();
    expect(screen.getByLabelText("Generator document JSON")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Download document JSON" }),
    ).not.toBeNull();
  });
});
