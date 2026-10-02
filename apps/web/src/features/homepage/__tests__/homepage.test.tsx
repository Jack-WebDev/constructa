import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";

import { Homepage } from "../homepage";

afterEach(cleanup);

describe("Homepage", () => {
  it("communicates composition and renders an employee-generator example", () => {
    render(<Homepage />);

    expect(
      screen.getByRole("heading", { name: "Generate what you need." }),
    ).not.toBeNull();
    expect(
      screen.getByRole("region", { name: "Employee generator" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("list", { name: "Employee generator fields" }),
    ).not.toBeNull();
    expect(screen.getByText("Integer")).not.toBeNull();
    expect(screen.getByText("Boolean")).not.toBeNull();
    expect(screen.getByText(/"employeeNumber"/u)).not.toBeNull();
  });

  it("links calls to action to the available generator flows", () => {
    render(<Homepage />);

    expect(
      screen.getByRole("link", { name: "Start building" }).getAttribute("href"),
    ).toBe("/builder");
    expect(
      screen.getByRole("link", { name: "Quick generate" }).getAttribute("href"),
    ).toBe("/quick-generate");
  });

  it("keeps the homepage callable without props", () => {
    expectTypeOf(Homepage).parameters.toEqualTypeOf<[]>();
  });
});
