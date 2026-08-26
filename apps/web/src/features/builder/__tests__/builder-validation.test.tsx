import { render, screen } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  type BuilderValidationIssue,
  BuilderValidationSummary,
  getDefinitionValidationIssues,
  validateBuilderDraft,
} from "../builder-validation";
import { NestedObjectEditor } from "../nested-object-editor";
import { createBuilderDraft } from "../state";

describe("validateBuilderDraft", () => {
  it("returns template dependency errors from the shared execution path", () => {
    const issues = validateBuilderDraft(
      createBuilderDraft({
        schemaVersion: 1,
        definition: {
          type: "object",
          fields: { greeting: { type: "template", source: "{missing}" } },
        },
      }),
    );

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "REFERENCE_NOT_FOUND",
          kind: "dependency",
          message: "The referenced object value could not be found.",
          path: ["definition", "fields", "greeting"],
        }),
      ]),
    );
  });

  it("keeps canonical nested paths while exposing relative inline issues", () => {
    const draft = createBuilderDraft({
      schemaVersion: 1,
      definition: {
        type: "object",
        fields: {
          profile: {
            type: "object",
            fields: { age: { type: "integer", min: 2, max: 1 } },
          },
        },
      },
    });
    const issues = validateBuilderDraft(draft);
    const agePath = ["definition", "fields", "profile", "fields", "age"];

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "configuration",
          path: [...agePath, "min"],
        }),
      ]),
    );
    expect(getDefinitionValidationIssues(issues, agePath)).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: ["min"] })]),
    );

    render(
      <NestedObjectEditor
        breadcrumbs={["profile"]}
        depth={1}
        draft={draft}
        objectPath={["definition", "fields", "profile"]}
        onDraftChange={vi.fn()}
        onFieldFocus={vi.fn()}
        registerFieldRef={vi.fn()}
        validationIssues={issues}
      />,
    );
    expect(
      screen.getByText(/min: min must be less than or equal to max/u),
    ).not.toBeNull();
  });

  it("renders accessible focus links for canonical issues", () => {
    const onFocus = vi.fn();
    render(
      <BuilderValidationSummary
        issues={[
          {
            code: "INVALID_RANGE",
            kind: "configuration",
            message: "min must be less than or equal to max",
            path: ["definition", "fields", "age", "min"],
            fieldId: "age-field",
          },
        ]}
        onFocus={onFocus}
      />,
    );

    const link = screen.getByRole("link", {
      name: "definition.fields.age.min: min must be less than or equal to max",
    });
    link.click();
    expect(onFocus).toHaveBeenCalledWith("age-field");
    expect(screen.getByRole("alert").textContent).toContain(
      "1 issue needs attention.",
    );
  });

  it("keeps the validation result type stable", () => {
    expectTypeOf<ReturnType<typeof validateBuilderDraft>>().toEqualTypeOf<
      readonly BuilderValidationIssue[]
    >();
  });
});
