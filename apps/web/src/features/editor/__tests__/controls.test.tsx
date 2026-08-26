import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  BooleanControl,
  DateControl,
  ListControl,
  NumberControl,
  SelectControl,
  TextControl,
} from "../controls";

describe("editor controls", () => {
  it("maps number drafts to numbers and preserves empty drafts", () => {
    const onChange = vi.fn();
    render(
      <NumberControl
        label="Minimum"
        name="min"
        onChange={onChange}
        value={0}
      />,
    );

    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "-1.5" },
    });
    fireEvent.change(screen.getByLabelText("Minimum"), {
      target: { value: "" },
    });

    expect(onChange).toHaveBeenNthCalledWith(1, -1.5);
    expect(onChange).toHaveBeenNthCalledWith(2, "");
  });

  it("maps text and date controls without coercing their values", () => {
    const textChange = vi.fn();
    const dateChange = vi.fn();
    render(
      <>
        <TextControl
          label="Template"
          name="source"
          onChange={textChange}
          value=""
        />
        <DateControl
          label="Minimum date"
          name="min"
          onChange={dateChange}
          value="2026-01-01"
        />
      </>,
    );

    fireEvent.change(screen.getByLabelText("Template"), {
      target: { value: "Hello {{name}}" },
    });
    fireEvent.change(screen.getByLabelText("Minimum date"), {
      target: { value: "2026-12-31" },
    });

    expect(textChange).toHaveBeenCalledWith("Hello {{name}}");
    expect(dateChange).toHaveBeenCalledWith("2026-12-31");
  });

  it("maps boolean and select controls through labelled native controls", () => {
    const booleanChange = vi.fn();
    const selectChange = vi.fn();
    render(
      <>
        <BooleanControl
          label="Enabled"
          name="enabled"
          onChange={booleanChange}
          value={false}
        />
        <SelectControl
          label="Character set"
          name="charset"
          onChange={selectChange}
          options={[{ label: "Numeric", value: "numeric" }]}
          value="numeric"
        />
      </>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Enabled" }));
    fireEvent.change(screen.getByLabelText("Character set"), {
      target: { value: "numeric" },
    });

    expect(booleanChange).toHaveBeenCalledWith(true);
    expect(selectChange).toHaveBeenCalledWith("numeric");
  });

  it("maps valid JSON arrays and preserves malformed list drafts", () => {
    const onChange = vi.fn();
    render(
      <ListControl
        label="Choices"
        name="values"
        onChange={onChange}
        value={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Choices"), {
      target: { value: '["one", 2, false]' },
    });
    fireEvent.change(screen.getByLabelText("Choices"), {
      target: { value: "not json" },
    });
    fireEvent.change(screen.getByLabelText("Choices"), {
      target: { value: '{"not":"a list"}' },
    });

    expect(onChange).toHaveBeenNthCalledWith(1, ["one", 2, false]);
    expect(onChange).toHaveBeenNthCalledWith(2, "not json");
    expect(onChange).toHaveBeenNthCalledWith(3, '{"not":"a list"}');
  });

  it("keeps the control callback surface intentionally broad for drafts", () => {
    expectTypeOf<
      ComponentProps<typeof NumberControl>["onChange"]
    >().toEqualTypeOf<(value: unknown) => void>();
  });
});
