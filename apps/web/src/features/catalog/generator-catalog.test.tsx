import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GeneratorCatalog } from "./generator-catalog";

afterEach(cleanup);

describe("GeneratorCatalog", () => {
  it("combines category filtering with normalized search", () => {
    render(<GeneratorCatalog />);

    fireEvent.click(screen.getByRole("button", { name: "Numeric" }));
    fireEvent.change(screen.getByLabelText("Search generators"), {
      target: { value: "DEC" },
    });

    expect(screen.getByRole("link", { name: /Decimal/u })).not.toBeNull();
    expect(screen.queryByRole("link", { name: /Integer/u })).toBeNull();
  });

  it("renders an accessible no-results state", () => {
    render(<GeneratorCatalog />);

    fireEvent.change(screen.getByLabelText("Search generators"), {
      target: { value: "missing" },
    });

    expect(
      screen.getByRole("heading", { name: "No generators found" }),
    ).not.toBeNull();
  });
});
