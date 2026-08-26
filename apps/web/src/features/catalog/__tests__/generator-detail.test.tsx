import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { GeneratorDetail } from "../generator-detail";

afterEach(cleanup);

describe("GeneratorDetail", () => {
  it("renders metadata, configuration, output, and portable examples for a stable URL type ID", () => {
    render(<GeneratorDetail typeId="decimal" />);

    expect(screen.getByRole("heading", { name: "Decimal" })).not.toBeNull();
    expect(screen.getByText(/number output category/u)).not.toBeNull();
    expect(screen.getByText("precision")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Examples" })).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: "Validation errors" }),
    ).not.toBeNull();
  });

  it("renders a recoverable missing-generator state", () => {
    render(<GeneratorDetail typeId="missing" />);

    expect(
      screen.getByRole("heading", { name: "Generator not found" }),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "Browse generators" }),
    ).not.toBeNull();
  });
});
