import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  type EditorProps,
  getBuiltInEditorRegistry,
  getGeneratorEditor,
  WEB_EDITOR_REGISTRY,
} from "./registry";

describe("web editor registry", () => {
  it("maps every semantic built-in type to one web editor", () => {
    expect(getBuiltInEditorRegistry().map((entry) => entry.typeId)).toEqual([
      "array",
      "boolean",
      "choice",
      "date",
      "decimal",
      "integer",
      "object",
      "string",
      "template",
      "uuid",
    ]);
    expect(new Set(WEB_EDITOR_REGISTRY.map((entry) => entry.typeId)).size).toBe(
      WEB_EDITOR_REGISTRY.length,
    );
    expect(getGeneratorEditor("unknown")).toBeUndefined();
  });

  it("emits flat generator properties from the nearest editor boundary", () => {
    const editor = getGeneratorEditor("integer");
    const onChange = vi.fn();
    expect(editor).toBeDefined();
    if (editor === undefined) throw new Error("Integer editor is required");

    render(
      <editor.Editor
        definition={{ type: "integer", min: 0, max: 10 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "-5" },
    });

    expect(onChange).toHaveBeenCalledWith({
      type: "integer",
      min: -5,
      max: 10,
    });
  });

  it("does not create a configuration envelope", () => {
    const editor = getGeneratorEditor("choice");
    const onChange = vi.fn();
    expect(editor).toBeDefined();
    if (editor === undefined) throw new Error("Choice editor is required");

    render(
      <editor.Editor
        definition={{ type: "choice", values: [] }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Choices"), {
      target: { value: '["small", "large"]' },
    });

    expect(onChange).toHaveBeenCalledWith({
      type: "choice",
      values: ["small", "large"],
    });
  });

  it("keeps the public editor props typed around flat definition properties", () => {
    expectTypeOf<EditorProps["definition"]>().toEqualTypeOf<
      Readonly<Record<string, unknown>>
    >();
  });
});
