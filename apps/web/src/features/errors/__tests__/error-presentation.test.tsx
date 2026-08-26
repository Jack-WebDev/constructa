import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, expectTypeOf, it } from "vitest";

import {
  DefinitionErrorSummary,
  describeWebError,
  getFieldIssue,
  toFieldIssues,
  type WebError,
} from "../error-presentation";

afterEach(cleanup);

describe("web error presentation", () => {
  it("maps shared segment paths to the matching field and summary", () => {
    const issues = toFieldIssues([
      {
        code: "INVALID_RANGE",
        kind: "configuration",
        message: "min must not exceed max",
        path: ["min"],
      },
    ]);
    expect(getFieldIssue(issues, "min")?.message).toBe(
      "min must not exceed max",
    );
    expect(getFieldIssue(issues, "max")).toBeUndefined();

    render(<DefinitionErrorSummary issues={issues} />);
    expect(screen.getByRole("alert").textContent).toContain(
      "min: min must not exceed max",
    );
  });

  it("uses actionable dependency copy and generic system copy", () => {
    expect(
      describeWebError({
        code: "REFERENCE_NOT_FOUND",
        kind: "dependency",
        message: "Reference profile.id was not found",
        path: ["source"],
      }),
    ).toEqual({
      title: "Update generator references",
      message: "Reference profile.id was not found",
    });
    expect(
      describeWebError({
        code: "SYSTEM_ERROR",
        kind: "system",
        message: "secret internal detail",
        path: [],
      }),
    ).toEqual({
      title: "Unable to generate a value",
      message:
        "Something went wrong while generating the result. Please try again.",
    });
  });

  it("keeps the shared web error surface structurally typed", () => {
    expectTypeOf<WebError>().toMatchTypeOf<{
      readonly code: string;
      readonly path: readonly (string | number)[];
    }>();
  });
});
