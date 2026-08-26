export type WebError = {
  readonly code: string;
  readonly kind: string;
  readonly message: string;
  readonly path: readonly (string | number)[];
};

export type WebFieldIssue = {
  readonly message: string;
  readonly path: readonly (string | number)[];
};

export function toFieldIssues(
  errors: readonly WebError[],
): readonly WebFieldIssue[] {
  return errors.map((error) => ({ message: error.message, path: error.path }));
}

export function getFieldIssue(
  issues: readonly WebFieldIssue[] | undefined,
  fieldName: string,
): WebFieldIssue | undefined {
  return issues?.find(
    (issue) => issue.path[0] === fieldName || issue.path.length === 0,
  );
}

export function describeWebError(error: WebError): {
  readonly title: string;
  readonly message: string;
} {
  if (error.kind === "configuration") {
    return { title: "Fix the generator definition", message: error.message };
  }
  if (error.kind === "dependency") {
    return { title: "Update generator references", message: error.message };
  }
  return {
    title: "Unable to generate a value",
    message:
      "Something went wrong while generating the result. Please try again.",
  };
}

export function DefinitionErrorSummary({
  issues,
}: {
  readonly issues: readonly WebFieldIssue[];
}) {
  if (issues.length === 0) return null;

  return (
    <section
      aria-labelledby="definition-errors-title"
      className="rounded border border-destructive/50 p-3"
      role="alert"
    >
      <h3 className="font-medium text-destructive" id="definition-errors-title">
        Fix the generator definition
      </h3>
      <ul className="mt-2 list-inside list-disc text-destructive text-sm">
        {issues.map((issue) => (
          <li key={`${issue.path.join(".")}:${issue.message}`}>
            {formatPath(issue.path)}: {issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatPath(path: readonly (string | number)[]): string {
  return path.length === 0 ? "definition" : path.join(".");
}
