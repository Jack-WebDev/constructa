import { type GeneratorDefinition, generate } from "constructa-sdk";

import type {
  BuilderDocumentDraft,
  BuilderDraftError,
  BuilderUiId,
} from "./state";
import { getBuilderDefinitionId, toGeneratorDocument } from "./state";

export type BuilderValidationIssue = BuilderDraftError & {
  /** The nearest rendered definition row that owns this canonical error. */
  readonly fieldId?: BuilderUiId;
};

/**
 * Validates the current raw draft through the portable document boundary and,
 * when it is structurally valid, through the SDK execution path for dependency
 * errors such as invalid template references. The draft is never changed.
 */
export function validateBuilderDraft(
  draft: BuilderDocumentDraft,
): readonly BuilderValidationIssue[] {
  const conversion = toGeneratorDocument(draft);
  const errors = conversion.success
    ? validateDependencies(conversion.document.definition)
    : conversion.errors;

  return errors.map((error) => ({
    ...error,
    fieldId: findOwningFieldId(draft, error.path),
  }));
}

/** Returns issues beneath a definition with paths relative to that definition. */
export function getDefinitionValidationIssues(
  issues: readonly BuilderValidationIssue[],
  definitionPath: readonly (string | number)[],
): readonly BuilderValidationIssue[] {
  return issues.flatMap((issue) =>
    hasPathPrefix(issue.path, definitionPath)
      ? [{ ...issue, path: issue.path.slice(definitionPath.length) }]
      : [],
  );
}

/** Renders the document-wide validation summary and focus links. */
export function BuilderValidationSummary({
  issues,
  onFocus,
}: {
  readonly issues: readonly BuilderValidationIssue[];
  readonly onFocus: (fieldId: BuilderUiId) => void;
}) {
  if (issues.length === 0) return null;

  return (
    <section
      aria-labelledby="builder-validation-title"
      className="mt-6 rounded border border-destructive/50 p-3"
      role="alert"
    >
      <h2
        className="font-medium text-destructive"
        id="builder-validation-title"
      >
        Fix the generator definition
      </h2>
      <p className="mt-1 text-destructive text-sm">
        {issues.length === 1
          ? "1 issue needs attention."
          : `${issues.length} issues need attention.`}
      </p>
      <ul className="mt-2 list-inside list-disc text-destructive text-sm">
        {issues.map((issue, index) => (
          <li key={`${issue.path.join(".")}:${issue.code}:${index}`}>
            {issue.fieldId === undefined ? (
              <>
                {formatPath(issue.path)}: {issue.message}
              </>
            ) : (
              <a
                aria-label={`${formatPath(issue.path)}: ${issue.message}`}
                href={`#builder-field-${issue.fieldId}`}
                onClick={(event) => {
                  event.preventDefault();
                  onFocus(issue.fieldId as BuilderUiId);
                }}
              >
                Go to {formatPath(issue.path)}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Provides inline feedback for a rendered field, including nested fields. */
export function BuilderInlineValidationIssues({
  issues,
}: {
  readonly issues: readonly BuilderValidationIssue[];
}) {
  if (issues.length === 0) return null;

  return (
    <ul aria-live="polite" className="mt-2 space-y-1 text-destructive text-xs">
      {issues.map((issue, index) => (
        <li key={`${issue.path.join(".")}:${issue.code}:${index}`}>
          {formatPath(issue.path)}: {issue.message}
        </li>
      ))}
    </ul>
  );
}

function validateDependencies(
  definition: GeneratorDefinition,
): readonly BuilderDraftError[] {
  try {
    generate(definition);
    return [];
  } catch (cause) {
    const error = toBuilderDraftError(cause);
    return [
      { ...error, path: toDocumentDefinitionPath(definition, error.path) },
    ];
  }
}

function toBuilderDraftError(cause: unknown): BuilderDraftError {
  if (
    typeof cause === "object" &&
    cause !== null &&
    typeof (cause as Partial<BuilderDraftError>).code === "string" &&
    typeof (cause as Partial<BuilderDraftError>).kind === "string" &&
    typeof (cause as Partial<BuilderDraftError>).message === "string" &&
    Array.isArray((cause as Partial<BuilderDraftError>).path)
  ) {
    return {
      code: (cause as BuilderDraftError).code,
      kind: (cause as BuilderDraftError).kind,
      message: (cause as BuilderDraftError).message,
      path: (cause as BuilderDraftError).path,
    };
  }
  return {
    code: "VALIDATION_FAILED",
    kind: "system",
    message: "Unable to validate the generator definition.",
    path: [],
  };
}

function toDocumentDefinitionPath(
  definition: GeneratorDefinition,
  path: readonly (string | number)[],
): readonly (string | number)[] {
  let current: unknown = definition;
  const documentPath: (string | number)[] = ["definition"];

  for (const segment of path) {
    if (
      typeof current !== "object" ||
      current === null ||
      (current as { readonly type?: unknown }).type !== "object" ||
      typeof segment !== "string"
    ) {
      return ["definition", ...path];
    }
    const fields = (current as { readonly fields?: unknown }).fields;
    if (typeof fields !== "object" || fields === null || !(segment in fields)) {
      return ["definition", ...path];
    }
    documentPath.push("fields", segment);
    current = (fields as Record<string, unknown>)[segment];
  }
  return documentPath;
}

function findOwningFieldId(
  draft: BuilderDocumentDraft,
  path: readonly (string | number)[],
): BuilderUiId | undefined {
  for (let length = path.length; length >= 1; length -= 1) {
    const id = getBuilderDefinitionId(draft, path.slice(0, length));
    if (id !== undefined) return id;
  }
  return undefined;
}

function hasPathPrefix(
  path: readonly (string | number)[],
  prefix: readonly (string | number)[],
): boolean {
  return prefix.every((segment, index) => path[index] === segment);
}

function formatPath(path: readonly (string | number)[]): string {
  return path.length === 0 ? "definition" : path.join(".");
}
